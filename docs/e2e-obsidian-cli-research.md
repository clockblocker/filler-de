# Obsidian CLI research for a deterministic plugin E2E harness

Research date: 2026-08-29. Local app under test: Obsidian 1.13.7 with installer 1.12.7 on macOS.

## Executive findings

1. **The current harness is not using the new official CLI executable.** It invokes `/Applications/Obsidian.app/Contents/MacOS/Obsidian`, the GUI executable. Obsidian's current macOS CLI registration instead points `obsidian` at `/Applications/Obsidian.app/Contents/MacOS/obsidian-cli`. The official documentation explicitly describes that symlink. This is not a cosmetic path difference: in a local probe the GUI executable returned before a Promise from `eval` settled, whereas `obsidian-cli` awaited it and returned the resolved value.
2. **The real CLI removes the need for the renderer-global Promise state/polling workaround.** The official plugin API also supports first-class plugin CLI handlers whose return type is `string | Promise<string>`. A test-only CLI control plane can therefore expose `ready`, `reset`, `idle`, `act`, and `diagnostics` as awaited commands instead of repeatedly injecting arbitrary JavaScript through `eval`.
3. **A zero exit code is not a success contract for `eval`.** Both synchronous throws and rejected Promises were printed as `Error: ...` on stdout while the process exited `0`. A harness must parse a structured response or at least treat an `Error:` result as failure.
4. **`plugin:reload` is a lifecycle operation, not a complete application-readiness barrier.** It reloads the plugin, but it cannot know about async work that the plugin deliberately starts without awaiting from `onload`. Textfresser currently does exactly that in `src/main.ts`. Readiness must be an explicit plugin-owned Promise/state transition.
5. **The desktop app remains mandatory.** Obsidian CLI controls a running desktop app; the first command launches it if necessary. Obsidian Headless is a separate client for Sync and Publish, not a plugin runtime. A plugin E2E harness therefore needs a graphical Obsidian session and should not be described as headless CI.
6. **Vault selection is routing, not process isolation.** `vault=<name-or-id>` selects a vault in the desktop app, and must be the first parameter. It does not create an isolated Obsidian profile or process. Tests sharing a vault still share its plugin instances, filesystem watchers, metadata cache, workspace, and settings.
7. **The official docs do not promise automatic reload on plugin artifact changes.** The developer workflow documents disable/enable and refers users to the third-party Hot-Reload plugin for reload-on-change. Any observed delayed reload after copying `main.js` is an implementation detail and must not be used as synchronization. Deploy once while disabled (preferably before app startup), enable once, and use explicit protocol barriers thereafter.
8. **The repository's compile-time Obsidian API is older than the CLI-handler API.** The installed `obsidian` package is 1.10.3 and `manifest.json` still declares `minAppVersion: 1.8.0`; `registerCliHandler` was added in 1.12.2. A test-driver plugin can use the newer API without forcing Textfresser's production minimum upward. If Textfresser itself registers the commands, its types and minimum supported app version must be updated or the feature must be guarded.

## The executable mismatch

The repository documentation and current wrapper use:

```text
/Applications/Obsidian.app/Contents/MacOS/Obsidian
```

The current installer contains two separate binaries:

```text
/Applications/Obsidian.app/Contents/MacOS/Obsidian
/Applications/Obsidian.app/Contents/MacOS/obsidian-cli
```

The registered command on this host is:

```text
/usr/local/bin/obsidian -> /Applications/Obsidian.app/Contents/MacOS/obsidian-cli
```

