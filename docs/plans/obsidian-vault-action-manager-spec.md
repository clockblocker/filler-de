## Concerns / questions about legacy internals
- Queue conflates opened vs background execution; callers leak that choice. 
Need a facade/dispatcher that routes based on path and file state.

- Action model mixes Create/Update-or-create/Rename/Trash with content ops; 
clearer split between structural actions and content transforms would simplify routing and dedupe.

- Dedupe keys are path-based but ignore extension/type changes;
renames across type (md → non-md) may mis-key.

- No typed normalization of Obsidian paths; 
inconsistent handling of TFile/TFolder/system path → split path.

- Weighting is implicit; 
lacks guarantees around batched folder creation/rename vs file ops, especially across roots.

- Self-event tracking/location unclear in new boundary;
legacy relies on dispatcher registering self to avoid feedback loops.

- Error handling in executor/queue is minimal; 
no retry/backoff or partial failure strategy.

- Missing read-only facade: 
callers still hit BackgroundFileService/OpenedFileService directly, defeating the abstraction goal.

- Routing policy unresolved: when to use opened vs background; need robust detection of visible/active files.
- No cross-root guards (current stance: allow cross-root actions, but keying must keep roots distinct).

## Hight level punks to get right
1) Solidify types & helpers
   - Keep `split-path.ts` with literal discriminants; add `splitPathKey` reused by collapse/dedupe.
   - Ensure `VaultAction` helpers align with split-path types.
   - Dispatcher/executor live entirely inside `obsidian-vault-action-manager` (no Librarian leakage).

2) Collapse logic ✅
   - Implemented `collapseActions(actions: VaultAction[]): Promise<VaultAction[]>` using a per-path Map.
   - **Trash terminality**: Trash wins over all other operations.
   - **Rename**: Drop duplicates with same from→to; latest wins otherwise.
   - **ReplaceContentMdFile**: Latest wins; replaces prior write/process. Merges with CreateMdFile.
   - **ProcessMdFile**: Composes transforms when stacking; applies to ReplaceContentMdFile content if process comes after write.
   - **CreateMdFile + ReplaceContentMdFile**: Merges into CreateMdFile with final content.
   - **Different types on same key**: Trash > Rename > ReplaceContent > Process > Create (newest wins within same type).
   - Comprehensive unit tests covering all scenarios (20 tests passing).

3) Sorting
   - Keep `sortActionsByWeight` and run after collapse; test ordering post-collapse.

4) Facade (`impl/facade.ts`)
   - Implement `ObsidianVaultActionManager` (`subscribe/dispatch/readContent/exists/list/pwd/getAbstractFile/splitPath`).
   - Inject opened + background services, dispatcher, event adapter; use one normalization path for `splitPath`.

5) Dispatcher (`impl/dispatcher.ts`) ✅
   - Accepts actions, runs `collapseActions` then `sortActionsByWeight`.
   - Executes actions sequentially via executor.
   - Returns `DispatchResult = Result<void, DispatchError[]>` with detailed error tracking.
   - Continues executing even if some actions fail (collects all errors).
   - No built-in debounce (callers should batch before calling).

6) Executor (`impl/executor.ts`) ✅
   - Maps `VaultAction` to file ops using `TFileHelper` and `TFolderHelper` directly (no BackgroundFileService).
   - Routes ProcessMdFile/ReplaceContentMdFile based on `OpenedFileService.isFileActive()`.
   - Ensures file exists before processing/writing (creates with empty content for ProcessMdFile, with target content for ReplaceContentMdFile).
   - Returns `Result<void, string>` for each action.
   - Handles both opened (active view) and background operations.

7) Reader (`impl/reader.ts`)
   - `readContent` hard-fails or returns null on non-md targets; `exists`, `list`, `pwd`, `getAbstractFile` routed through opened/background as needed; return typed split paths.

8) Event adapter (`impl/event-adapter.ts`)
   - Obsidian events → `VaultEvent` via `splitPath` overloads; hook in self-event tracking to avoid loops.

