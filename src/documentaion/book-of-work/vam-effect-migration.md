# VAM migration to Effect

## Goal

Move the Vault Action Manager's I/O, failures, concurrency, timing, and
lifecycle into Effect without changing vault behavior or forcing every VAM
consumer to migrate at once.

The existing `VaultActionManager` interface remains the external seam during
the migration. A compatibility facade runs Effect programs and converts their
results to the current Promise and `neverthrow` contracts. Pure planning code
stays as ordinary TypeScript.

## Decisions

- Install Effect 4 from the `rc` tag and pin the resolved version. Do not use
  `effect@latest`, which resolves to Effect 3 while Effect 4 is in prerelease.
- Create one `ManagedRuntime` for VAM. Do not call `Effect.runPromise` inside
  implementation modules.
- Keep the current `VaultActionManager` interface until the internal migration
  is complete.
- Keep the existing Zod schemas and codecs. Zod 4 and Effect both implement
  Standard Schema V1, but Standard Schema is a validation interface rather
  than a bidirectional schema converter. It cannot replace the encoding half
  of VAM's `z.codec()` path codec.
- Use Effect `Schema` for new Effect-native tagged errors. Do not duplicate the
  existing `SplitPath`, `VaultAction`, or `VaultEvent` schemas in Effect.
- Leave action collapse, requirement expansion, dependency detection,
  topological sorting, path conversion, event collapse, and Semantic Root
  reduction as pure functions.
- Use `Queue` for single-consumer Dispatch Batches and `PubSub` for Bulk Vault
  Events delivered to multiple subscribers.
- Preserve current behavior before proposing queue limits, backpressure, or
  public interface changes. Those are separate decisions.
- Add explicit runtime disposal to the plugin lifecycle. Plugin unload must
  release listeners, queues, fibers, timers, and pending waiters.
- This migration changes code only. It does not change persisted note or vault
  formats.

## Target shape

```text
Obsidian and existing callers
             |
VaultActionManager compatibility facade
             |
       one ManagedRuntime
             |
   +---------+------------------+
   |                            |
Dispatch module          Observation module
Queue + Deferred         Queue + Clock + PubSub
   |                            |
Vault execution          Self Event registry
   +-------------+--------------+
                 |
      read and editor modules
                 |
          Obsidian adapters
```

The production and test adapters justify internal seams around Obsidian vault
I/O and active-editor access. Do not introduce a `Context.Service` for every
helper class. Effect modules should hide coordination or external I/O, not
rename the current object graph one class at a time.

## 1. Bootstrap Effect

Implementation baseline: before adding the Effect runtime, the production
`main.js` bundle was 3,677,505 bytes.

The installed dependency is pinned to `effect@4.0.0-rc.112` in both
`package.json` and `bun.lock`.

### Changes

1. Add Effect at the monorepo root with Bun:

   ```bash
   bun add -D --exact effect@rc
   ```

2. Add the required Effect guidance to `AGENTS.md` and `CLAUDE.md`:

   ```md
   # Learning more about Effect

   This repository uses the Effect Typescript library.

   Before writing any Effect code, first read `node_modules/effect/AGENTS.md`
   **completely**, and follow the links in the file when required.

   If you need to learn more about particular Effect apis and concepts that the
   guide doesn't cover, search through the source code in
   `node_modules/effect/src`.
   ```

3. Add a strict VAM-specific TypeScript configuration and a
   `typecheck:vam` script. The root configuration is not fully strict, while
   Effect requires strict typechecking.
4. Record the current `main.js` size before adding runtime code.

### Tests for this phase

- `bun run typecheck:vam` passes.
- `bun test src/packages/independent/vault-action-manager/tests/` passes.
- `bun run typecheck:changed` passes for the migration patch.
- `bun run build` succeeds.
- The dependency and lockfile contain one exact Effect 4 RC version.
- No runtime VAM source imports Effect yet. This phase only establishes the
  toolchain and instructions.

## 2. Introduce the runtime seam

### Changes

1. Define Effect-native error types for setup, vault I/O, planning, dispatch,
   subscription, and shutdown failures. Use `Schema.TaggedError` and retain the
   original cause.
2. Define the smallest useful Obsidian ports. Start with vault I/O and active
   editor access because both need production and test adapters.
3. Build a `VamLive` layer from the production Obsidian adapters.
4. Create one `ManagedRuntime` in `createVaultActionManager()`.
5. Keep the existing manager and testing adapter returned by the factory. Add
   a disposal handle owned by the plugin.