This matches the official macOS troubleshooting instructions, which say CLI registration creates exactly this symlink to the bundled `obsidian-cli` binary ([Obsidian CLI documentation](https://help.obsidian.md/cli), [first-party source Markdown](https://github.com/obsidianmd/obsidian-help/blob/master/en/Extending%20Obsidian/Obsidian%20CLI.md)). The Kepano skill consistently invokes `obsidian`, not the GUI executable ([Kepano Obsidian CLI skill](https://github.com/kepano/obsidian-skills/blob/main/skills/obsidian-cli/SKILL.md)).

### Local process/async probes

All probes targeted the dedicated `cli-e2e-test-vault` and used a Promise that resolves to `"done"` after 1.5 seconds.

| Invocation | Wall time | stdout | Interpretation |
| --- | ---: | --- | --- |
| GUI executable `.../MacOS/Obsidian vault=... eval code=<Promise>` | about 0.65 s | empty | Returned before Promise completion. |
| Registered CLI `/usr/local/bin/obsidian vault=... eval code=<Promise>` | about 1.50 s | `=> done` | Awaited Promise and returned its value. |

This directly explains why TypeScript `await obsidianEval("(async () => ...)()")` was previously illusory: the child process being awaited was the GUI command-forwarding process, not the Promise evaluated in the renderer.

### Failure probes

With the real CLI, both of these exited `0`:

```js
(() => { throw new Error("sync-probe") })()
Promise.reject(new Error("async-probe"))
```

Both wrote `Error: ...` to stdout. Therefore:

- do not use process exit status alone for `eval` assertions;
- avoid `eval` as the main test protocol;
- if `eval` remains as an escape hatch, invoke the CLI with an argv array (no shell), recognize `(no output)` and the `=> ` value prefix, and turn any `Error:` result into a test failure;
- for structured values, explicitly return `JSON.stringify(...)` and parse the result after removing only the documented/observed value prefix. `eval` has no `format=json` option.

The official reference only says `eval` executes JavaScript and returns its result; it does not document error-to-exit-code behavior ([CLI developer commands](https://help.obsidian.md/cli#Developer%20commands)). The exit-status rule above is an empirical contract for Obsidian 1.13.7 and should have a small harness contract test so an app upgrade cannot silently change it.

## Official CLI capabilities relevant to E2E

### Startup and vault targeting

- Obsidian 1.12.7+ installer support is required, and the CLI must be enabled/registered in Settings.
- The desktop app must be running; if it is not, the first CLI command launches it.
- If the shell's working directory is a vault, that vault is the default. Otherwise the active vault is used.
- Deterministic automation should always put `vault=<name-or-id>` first. A vault ID is safer than a display name when names can collide.
- `vaults verbose`, `vault`, and `vault info=path` can validate that the CLI routed to the expected vault before any mutation.
- The CLI exposes `reload` (window reload) and `restart` (app restart), but the documentation does not define a post-restart readiness handshake. A controller must reconnect/poll a health command after either.

Sources: [official CLI docs](https://help.obsidian.md/cli), [official Obsidian URI docs](https://help.obsidian.md/uri), [Kepano skill](https://github.com/kepano/obsidian-skills/blob/main/skills/obsidian-cli/SKILL.md).

### Plugin lifecycle commands

The CLI has:

- `plugin id=<id>` for plugin metadata and enabled state;
- `plugins` / `plugins:enabled`, including `format=json|tsv|csv`;
- `plugin:enable`, `plugin:disable`, and developer-only `plugin:reload`;
- `plugins:restrict` for restricted mode.

These are useful lifecycle controls, but none is documented as waiting for plugin-specific background initialization. Obsidian's plugin lifecycle contract says `onload()` configures the plugin and `onunload()` releases its resources. The lifecycle guide explicitly warns that unmanaged event listeners, timers, workers, and other resources survive unload and become orphaned callbacks; `registerEvent`, `registerInterval`, `registerDomEvent`, and child `Component`s provide automatic teardown ([plugin lifecycle guide](https://docs.obsidian.md/Plugins/Guides/Manage+plugin+lifecycle), [plugin anatomy](https://docs.obsidian.md/Plugins/Getting+started/Anatomy+of+a+plugin)).

Textfresser's `onload()` starts `initWhenObsidianIsReady()` with `void` and then returns. That makes a plugin-owned readiness protocol mandatory even if `plugin:reload` itself is correctly awaited.

### First-class plugin CLI handlers

Obsidian 1.12.2 added `Plugin.registerCliHandler(command, description, flags, handler)`. Command IDs are globally unique; the recommended naming is `<plugin-id>` for a default command and `<plugin-id>:<action>` for subcommands. Crucially, the handler type is:

```ts
type CliHandler = (params: CliData) => string | Promise<string>;
```

Sources: [registerCliHandler reference](https://docs.obsidian.md/Reference/TypeScript+API/Plugin/registerCliHandler), [CliHandler reference](https://docs.obsidian.md/Reference/TypeScript+API/CliHandler), [first-party source](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Reference/TypeScript%20API/Plugin/registerCliHandler.md).

This is the cleanest transport for an E2E control plane. Register handlers synchronously during `onload`, but let their returned Promises await the plugin's stable `ready`/`idle` barriers. The CLI then performs the cross-process waiting; no `window` state registry or polling loop is needed.

### Output support

JSON is command-specific, not a global output mode. Examples with a `format=json` option include `plugins`, `plugins:enabled`, `bookmarks`, `backlinks`, `hotkeys`, search, tasks, and Bases queries. Other commands return text, and `eval` prints values with its own representation. A custom plugin CLI handler returns a string, so the harness can standardize on one JSON envelope, for example:

```json
{"protocol":1,"ok":true,"instanceId":"...","generation":4,"value":{}}
```

On expected protocol failures, return `ok:false` in the same envelope and let the Bun controller fail the test. This avoids relying on the CLI's current zero exit code for evaluated errors.

### Debugging and failure artifacts

The official CLI exposes:

- `dev:errors` and `dev:errors clear`;
- `dev:debug on|off` to attach/detach the Chrome DevTools Protocol debugger;
- `dev:console` with level and limit filters (console capture requires the debugger to be attached in the local 1.13.7 probe);
- `dev:cdp method=<...> params=<json>`;
- `dev:screenshot path=<file>`;
- `dev:dom`, `dev:css`, `dev:mobile`, and `devtools`.

The first-party skill recommends the development loop `plugin:reload` -> `dev:errors` -> screenshot/DOM inspection -> `dev:console` ([Kepano skill](https://github.com/kepano/obsidian-skills/blob/main/skills/obsidian-cli/SKILL.md)). For automated tests, enable debugger capture once at suite startup, clear buffers before each test, and collect errors, console, screenshot, plugin protocol status, vault path, app version, build hash, and fixture tree only on failure. This gives high-signal diagnostics without flooding normal output.

## Headless and CI constraints

Obsidian distinguishes two products:

- **Obsidian CLI** controls the desktop app.
- **Obsidian Headless** is a standalone client for Obsidian services, currently Sync and Publish.

Obsidian Headless does not load community plugins or provide the desktop `app`/DOM runtime, so it cannot execute Textfresser E2E tests ([Obsidian Headless docs](https://help.obsidian.md/headless), [first-party source Markdown](https://github.com/obsidianmd/obsidian-help/blob/master/en/Extending%20Obsidian/Obsidian%20Headless.md)).

The official docs do not describe an isolated profile/user-data flag, a way to launch or address multiple independent desktop instances, a no-UI plugin runner, or a CI image. The documented global CLI surface exposes only `vault=<name-or-id>` routing. Consequently:

- call this a desktop-host E2E suite, not a headless suite;
- run it in a dedicated logged-in OS session/host, not against a developer's personal Obsidian process;
- serialize tests within a vault;
- if parallelism is ever introduced, give each worker a separate known vault and assume they still share one desktop process unless the host isolation is also separate;
- do not infer isolation merely from `vault=` routing.

## File watching and reload behavior

The official development workflow says source changes require a plugin reload. It documents toggle-off/toggle-on, and recommends the third-party Hot-Reload plugin for automatic reload on source changes ([development workflow](https://docs.obsidian.md/Plugins/Getting+started/Development+workflow)). It does **not** document a stable built-in debounce interval or promise that writing `main.js` automatically reloads an enabled plugin.

Therefore the current observed sequence — artifact copy, explicit reload, then a delayed second reload — should be treated as an implementation detail or environmental effect, not modeled with a magic six-second sleep. A deterministic harness should instead:

1. build once;
2. verify the exact target vault and plugin ID;
3. disable the plugin;
4. deploy `main.js` and `manifest.json` atomically while disabled, ideally before the test Obsidian session starts;
5. enable once;
6. wait on the plugin's own ready command and verify a stable `instanceId` plus expected build hash;
7. never copy artifacts or reload between ordinary test cases.

In CI or on a dedicated host, the strongest version is to seed the test vault and plugin artifacts before launching Obsidian at all. That eliminates the loaded-artifact watcher race rather than timing around it.

## Recommended new harness architecture

### 1. Bun controller using only `obsidian-cli`

Resolve the executable in this order:

1. explicit `OBSIDIAN_CLI_PATH`;
2. `command -v obsidian`;
3. platform-specific documented CLI binary path.

Reject the GUI executable by checking the basename/path or by running a one-time async contract probe. Spawn argv directly, never `sh -c`. Put `vault=<id>` first on every invocation. At session startup assert:

- expected app and installer version;
- expected vault name and absolute path;
- plugin manifest version/build hash;
- only the allowlisted community plugins are enabled.

### 2. E2E-only plugin control plane

Compile a dedicated E2E artifact or guard the control plane behind an explicit E2E build flag. Register namespaced CLI handlers immediately from `onload`, for example:

- `cbcr-text-eater-de:e2e-status` — synchronous state, build hash, instance ID, generation, listener counts, pending work;
- `cbcr-text-eater-de:e2e-ready` — await the single plugin initialization Promise;
- `cbcr-text-eater-de:e2e-reset` — dispose runtime resources, reset fixture state, recreate runtime, increment generation, await readiness;
- `cbcr-text-eater-de:e2e-idle` — await all plugin-owned work and event-pipeline drains;
- `cbcr-text-eater-de:e2e-act` — perform typed test actions when direct public CLI commands are insufficient;
- `cbcr-text-eater-de:e2e-diagnostics` — return a compact JSON state dump.

All return the same versioned JSON envelope. Every mutating command accepts the expected `instanceId` and `generation`; stale callers fail immediately instead of operating on a replacement instance.

### 3. Explicit readiness and quiescence

Create exactly one `readyPromise` per plugin instance. Do not infer readiness from `app.plugins.plugins[id]` existing, a boolean appearing briefly, or a fixed stable-time window.

Likewise, replace generic time sleeps with owned barriers. `e2e-idle` should await the actual task tracker, queued/batched vault observations, healing work, scheduled writes, and disposers. Expiry timers used only to forget self-events should not force every test to sleep through their full TTL; expose a deterministic drain or inject a controllable clock at that layer.

### 4. Isolation without per-test reloads

Use a dedicated vault with Sync disabled and only Textfresser enabled. Run one controller at a time. Enable the plugin once per test session. Before each scenario, call `e2e-reset` to establish a new generation and seed the minimal fixture while the plugin runtime is deliberately paused/disposed. Then run:

```text
reset -> act/mutate -> idle -> assert
```

This makes isolation a plugin protocol property, not an emergent side effect of disable/enable/reload timing. Reserve full disable/deploy/enable for session setup and a small, separate lifecycle smoke test.

### 5. Prefer supported commands over arbitrary `eval`

Use core CLI commands for user-shaped vault operations (`create`, `move`, `delete`, `read`, `files`) and plugin CLI handlers for test coordination. Keep `eval` as a narrow diagnostic escape hatch. This makes command boundaries observable and eliminates shell quoting, injected async IIFEs, global renderer registries, and accidental Promise fire-and-forget.

### 6. Quiet normal path, rich failure path

Normal output should be one line per failed step, not a transcript of polling. On failure, attach:

- controller command and parsed response;
- `e2e-status`/`e2e-diagnostics`;
- `dev:errors`;
- recent error/warn console messages;
- screenshot when UI behavior matters;
- expected/actual fixture tree and changed file contents;
- Obsidian version, vault ID/path, plugin build hash, instance ID, generation.

## Approaches to avoid

- Invoking the GUI executable as if it were the new CLI.
- Treating child-process completion or exit code `0` as proof that evaluated async work succeeded.
- Reloading the plugin in every `beforeEach`.
- Copying `main.js` while the plugin is active.
- Readiness checks based on “plugin object exists” or arbitrary one-second stability windows.
- Generic sleeps standing in for event-pipeline drains.
- Sharing the test vault with unrelated plugins, Sync, manual editing, or overlapping suites.
- Assuming Obsidian Headless can run community plugins.

## Minimal migration order

1. Switch the wrapper from `.../MacOS/Obsidian` to the registered `obsidian-cli` binary and add an async/error contract test.
2. Delete the renderer-global Promise polling workaround after the contract test passes.
3. Add a versioned plugin CLI handler for `status`, `ready`, and `idle`.
4. Move artifact deployment/reload to once-per-session setup.
5. Add protocol-level `reset` with generation/instance fencing; remove per-test reloads and fixed sleeps.
6. Add failure-only diagnostics and a dedicated-host launch/bootstrap script.

## Textfresser-specific architecture synthesis

### Why the current harness is intrinsically noisy

The present harness combines six different responsibilities inside Bun hooks:

- locating or launching a shared Obsidian process;
- copying a build into a live vault;
- disabling, enabling, and reloading the production plugin;
- deleting and reseeding watched filesystem roots;
- providing an asynchronous RPC transport through arbitrary `eval` strings;
- deciding when plugin work is complete.

Those responsibilities do not have a shared completion contract. Setup consequently uses a mix of CLI process completion, renderer globals, a one-second instance stability window, a six-second watcher sleep, Obsidian index polling, a global pending counter, and the VAM Self Event expiry clock.

Concrete failure amplifiers in this repository are:

- `tests/cli-e2e/utils/cli.ts` defaults to the GUI `Obsidian` executable and polls a renderer-global Promise store. If the store disappears, it starts the original operation again, giving mutations accidental at-least-once delivery.
- Ordinary commands are assembled into a string and passed through `sh -c`; only `eval` uses an argv array.
- `tests/cli-e2e/setup.ts` copies artifacts, waits six seconds for a watcher effect, deletes live-vault folders directly on disk, and enables the plugin again.
- `TextEaterPlugin.onload()` launches initialization without awaiting or retaining a cancellable lifecycle task. `onunload()` starts Librarian and VAM teardown with `void`, so a replacement can initialize while the prior instance is still disposing.
- The main Librarian suite is one cumulative state chain. A failure changes the baseline for every later test, and another test file repeats one of its scenarios after performing a second full setup.
- `whenIdle()` observes the current instance only. An orphan listener owned by an earlier instance remains invisible.
- VAM's current deep-settle barrier waits for Self Event entries to be consumed or reach their default five-second expiry. That is valid for a suppression-lifetime test, but far too broad as the completion barrier for every operation.
- Test code monkey-patches deep live Textfresser state and performs many sequential CLI subprocess calls for assertions. There is no host lease or complete teardown.

During this investigation a Librarian E2E run lasted more than five minutes against an Obsidian process that had already been running for eleven days. This is the key environmental fact: the test suite borrows a persistent desktop host instead of owning a test environment.

### Target topology

```text
tests/obsidian-e2e/runner.ts                 outer lifecycle owner
  ├─ acquire exclusive host lease
  ├─ build content-addressed artifact
  ├─ restore immutable vault template while host is stopped
  ├─ install Textfresser + E2E driver plugin before launch
  ├─ launch/attach under an explicit ownership policy
  ├─ await host, vault, driver, and Textfresser readiness
  ├─ spawn bun test with a read-only session manifest
  └─ collect artifacts and tear down in finally/signal handlers
                  |
                  | serialized official obsidian-cli commands
                  v
dedicated Obsidian desktop session + restored test vault
  ├─ production Textfresser artifact
  |    └─ narrow host-test probe (state, receipts, snapshots)
  └─ test-only driver plugin
       └─ one versioned registerCliHandler request interface
```

The outer runner, not `beforeAll`, owns process startup, artifact deployment, failure collection, and teardown. If the Bun test process times out or crashes, the environment still has a parent that can collect evidence and stop the owned host.

### The deep test-environment interface

Scenario tests should learn one small interface:

```ts
await withObsidianScenario(
  { fixture: "library/rename-folder" },
  async ({ act, snapshot }) => {
    await act({
      kind: "renamePath",
      from: "Library/Recipe/Pie/Berry",
      to: "Library/Recipe/Pie/Fruit",
    });

    expect(await snapshot({ root: "Library" })).toEqual(expected);
  },
);
```

`withObsidianScenario` is the external seam. It hides reset, generation fencing, CLI serialization, operation receipts, settling, snapshot normalization, timeouts, and failure artifacts. `act` does not resolve merely because `app.fileManager.renameFile()` resolved: it resolves after the causally related Obsidian event, VAM observation window, Librarian work, descendant Dispatch Batches, and affected-path queryability have completed.

The test should not receive raw `app`, a plugin instance, `eval`, VAM, or Librarian. Tests needing those internals belong at an in-process package seam, not in desktop E2E.

### Prefer a test-only driver plugin

The recommended control plane is a tiny driver plugin installed only in the restored test vault. It registers one namespaced CLI command through `registerCliHandler`, for example:

```text
textfresser-e2e request=<base64url-json-envelope>
```

One command is deeper than separate ad-hoc `ready`, `idle`, `reset`, and mutation transports: the handler accepts a versioned request union and always returns one JSON envelope. It can evolve without teaching the outer process new output conventions.

```ts
type E2ERequest = {
  protocol: 1;
  sessionId: string;
  requestId: string;
  expectedInstanceId?: string;
  method: "status" | "ready" | "reset" | "act" | "snapshot" | "diagnostics";
  params: unknown;
};

type E2EResponse = {
  protocol: 1;
  ok: boolean;
  sessionId: string;
  instanceId: string;
  generation: number;
  value?: unknown;
  error?: { kind: string; message: string; diagnosticsId: string };
};
```

The driver caches bounded responses by `requestId`. A transport retry queries the same request; it must never repeat an ambiguous create, rename, delete, or command. Every mutating request includes the expected Textfresser instance/generation, so an unexpected reload fails immediately instead of being silently accepted as a new stable instance.

Keeping `registerCliHandler` in the driver lets the production plugin retain its current minimum Obsidian version. Textfresser still needs one narrow host-test probe for lifecycle state, causal receipts, and snapshots. That probe should expose values, not private object graphs, and can be gated by an E2E session marker installed before startup. A simpler first implementation may compile handlers directly into an E2E Textfresser artifact, but the companion driver preserves closer production-artifact identity.

### Causal completion, not global idleness

Each action returns an operation receipt:

```ts
type OperationReceipt = {
  operationId: string;
  instanceId: string;
  generation: number;
  startSequence: number;
  settledSequence: number;
  affectedPaths: readonly string[];
};
```

The probe records the operation before triggering the real Obsidian mutation. Related observations and work carry the operation identity, or are accounted for by sequence ranges owned by that receipt. Completion means the originating mutation, matching observations, active subscriber work, resulting Dispatch Batches, and relevant index visibility are done.

Keep a separate `deepStability` operation for the few tests that intentionally verify the complete Self Event suppression lifetime. Do not charge its five-second expiry cost to every scenario.

### Cold install and host ownership

The source-of-truth suite should run in a dedicated logged-in OS session, VM, or CI host where the runner owns Obsidian. The official documentation offers vault routing but no supported isolated-profile or multiple-desktop-instance contract, so `vault=` must not be mistaken for process isolation.

Use a fixed, pre-registered test-vault path for a given dedicated profile. Before each suite or shard, while Obsidian is stopped:

1. restore the path from an immutable template;
2. install `main.js`, `manifest.json`, deterministic settings, the test driver, and enabled-plugin configuration;
3. write a run manifest containing session ID and expected build hash;
4. launch Obsidian and verify `vault info=path`, app version, plugin build hash, and allowlisted plugins;
5. enable once and perform no routine artifact copies or reloads during behavior tests.

Local shared-host mode may remain as a clearly labelled fast smoke mode, protected by the same exclusive lease, but it is not the authoritative environment.

### Control plane and data plane

- **Control plane:** serialized custom CLI requests for readiness, typed actions, receipts, snapshots, and diagnostics.
- **Data plane:** after receipt completion, the runner can read the restored vault directly for content snapshots and diffs. Use a driver snapshot when the assertion concerns Obsidian's in-memory index rather than disk.

One scoped snapshot should replace dozens of `files`, `exists`, and `read` subprocesses:

```ts
type VaultSnapshot = {
  files: readonly { path: string; kind: "md" | "file"; contentHash?: string }[];
  markdown: Readonly<Record<string, string>>;
  lifecycle: ProbeStatus;
  activity: {
    observations: number;
    subscriberFailures: number;
    dispatchFailures: number;
  };
};
```

### Quiet success, rich failure

Normal output should be one concise line per scenario. On any timeout or failure, the runner automatically writes a run artifact directory containing:

- the parsed request/response and timings;
- `dev:errors` and recent warning/error console messages;
- driver/probe lifecycle state, queue depths, listener/subscriber counts, outstanding receipts, and a bounded event trace;
- Obsidian and installer versions, exact vault path/ID, build hash, instance ID, and generation;
- a scoped vault tree/content diff;
- screenshot and optional DOM snapshot for UI scenarios;
- host and CLI stdout/stderr.

This keeps the happy path quiet without throwing away the evidence needed to explain a failure.

### Test taxonomy

| Tier | Purpose | Environment | Expected volume |
| --- | --- | --- | ---: |
| Unit/property | naming, event normalization, Self Event attribution, healing decisions | Bun, deterministic clock | large |
| In-process integration | VAM/Librarian interaction through their documented seams | Bun + deterministic vault adapters | large |
| Desktop-host E2E | Obsidian callback shapes, plugin startup, representative create/rename/move/delete, command integration | managed desktop host + restored vault | small |
| UI smoke | editor selection, command routing, one or two DOM-visible flows | managed host + CLI developer commands/CDP | tiny |
| Provider acceptance | real external model/provider behavior | opt-in dedicated vault and secrets | separate |

Most of the current 000–011 chain should become independent in-process integration scenarios. The desktop lane should retain only representative host contracts: cold startup/initial healing, external create/rename/move/delete, one deterministic Lemma command, one reload/unload lifecycle test, and a minimal UI smoke. Network/provider behavior must not share this deterministic lane.

### Option comparison

| Approach | Determinism | Isolation | Warm speed | Observability | Role |
| --- | ---: | ---: | ---: | ---: | --- |
| Patch the current shared-vault reload harness | low | low | medium | low | retire |
| Real CLI with a long-lived dedicated vault | medium | low–medium | high | high | transitional local smoke |
| Playwright/Electron as the main driver | medium | medium | low | high for UI | reject as primary |
| In-process probe without host ownership | high for synchronization | low | high | high | necessary but insufficient |
| Managed fresh host + official CLI + driver/probe | high | high | medium | high | recommended source of truth |

Playwright or raw CDP can be added later for the tiny UI lane. The official CLI already provides commands, DOM queries, screenshots, captured errors/console, and CDP execution; using a browser automation stack for filesystem/event behavior would add another lifecycle system without improving the core oracle.

### Migration in bounded slices

**Transitional stabilization**

1. Point the wrapper at `obsidian-cli`, fail preflight if it resolves to the GUI executable, and add a small async/error contract probe.
2. Delete the renderer Promise registry and automatic replay path.
3. Use argv arrays and one serialized transport for every command.
4. Add a cross-process host lease; run one suite at a time.
5. Deploy/reload at most once before Bun starts and collect automatic failure diagnostics.

**New environment**

1. Add the outer runner, fixed restored vault template, session manifest, build-hash verification, and failure artifact directory.
2. Add the test-driver plugin with one versioned CLI request command and a minimal Textfresser lifecycle probe.
3. Port one independent folder-rename scenario end to end using a causal receipt and one atomic snapshot. It is the acceptance test for the environment itself.
4. Add reset/generation fencing and port a small host-contract matrix.
5. Add the dedicated reload test and verify the old generation cannot emit observations after unload.
6. Move the long semantic chain to deterministic in-process integration tests.
7. Delete `tests/cli-e2e/setup.ts`, the generic `eval` wrapper, per-test reloads, fixed wait ladders, monkey-patched live state, and the duplicate fast harness.
8. Rewrite `AGENTS.md` and `docs/obsidian-ci.md` only after the replacement command is green on the dedicated host.

The defining rule for the new environment is: **cold-build and cold-install before launch; own the host and vault; run independent stories; use reload only when reload itself is under test.**

## Primary sources

- [Obsidian CLI documentation](https://help.obsidian.md/cli)
- [Obsidian CLI first-party source Markdown](https://github.com/obsidianmd/obsidian-help/blob/master/en/Extending%20Obsidian/Obsidian%20CLI.md)
- [Kepano's first-party Obsidian CLI skill](https://github.com/kepano/obsidian-skills/blob/main/skills/obsidian-cli/SKILL.md)
- [Plugin.registerCliHandler API](https://docs.obsidian.md/Reference/TypeScript+API/Plugin/registerCliHandler)
- [CliHandler API](https://docs.obsidian.md/Reference/TypeScript+API/CliHandler)
- [Manage plugin lifecycle](https://docs.obsidian.md/Plugins/Guides/Manage+plugin+lifecycle)
- [Plugin development workflow](https://docs.obsidian.md/Plugins/Getting+started/Development+workflow)
- [Obsidian Headless](https://help.obsidian.md/headless)
- [Obsidian URI](https://help.obsidian.md/uri)