9) Migration
   - Keep `DeprecatedVaultActionQueue` unchanged; focus on implementing the new dispatcher/executor first.
   - Legacy services remain but are renamed `Deprecated...` when consumed; migrate callers incrementally to facade.

10) Testing
   - Unit: pure helpers (split-path parsing, collapse rules, sorting, executor mapping with fakes, reader functions).
   - E2E/integration: Obsidian-touching flows (dispatcher + executor path, event adapter mapping from real Obsidian events or closest harness).

## Routing policy (opened vs background)
- **Rule**: If a file is active (in active view), use `OpenedFileService` to preserve cursor/scroll/dirty state; otherwise use `TFileHelper`/`TFolderHelper` (background).
- **Detection**: `OpenedFileService.isFileActive(splitPath)` returns `Result<boolean, string>`.
- **Executor responsibility**: Checks `isFileActive()` for ProcessMdFile and ReplaceContentMdFile, routes accordingly.
- **File existence**: Executor ensures file exists before processing/writing:
  - ProcessMdFile: Creates with empty content if missing
  - ReplaceContentMdFile: Creates with target content if missing (optimized)
- **Parent folders**: `vault.create()` automatically creates parent folders (Obsidian API).

## Cross-root stance
- No guardrails: actions may span roots; include root in keys but do not block cross-root operations.

## Queue timing policy
- **Call Stack + Event Queue Pattern**: Queue by default, but execute immediately if call stack is empty.
- All `dispatch()` calls go to queue.
- If nothing executing → execute immediately.
- If executing → queue actions, execute when current batch completes.
- When batch completes → check queue, execute next batch if available.
- Max 10 batches (unlimited actions per batch).
- Dispatcher handles collapse + sort when batch is executed.

## Path encoding
- Implement our own split/encode logic (no legacy reuse) inside `split-path.ts`; all conversions flow through manager APIs.

## Error handling
- **Executor**: Returns `Result<void, string>` for each action. No retry/backoff (caller responsibility).
- **Dispatcher**: Returns `DispatchResult = Result<void, DispatchError[]>` where `DispatchError` contains:
  - `action: VaultAction` - The action that failed
  - `error: string` - The error message
- Continues executing remaining actions even if some fail (collects all errors).
- **Facade**: `dispatch()` returns `Promise<DispatchResult>` - errors returned to caller, not thrown.
- No automatic re-dispatch; caller decides: retry, log, ignore, etc.

## Event adapter: self-event tracking and burst handling
- **Self-event tracking**: Inject `SelfEventTracker` to register actions we dispatch.
  - Track system paths (normalized) for ALL action types (folders, files, md files).
  - For renames: track both `from` and `to` paths.
  - Path-based matching: Obsidian events matched against tracked paths.
  - TTL: 5s with pop-on-match (one-time use per path).
  - **Goal**: Only user-triggered events reach subscribers. None of our dispatched actions emit events.
- **Event emission**: Immediate emit to subscribers (no debouncing).
  - User-triggered events → emit immediately.
  - Self-events → filtered out before emission.
  - Subscribers handle batching if needed.

## Proposed file structure
- `src/obsidian-vault-action-manager/`
  - `index.ts`: public interface/types (`VaultEvent`, manager interface, splitPath overloads)
  - `types/`
    - `split-path.ts`: schemas/types for split paths
    - `literals.ts`: op/entity literals
    - `vault-action.ts`: action types, weights, helpers (`getActionKey`, `getActionTargetPath`, `sortActions`)
  - `impl/`
    - `facade.ts`: implements `ObsidianVaultActionManager` (composes reader + dispatcher + queue)
    - `action-queue.ts`: **NEW** - Call stack + event queue pattern (queue by default, execute if idle)
    - `self-event-tracker.ts`: **NEW** - Tracks dispatched actions, filters self-events
    - `event-adapter.ts`: Obsidian event → `VaultEvent` (with self-event filtering)
    - `dispatcher.ts`: applies collapse + sort, executes via executor, returns `DispatchResult`
    - `collapse.ts`: `collapseActions` (coalesce per-path with merge rules)
    - `executor.ts`: maps `VaultAction` to `TFileHelper`/`TFolderHelper`/`OpenedFileService`, handles file existence
    - `reader.ts`: read-only ops (`read/exists/list/pwd`) with routing
    - `split-path.ts`: path conversion utilities

