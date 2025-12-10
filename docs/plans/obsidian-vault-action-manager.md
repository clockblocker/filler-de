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

## Implementation plan
1) Solidify types & helpers
   - Keep `split-path.ts` with literal discriminants; add `splitPathKey` reused by collapse/dedupe.
   - Ensure `VaultAction` helpers align with split-path types.

2) Collapse logic
   - Implement `collapseActions(actions: VaultAction[]): VaultAction[]` using a per-path Map.
   - Rename: drop duplicates with same from→to; latest wins otherwise.
   - Write (full rewrite): latest wins; replace any prior write/process on that key.
   - ProcessMdFile (pure transform): compose transforms when stacking processes; if mixed with write, write wins over earlier processes; later process can wrap the latest write only if it follows the write.
   - Different types on same key: prefer newest; document the rule.
   - Add unit tests for rename dedupe, write overwrite, process composition, mixed write+process.

3) Sorting
   - Keep `sortActionsByWeight` and run after collapse; test ordering post-collapse.

4) Facade (`impl/facade.ts`)
   - Implement `ObsidianVaultActionManager` (`subscribe/dispatch/readContent/exists/list/pwd/getAbstractFile/splitPath`).
   - Inject opened + background services, dispatcher, event adapter; use one normalization path for `splitPath`.

5) Dispatcher (`impl/dispatcher.ts`)
   - Accept actions, run collapse then sort, forward to executor.
   - Manage debounce/timing (or wrap legacy queue) but keep new surface.

6) Executor (`impl/executor.ts`)
   - Map `VaultAction` to file ops using manager-owned file services (legacy services renamed `Deprecated...`).
   - For ProcessMdFile, read once, compose transforms, write back; ensure single open per collapsed action.

7) Reader (`impl/reader.ts`)
   - `readContent` hard-fails or returns null on non-md targets; `exists`, `list`, `pwd`, `getAbstractFile` routed through opened/background as needed; return typed split paths.

8) Event adapter (`impl/event-adapter.ts`)
   - Obsidian events → `VaultEvent` via `splitPath` overloads; hook in self-event tracking to avoid loops.

9) Migration
   - Keep `DeprecatedVaultActionQueue` for compatibility; new dispatcher wraps/extends behavior.
   - Legacy services remain but are renamed `Deprecated...` when consumed; migrate callers incrementally to facade.

10) Testing
   - Unit: split-path parsing, collapse rules, sorting, executor mapping with fakes, reader functions.
   - Integration: dispatcher + executor with fake executor capturing ordered calls; event adapter mapping from mocked Obsidian events.

## Routing policy (opened vs background)
- Rule: if a file is open/visible, use `OpenedFileService` to preserve cursor/scroll/dirty state; otherwise use `BackgroundFileService`.
- Detection lives in `OpenedFileService` (e.g., `isOpen/isVisible` using Obsidian API); executor queries it per action.
- Apply to write/process/rename/delete; opened service responsible for restoring view state as needed.

## Cross-root stance
- No guardrails: actions may span roots; include root in keys but do not block cross-root operations.

## Queue timing policy
- Default: `dispatch` flushes immediately after collapse+sort; no built-in debounce.
- Guidance: callers should batch before calling `dispatch` to avoid extra flushes; `collapseActions` still dedupes within each dispatch call.

## Path encoding
- Implement our own split/encode logic (no legacy reuse) inside `split-path.ts`; all conversions flow through manager APIs.

## Error handling
- Executor uses simple retry/backoff; on failure return list of unsuccessful actions with errors.
- No automatic re-dispatch; caller may choose to retry.

## Event adapter: self-event tracking and burst handling
- Self-event options:
  - Inject a `SelfEventTracker` to register actions we trigger and drop matching Obsidian events.
  - Or tag actions with IDs and ignore events carrying those IDs (if Obsidian API allows metadata; likely not).
  - Minimal: path-based ignore list with short TTL.
- Burst handling options:
  - Immediate emit to dispatcher (simplest; relies on collapseActions).
  - Debounce per root/path (e.g., 50–200 ms) before emitting `VaultEvent` batch.
  - Small buffer with max delay: collect events for N ms or until M events, then emit batch to dispatcher.
- Desision: Inject `SelfEventTracker` and emit immediately (collapse handles dupes); add optional per-path debounce later only if needed.

## Proposed file structure
- `src/obsidian-vault-action-manager/`
  - `index.ts`: public interface/types (`VaultEvent`, manager interface, splitPath overloads)
  - `types/`
    - `split-path.ts`: schemas/types for split paths
    - `literals.ts`: op/entity literals
    - `vault-action.ts`: action types, weights, helpers (`getActionKey`, `getActionTargetPath`, `sortActions`)
  - `impl/`
    - `facade.ts`: implements `ObsidianVaultActionManager` (composes reader + dispatcher)
    - `event-adapter.ts`: Obsidian event → `VaultEvent`
    - `dispatcher.ts`: applies collapse + sort, routes to executor (opened vs background)
    - `collapse.ts`: `collapseActions` (coalesce per-path with merge rules)
  - `executor.ts`: bridges to manager-owned file services (new impl); legacy services renamed to `Deprecated...`
  - `reader.ts`: read-only ops (`read/exists/list/pwd`) with routing