6. Convert errors and successes to `neverthrow` only in the compatibility
   facade. No Effect error or environment type should leak through the current
   public interface.
7. Register disposal during plugin unload. Disposal must be safe to call more
   than once.

### Tests for this phase

- Existing callers compile without changes.
- A facade contract test covers every public method's return shape.
- Runtime creation is lazy or synchronous enough that
  `createVaultActionManager()` keeps its current synchronous contract.
- Disposal runs every registered finalizer exactly once.
- Repeated disposal does not throw or leave an unresolved Promise.
- A program submitted after disposal fails with a typed shutdown error at the
  Effect seam and the current mapped error at the compatibility facade.
- Package tests, `typecheck:vam`, `typecheck:changed`, and the production build
  pass.

## 3. Migrate vault I/O and active-editor operations

### Changes

1. Convert Promise-returning Obsidian operations with `Effect.tryPromise`.
2. Convert throwing synchronous operations with `Effect.try`.
3. Migrate `Executor`, `TFileHelper`, `TFolderHelper`, and asynchronous
   `ScrollAccess` operations one path at a time.
4. Preserve active-editor versus background-vault routing.
5. Keep synchronous facade queries synchronous during this migration. Do not
   make `exists`, `findByBasename`, `list`, `mdPwd`, selection access, or link
   resolution asynchronous merely to make their implementations uniform.
6. Preserve Zod validation and codecs. If Zod decoding runs inside an Effect,
   adapt `safeParse` directly or use the schema's Standard Schema
   `~standard.validate` method. Continue to use the Zod codec directly for
   reverse encoding.
7. Replace internal string errors only after their facade mapping is covered
   by tests.

### Tests for this phase

- Every Vault Action kind has a success and failure test through the migrated
  executor interface.
- Error tests assert operation, path, action where applicable, and retained
  cause. They do not assert only a formatted message.
- Active Scroll reads and writes use the editor adapter.
- Background Scroll reads and writes use the vault adapter.
- Rename selection restoration keeps its current timing and result behavior.
- Read retry behavior still distinguishes missing files, permission failures,
  and unknown failures.
- Existing Zod codec round-trip tests remain unchanged and pass.
- Package tests, `typecheck:vam`, `typecheck:changed`, and the production build
  pass.

## 4. Migrate Dispatch Batch coordination

### Changes

1. Replace the submitted-batch array and manual drain loop with a scoped
   single-consumer worker.
2. Represent each submitted batch as its actions plus a `Deferred` completed
   with that caller's result.
3. Use an Effect `Queue` to preserve FIFO ordering and prevent batch
   interleaving.
4. Keep planning pure. The worker calls requirement expansion, collapse,
   dependency graph construction, and topological sort before executing.
5. Register Self Events after planning succeeds and immediately before action
   execution, matching current behavior.
6. Execute planned actions sequentially. Collect per-action failures and keep
   running later actions in the same batch.
7. Preserve the current `maxBatches` behavior exactly during the migration.
   Do not substitute ordinary bounded-queue backpressure or dropping semantics.
   A later design change may replace this limit once its intended meaning is
   settled.
8. On shutdown, complete every queued caller. No `Deferred` may remain pending.
9. Add Effect spans around batch planning and action execution. Include action
   kind and path as span attributes.

### Tests for this phase

- Submitted batches execute FIFO without interleaving.
- Each queued caller receives the result for its own batch.
- A failed batch does not prevent the next batch from running.
- A thrown defect is reported against the action that triggered it.
- A planning failure completes the caller instead of leaving it pending.
- Empty batches succeed without touching the executor or Self Event registry.
- Action failures accumulate while later actions in the same batch still run.
- Self Events are registered once, in planned execution order.
- Current overflow behavior and error ownership remain covered by the existing
  tests.
- Shutdown completes the running batch according to the chosen interruption
  rule and fails all queued batches explicitly.
- `whenIdle()` resolves only after the queue and active worker are empty.
- Package tests, `typecheck:vam`, `typecheck:changed`, and the production build
  pass.

## 5. Migrate vault observation and Self Event tracking

### Changes

1. Acquire the Obsidian create, rename, and delete listener refs with
   `Effect.acquireRelease`.
2. Make Obsidian callbacks perform only Self Event attribution, event encoding,
   and a non-blocking offer to an unbounded intake queue. Vault callbacks must
   not wait for subscribers.