## Current Architecture Flow

```
User Code
  ↓
ObsidianVaultActionManager.dispatch(actions)
  ↓
ActionQueue.dispatch(actions)
  ├── Add to queue (FIFO)
  ├── If call stack empty → execute immediately
  └── If call stack busy → queue, execute when current batch completes
  ↓
ActionQueue.executeNextBatch()
  ├── Take batch from queue (unlimited actions)
  ├── SelfEventTracker.register(batch) → track paths
  └── Dispatcher.dispatch(batch)
      ├── collapseActions(batch) → removes duplicates, composes transforms
      ├── sortActionsByWeight(collapsed) → orders by weight + path depth
      └── for each action:
          └── Executor.execute(action)
              ├── Check if file exists (ProcessMdFile/ReplaceContentMdFile)
              ├── Check if file is active (OpenedFileService.isFileActive)
              └── Route to:
                  ├── OpenedFileService (if active) → preserves cursor/scroll
                  └── TFileHelper/TFolderHelper (if background) → direct vault ops
              └── Return Result<void, string>
  ↓
DispatchResult = Result<void, DispatchError[]>
  ├── ok(undefined) if all succeeded
  └── err([{action, error}, ...]) if any failed
  ↓
When batch completes:
  ├── Check queue for more actions
  └── If more → execute next batch (recursive)
  └── If empty → set isExecuting = false

User Action (Obsidian)
  ↓
EventAdapter receives Obsidian event
  ├── SelfEventTracker.shouldIgnore(path)? → YES → filter out
  └── SelfEventTracker.shouldIgnore(path)? → NO → emit to subscribers
  ↓
VaultEvent → subscribers notified (only user-triggered events)
```

### Key Design Decisions

1. **No BackgroundFileService**: Executor uses `TFileHelper`/`TFolderHelper` directly
2. **File Existence**: Executor ensures files exist before processing/writing
3. **Error Collection**: Dispatcher collects all errors, doesn't stop on first failure
4. **Collapse First**: Collapse happens before sorting to minimize operations
5. **Sequential Execution**: Actions execute one by one (no parallel execution)

### Implementation Status

✅ **Completed:**
1) OpenedFileService + e2e
2) TFileHelper + TFolderHelper (no BackgroundFileService wrapper needed)
3) Reader + e2e
4) Collapse logic + unit tests (20 tests passing)
5) Sorting + unit tests
6) Facade (partial)
7) Dispatcher ✅ (returns DispatchResult with error tracking)
8) Executor ✅ (routes opened vs background, ensures file existence)

🚧 **In Progress:**
9) Event adapter
10) Migration

### Implementation Details

**Executor (`impl/executor.ts`):**
- Uses `TFileHelper` and `TFolderHelper` directly (no BackgroundFileService wrapper)
- Uses `OpenedFileService` for active files
- Checks `isFileActive()` to route ProcessMdFile/ReplaceContentMdFile
- Ensures file exists before processing/writing
- Returns `Result<void, string>` per action

**Dispatcher (`impl/dispatcher.ts`):**
- Collapses actions via `collapseActions()`
- Sorts via `sortActionsByWeight()`
- Executes sequentially
- Collects all errors
- Returns `DispatchResult = Result<void, DispatchError[]>`

**Collapse (`impl/collapse.ts`):**
- Comprehensive collapse rules (see [collapse-actions-spec.md](./collapse-actions-spec.md))
- Handles ProcessMdFile composition, ReplaceContentMdFile precedence, Trash terminality
- All 20 unit tests passing
