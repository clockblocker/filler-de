## Action Manager Implementation Stages

### 1) OpenedFileService + e2e
- Update existing service to new interface (SplitPath everywhere, no business logic).
- Keep pwd/isInActiveView/list/exists/readContent; reuse splitPath helpers.
- E2E: wdio-obsidian drives open/close/rename; assert reads and state.

### 2) BackgroundFileServiceLegacy + e2e
- Headless file ops backing `dispatch`: create/rename/trash/write/process using SplitPath/CoreSplitPath.
- Provide list/exists/readContent helpers used by facade, matching index.ts shapes.
- Maintain recent cache for perf; respect 500-cap queue/backpressure.
- E2E: simulate vault tree; verify list/read/ops and cache behavior.

### 3) Reader + e2e
- Normalized md read helper layered on background service; surface frontmatter/body/meta + version/hash.
- Optional debounce/stale rejection; must still satisfy index.ts `readContent`.
- E2E: markdown variants with/without frontmatter; verify version and stale detection.

### 4) Collapse logic + unit tests
- Dedupe/merge VaultActions before dispatch: rename+write→write dest; create+trash→noop.
- Use weight map from `types/vault-action`; drop lower-weight conflicts.
- Unit tests: matrix rename/write/process/trash/create; ensure idempotent no-ops removed.

### 5) Sorting + unit tests
- Deterministic order by weight (`VaultActionType`), then path depth, then enqueue time.
- Stable sort; ensure folder create precedes file create/rename in same path chain.
- Unit tests: equal priority tie-breaks, folder/file ordering, stability.

### 6) Facade
- Implement interface from `index.ts`: `subscribe`, `dispatch`, read-only helpers (pwd, exists, isInActiveView, list, readContent, getAbstractFile, splitPath overloads).
- `dispatch` applies collapse+sort, enforces cap 500, persists queue in plugin data.
- Validate inputs via zod; surface domain errors (overflow, invalid path, stale version).

### 7) Dispatcher
- Pulls from queue, respects per-file locks; throttle concurrency (default 2).
- Retry/backoff per spec for transient failures; mark terminal failures with reason.
- Notifies subscribers via `subscribe` channel (state transitions).

### 8) Executor
- Executes VaultActions via background service only; never touch workspace APIs.
- Timeouts per action type; cancellation hook.
- Idempotency guard by action key; record result/latency.

### 9) Event adapter
- Convert Obsidian file events to `VaultEvent` (per index.ts union) and feed `subscribe` handlers.
- Normalize payloads with splitPath; ignore self-originated actions via tracker.
- Backpressure: drop or coalesce events when queue near 500.

### 10) Migration
- Versioned plugin-data schema (queue, recents, last-opened).
- Migration runner with backup + dry-run; handles corruption by reset + log.
- Tests: migrate up/down across at least one version; corrupt data path.

## QnA
Q: What storage backend is chosen 
(plugin data, hidden file, in-memory cache)? Backup/restore?
A: plugin data

Q: Max queue size and policy on overflow (drop oldest, reject new, spill to disk)?
A: Cap 500. Drop oldest lowest-priority; reject new if same priority as oldest.

Q: oncurrency model: per-vault, per-action-type, or per-file lock granularity?
A: per-file lock granularity

Q: Retry/backoff parameters and when to surface failures to the user?
A: already in the spec

Q: What telemetry/metrics are required and where persisted?
A: None now

Q: How to mock Obsidian APIs for deterministic e2e without coupling to internals?
A: https://jesse-r-s-hines.github.io/wdio-obsidian-service/wdio-obsidian-service/README.html