3. Run the quiet-window and maximum-window logic in a scoped fiber using Effect
   `Clock`.
4. Keep event collapse and Semantic Root reduction pure.
5. Publish completed Bulk Vault Events through `PubSub`.
6. Give each subscriber a scoped handler fiber. Calling the returned teardown
   closes that subscription's scope.
7. Isolate subscriber failures. One failed subscriber must not stop the
   observation worker or another subscriber.
8. Track active handler work separately from PubSub so `whenSettled()` can wait
   for actual handler completion.
9. Replace Self Event `setTimeout` entries with expiration timestamps stored in
   `Ref` and read through Effect `Clock`. Prune expired entries during register
   and lookup operations.
10. Preserve exact-match pop behavior and folder-prefix behavior.

### Tests for this phase

- Listener acquisition registers exactly one create, rename, and delete
  listener.
- Closing the scope removes all three listener refs.
- Starting before the first subscriber does not register listeners early.
- Removing the final subscriber stops observation and clears its pending
  window.
- Create and delete callbacks perform Self Event attribution exactly once.
- Rename callbacks test the old and new paths exactly once each.
- A matching Self Event never enters the observation window.
- Quiet-window and maximum-window flushing use `TestClock`; tests contain no
  real sleeps.
- Continuous events cannot postpone a flush beyond the maximum window.
- Event collapse and Semantic Roots match the current fixtures.
- Multiple subscribers receive the same Bulk Vault Event.
- A failing subscriber is logged and does not interrupt other subscribers.
- Exact Self Event entries pop on first match. Folder prefixes survive multiple
  descendant matches until expiry.
- `whenSettled()` waits for the current window, all subscriber handlers, any
  Dispatch Batches started by those handlers, and registered file readiness.
- Package tests, `typecheck:vam`, `typecheck:changed`, and the production build
  pass.

## 6. Remove internal compatibility code

### Changes

1. Remove `neverthrow` from migrated implementation modules. Keep it only in
   the external compatibility facade and structural public types that still
   require it.
2. Remove manual pending counters, waiter sets, timer helpers, and Promise
   coordination that Effect now owns.
3. Route VAM logs through an Effect logger layer backed by the repository's
   logging sink.
4. Keep the testing adapter narrow. It may observe Effect-native idleness and
   readiness, but it must use the production object graph.
5. Update `vam-architecture.md` to describe the runtime, layers, queue,
   observation fiber, shutdown behavior, and error contracts.
6. Record the final `main.js` size and compare it with the pre-migration
   baseline.

Implementation result: the final production `main.js` is 4,479,880 bytes, an
increase of 802,375 bytes (21.8%) from the 3,677,505-byte baseline.

### Tests for this phase

- `rg` finds no `neverthrow` imports in VAM implementation modules outside the
  compatibility facade and explicitly retained public types.
- `rg` finds no VAM-owned `setTimeout`, manual queue-drain loop, or listener
  teardown array where the Effect implementation replaced it.
- The testing adapter uses the same live layer and runtime as the production
  manager.
- Plugin load, use, reload, and unload complete without duplicate listeners or
  background work.
- `bun test src/packages/independent/vault-action-manager/tests/` passes.
- `bun run test:unit` passes.
- `bun run typecheck:vam` passes.
- `bun run typecheck:changed` passes.
- `bun run build` succeeds and the bundle-size change is recorded.
- With Obsidian running, `bun run test:cli-e2e` passes after copying `main.js`
  into the test vault and reloading the plugin.

## Native Effect interface migration window

The package now exposes two public subpaths over the same runtime and object
graph:

- `@textfresser/vault-action-manager/facade` is the canonical interface. Its
  operations return environment-free Effects and retain typed VAM failures in
  the error channel.
- `@textfresser/vault-action-manager/legacy-neverthrow-facade` preserves the
  previous Promise and Neverthrow signatures by delegating to the canonical
  facade.

The package root remains backward compatible during the migration window and
also exports discoverable `createEffectVaultActionManager` and
`EffectVaultActionManager` aliases. Consumers can migrate independently by
moving to the explicit legacy subpath first and then changing that import to
`/facade` while converting their call sites to Effect composition.

Keep the two interfaces only for the migration window. Delete
`legacy-neverthrow-facade.ts`, the root legacy aliases, structural Neverthrow
reader/result types, and VAM's final `neverthrow` dependency once no consumer
imports the legacy contract.
