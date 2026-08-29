# VaultActionManager — Architecture

> **Scope**: This document covers the VaultActionManager (VAM) — the file system abstraction layer used by all other managers and commanders. For the vocabulary/dictionary subsystem, see `textfresser-architecture.md`. For tree/healing/codex, see the Librarian docs. For E2E testing, see `e2e-architecture.md`.
>
> **Compatibility Policy (Dev Mode, 2026-02-20)**:
> - Textfresser is treated as green-field. Breaking changes are allowed; no backward-compatibility guarantees for Textfresser note formats, schemas, or intermediate contracts.
> - Librarian and VAM are stability-critical infrastructure. Changes there require conservative rollout, migration planning when persisted contracts change, and explicit regression coverage.
>
> **Decisions**: [ADR-0001](../../docs/adr/0001-use-vam-as-the-librarians-obsidian-boundary.md), [ADR-0002](../../docs/adr/0002-coalesce-obsidian-callbacks-into-bulk-vault-events.md)

---

## 1. Purpose

VaultActionManager is a **dependency-aware file system coordination boundary** over Obsidian's Vault API. It solves three core problems:

1. **Batched, dependency-aware execution** — callers submit a batch of file operations; VAM collapses redundant ops, sorts by dependency, and executes sequentially.
2. **Feedback loop prevention** — when we dispatch actions, Obsidian emits events. VAM filters its own events out so downstream subscribers only see user-triggered changes.
3. **Type-safe path abstraction** — replaces string paths with `SplitPath` discriminated unions, preventing category confusion (folder vs file vs markdown file).

**Consumers**: Librarian (healing, codex generation), Textfresser (vocabulary commands), UserEventInterceptor (wikilink tracking).

---

## 2. Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────────┐
│  Public Interface (VaultActionManager)                                    │
│    dispatch() · subscribeToBulk()                                        │
│    readContent() · exists() · selection intent · navigation intent       │
├───────────────────────────────────────────────────────────────────────────┤
│  Facade (VaultActionManagerImpl)                                          │
│    ├─ DispatchBatchCoordinator → plan → schedule → execute → attribute   │
│    ├─ VaultObservation      → attribute → window → collapse → roots      │
│    ├─ MarkdownFileAccess    → active/background routing                  │
│    ├─ SelfEventTracker      → shared by dispatch + event pipelines       │
│    ├─ VaultReader           → read-only vault operations                 │
│    └─ TestingAdapter        → readiness over the real object graph       │
├───────────────────────────────────────────────────────────────────────────┤
│  File Services                                                            │
│    ├─ MarkdownFileAccess    → the routing module                         │
│    ├─ ActiveFileService     → active-editor adapter                      │
│    │   ├─ ActiveFileReader  → getContent, pwd, isFileActive              │
│    │   ├─ ActiveFileWriter  → replaceAllContent, processContent          │
│    │   ├─ SelectionService  → getInfo (text, surroundingBlock, path)     │
│    │   └─ cd()              → navigate to file (open in editor)          │
│    └─ Background-vault adapter                                            │
│        ├─ TFileHelper       → create, rename, trash, read, upsert files  │
│        └─ TFolderHelper     → create, rename, trash folders              │
├───────────────────────────────────────────────────────────────────────────┤
│  Types                                                                    │
│    ├─ SplitPath             → discriminated union (Folder | File | MdFile)│
│    ├─ VaultAction           → 10 action kinds (dispatch input)           │
│    ├─ VaultEvent            → 6 event kinds (Obsidian output)            │
│    └─ DependencyGraph       → Kahn's algorithm input                     │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. SplitPath — The Core Abstraction

**Source**: `types/split-path.ts`

SplitPath replaces raw string paths with a Zod-validated discriminated union:

```typescript
type SplitPathToFolder = { kind: "Folder"; basename: string; pathParts: string[] }
type SplitPathToFile   = { kind: "File";   basename: string; pathParts: string[]; extension: string }
type SplitPathToMdFile = { kind: "MdFile"; basename: string; pathParts: string[]; extension: "md" }

type AnySplitPath = SplitPathToFolder | SplitPathToFile | SplitPathToMdFile
type SplitPathFromTo<T> = { from: T; to: T }
```

**Example**: File at `Library/parent/child/NoteName-child-parent.md`:

```typescript
{
  kind: "MdFile",
  basename: "NoteName-child-parent",
  pathParts: ["Library", "parent", "child"],
  extension: "md"
}
```

**Benefits**:
- Can't pass a folder where a file is expected (compile-time)
- Lossless round-trip: `SplitPath ↔ system path string ↔ TAbstractFile`
- Path parts accessible for tree navigation without string splitting

**Internal-only variants**: `SplitPathWithTRef` adds a `tRef: TFile | TFolder` field for internal VAM use. These are **not exported** — external code uses `SplitPathWithReader` (attaches a `read()` function instead of a stale `TFile` reference).

**Codecs** (in `helpers/pathfinder/`):
- `splitPathFromAbstract(tAbstractFile)` → `AnySplitPath`
- `systemPathFromSplitPath(splitPath)` → `string`
- `makeSplitPath(pathString)` → `AnySplitPath`

---

## 4. VaultAction — The Command Vocabulary

**Source**: `types/vault-action.ts`, `types/literals.ts`

Actions are the input to `dispatch()`. They are a discriminated union of 10 kinds, built from operation × target combinations:

| Target | Operations | Action Kinds |
|--------|-----------|-------------|
| **Folder** | Create, Rename, Trash | `CreateFolder`, `RenameFolder`, `TrashFolder` |
| **File** | Create, Rename, Trash | `CreateFile`, `RenameFile`, `TrashFile` |
| **MdFile** | Upsert, Process, Rename, Trash | `UpsertMdFile`, `ProcessMdFile`, `RenameMdFile`, `TrashMdFile` |

Action kind names are composed at the type level from Zod literal schemas (`CREATE + FOLDER → "CreateFolder"`).

### 4.1 Special Action Semantics

**`UpsertMdFile`** — create-or-update with three content modes:
- `content: "..."` → write content (create if missing, overwrite if exists)
- `content: null` or `undefined` → **EnsureExist**: create with empty content if missing, don't overwrite existing. This is the idempotent "make sure file is there" mode, used by `ensureAllRequirementsMet()` and propagation steps.
- `content: ""` → create with explicitly empty content

**`ProcessMdFile`** — read-modify-write with two input forms:
- `{ splitPath, transform: (content: string) => string | Promise<string> }` — arbitrary transform function
- `{ splitPath, before: string, after: string }` — normalized to `content.replace(before, after)` by executor

The `transform` form supports async transforms. Multiple ProcessMdFile actions on the same file are **composed** during collapse (see section 6.3).

### 4.2 Payload Types

```typescript
// Folder
CreateFolderPayload  = { splitPath: SplitPathToFolder; content?: string }
RenameFolderPayload  = { from: SplitPathToFolder; to: SplitPathToFolder }
TrashFolderPayload   = { splitPath: SplitPathToFolder }

// File
CreateFilePayload    = { splitPath: SplitPathToFile; content?: string }
RenameFilePayload    = { from: SplitPathToFile; to: SplitPathToFile }
TrashFilePayload     = { splitPath: SplitPathToFile }

// MdFile
UpsertMdFilePayload  = { splitPath: SplitPathToMdFile; content?: string | null }
ProcessMdFilePayload = { splitPath: SplitPathToMdFile; transform: Transform }
                     | { splitPath: SplitPathToMdFile; before: string; after: string }
RenameMdFilePayload  = { from: SplitPathToMdFile; to: SplitPathToMdFile }
TrashMdFilePayload   = { splitPath: SplitPathToMdFile }
```

---

## 5. VaultEvent — Obsidian's Output

**Source**: `types/vault-event.ts`

VaultEvents mirror Obsidian's `vault.on("create" | "rename" | "delete")` callbacks, encoded with SplitPath types:

| Event Kind | Shape |
|-----------|-------|
| `FileCreated` | `{ splitPath: SplitPathToFile \| SplitPathToMdFile }` |
| `FileRenamed` | `{ from: SplitPathToFile \| SplitPathToMdFile; to: ... }` |
| `FileDeleted` | `{ splitPath: SplitPathToFile \| SplitPathToMdFile }` |
| `FolderCreated` | `{ splitPath: SplitPathToFolder }` |
| `FolderRenamed` | `{ from: SplitPathToFolder; to: SplitPathToFolder }` |
| `FolderDeleted` | `{ splitPath: SplitPathToFolder }` |

Event kind names are composed: `FILE + RENAME + "d" → "FileRenamed"`.

**Encoding**: `vault-events-for-events.ts` converts raw `TAbstractFile` + `oldPath` from Obsidian into typed `VaultEvent`. The rename encoder validates both old and new paths have matching types (rejects mixed folder↔file renames).

---

## 6. The Dispatch Pipeline

The heart of VAM. When a consumer calls `vam.dispatch(actions)`, the actions flow through a multi-stage pipeline before reaching the Obsidian Vault API.

```
dispatch(actions[])
    ↓
DispatchBatchCoordinator
    │
    ├─ 1. ensureRequirements()           [filter + expand]
    ├─ 2. collapseActions()              [dedupe + compose]
    ├─ 3. buildDependencyGraph()         [DAG construction]
    ├─ 4. topologicalSort()              [Kahn's algorithm]
    ├─ 5. selfEventTracker.register()    [mark paths before execution]
    └─ 6. sequential execution           [Executor → Obsidian API]
         ↓
    caller-owned DispatchResult (ok | err with DispatchError[])
```

### 6.1 Dispatch Batch Coordination

**Source**: `impl/actions-processing/dispatch-batch.ts`

`DispatchBatchCoordinator` is the deep module for outbound Vault Actions. Its interface is one method:

```typescript
dispatch(actions: readonly VaultAction[]): Promise<DispatchResult>
```

Planning helpers and the executor are internal seams. Callers do not coordinate queue state, requirement expansion, collapse, dependency ordering, Self Event registration, or partial-failure accounting.

**Key properties**:
- **Submission identity**: each `dispatch()` call remains a distinct batch, even when it queues behind another batch.
- **Caller-owned results**: an error is returned to the caller whose submitted batch produced it. A later failure cannot turn an earlier result into an error, and queued callers never receive unconditional success.
- **Serial execution**: submitted batches drain FIFO to avoid interleaving Vault mutations.
- **Overflow accounting**: every dropped submitted batch receives its own `DispatchError`; no waiter is left unresolved.
- **Observable idleness**: the testing adapter waits on the coordinator without exposing queue state on the production interface.

### 6.2 Stage 1: Ensure Requirements

**Source**: `impl/actions-processing/ensure-requirements-helpers.ts`

Two-phase validation ensuring the executor can assume all prerequisites exist:

**Phase A — Filter invalid deletes**:
```
For each Trash action:
    if target doesn't exist → drop from batch
```

**Phase B — Auto-insert prerequisites**:
```
For each non-Trash action:
    Extract all parent folder paths from splitPath.pathParts
    For rename actions: extract parents from "to" path
    For ProcessMdFile: also ensure the file itself exists

For each required path:
    if path is being trashed → skip (Trash wins)
    if path doesn't exist AND no action already creates it → add:
        CreateFolder (for folders)
        UpsertMdFile(content: null) (for files — EnsureExist mode)
```

**Performance**: Existence checks are cached in-memory (`checkedFolders`, `checkedFiles` sets) to avoid redundant Obsidian API calls within the same batch. "Already in batch" checks use `buildActionKeyIndex()` which pre-computes `Set<string>` indexes for O(1) lookups instead of linear scans.

**INVARIANT**: After `ensureAllRequirementsMet()`, executor can assume all parent folders exist and all ProcessMdFile targets exist.

### 6.3 Stage 2: Collapse

**Source**: `impl/actions-processing/collapse.ts`

Deduplicates and merges actions targeting the same path into a minimal set. Uses `makeKeyForAction()` to group by source path (for renames: `from` path; for others: `splitPath`).

**Data structures**:
- `byPath: Map<string, VaultAction>` — primary action per path
- `additionalActions: Set<VaultAction>` — secondary ProcessMdFile actions that must run alongside the primary

**Rules (in order of precedence)**:

| Scenario | Behavior |
|----------|----------|
| **Trash wins** | Trash action replaces any existing action for the path. Any additional ProcessMdFile for same key is deleted. |
| **Existing is Trash** | New non-Trash action for a trashed path is dropped. |
| **Rename dedup** | Exact same from→to rename is dropped. Otherwise latest rename wins. |
| **Process + Process** | Transforms composed: `combined(content) = action(existing(content))`. Chained in order. Async-safe. |
| **UpsertMdFile(null) + Process** | Both kept: UpsertMdFile in map, ProcessMdFile in additionalActions. (EnsureExist first, then modify.) If multiple processes, they're composed in additionalActions. |
| **UpsertMdFile(content) + Process** | Transform applied to content eagerly: `byPath.set(key, Upsert(transform(content)))`. Process discarded. |
| **Process + UpsertMdFile(content)** | Upsert(content) wins, Process discarded. |
| **Process + UpsertMdFile(null)** | Both kept: UpsertMdFile(null) replaces Process in map, Process moves to additionalActions. |
| **UpsertMdFile + UpsertMdFile** | `null` content (EnsureExist) yields to contentful; between two contentful, latest wins. |
| **Default** | Latest wins for all other action types. |

**Result**: `[...byPath.values(), ...additionalActions]`

### 6.4 Stage 3: Dependency Graph

**Source**: `impl/actions-processing/dependency-detector.ts`

Builds a bidirectional dependency DAG:

```typescript
type ActionDependency = {
    action: VaultAction;
    dependsOn: VaultAction[];    // must execute AFTER these
    requiredBy: VaultAction[];   // these wait for this one (inverse edges)
};
type DependencyGraph = Map<string, ActionDependency>;
```

**Graph key format**: `"${actionKind}:${systemPath}"` (e.g., `"UpsertMdFile:Library/Worter/Haus.md"`).

**Dependency rules**:

| Action Kind | Depends On |
|------------|-----------|
| `ProcessMdFile` | `UpsertMdFile` for same file (path-based) + parent folder creators |
| `UpsertMdFile`, `CreateFile` | Parent folder creators |
| `RenameFolder`, `RenameFile`, `RenameMdFile` | Parent folder creators **of destination** (`to` path) |
| `CreateFolder` | Parent folder creators |
| `TrashFolder`, `TrashFile`, `TrashMdFile` | **Nothing** (no dependencies) |

**Folder creators**: `CreateFolder` at a path, or `RenameFolder` whose `to` path creates the folder. Both are indexed by path-based key for O(1) lookup.

**Parent folder dependency resolution**: For each parent folder in the `pathParts` array, checks if a folder-creating action exists in the batch for that exact path.

### 6.5 Stage 4: Topological Sort

**Source**: `impl/actions-processing/topological-sort.ts`

Kahn's algorithm with path-depth tie-breaking:

```
1. Compute in-degree for each action (count of dependsOn entries)
2. Queue all zero-degree actions
3. Sort queue by path depth (shallow first)
4. While queue non-empty:
     Pop action → add to sorted output → mark processed
     For each action that depends on this one:
         Decrement in-degree
         If in-degree reaches 0 → add to queue, re-sort
5. If sorted.length !== actions.length → cycle detected (throws)
```

**Path depth** = `splitPath.pathParts.length` (for renames: uses `to` path depth).

**Why depth tie-breaking**: Ensures parent folders are created before children even when there's no explicit dependency edge (belt-and-suspenders alongside the explicit dependency graph).

### 6.6 Stage 5: Self-Event Registration

Before any execution, the dispatcher registers ALL sorted action paths with the `SelfEventTracker`:

```typescript
this.selfEventTracker.register(sorted);
```

**Why before execution**: If registration happened per-action during execution, earlier actions could pop paths that later actions need. Registering upfront prevents cross-action event filtering bugs.

See section 8 for full SelfEventTracker details.

### 6.7 Stage 6: Sequential Execution

**Source**: `impl/actions-processing/executor.ts`

For each action in sorted order, calls the appropriate Obsidian API:

| Action Kind | Execution |
|------------|-----------|
| `CreateFolder` | `tfolderHelper.createFolder()` |
| `RenameFolder` | `tfolderHelper.renameFolder({from, to})` |
| `TrashFolder` | `tfolderHelper.trashFolder()` |
| `CreateFile` | `vault.create(systemPath, content)` |
| `UpsertMdFile` | If exists: check `content`. If `null`/`undefined` → no-op (EnsureExist). Otherwise → `replaceAllContent()` or `replaceAllContentInActiveFile()` depending on active state. If not exists → `tfileHelper.upsertMdFile()`. |
| `RenameFile`, `RenameMdFile` | `tfileHelper.renameFile()` with inline title selection save/restore (50ms delay for Obsidian view update) |
| `TrashFile`, `TrashMdFile` | `tfileHelper.trashFile()` |
| `ProcessMdFile` | Normalize `before/after` to transform. If active → `active.processContent()`. Otherwise → `tfileHelper.processContent()`. |

**Active file routing**: For `UpsertMdFile` and `ProcessMdFile`, executor asks `MarkdownFileAccess` to perform the operation. `MarkdownFileAccess` chooses the active-editor or background-vault adapter and owns selection preservation around renames.

**Error handling**: Errors are **accumulated**, not thrown. The submitted batch returns `err(DispatchError[])` if any action fails, but all planned actions in that batch are attempted. Planning exceptions are also converted into an attributed `DispatchError`, so caller promises never hang.

---

## 7. The Event Pipeline

VAM has one Vault callback intake and one observable output: `BulkVaultEvent`.

```
Obsidian vault.on("create" | "rename" | "delete")
    ↓
SelfEventTracker.shouldIgnore(path)  ─── filtered ───→ drop
    ↓ (not filtered)
VaultObservation → BulkEventAccumulator → collapse → semantic roots
    ↓
BulkVaultEventHandler
```

### 7.1 Vault Observation

**Source**: `impl/event-processing/vault-observation.ts`

`VaultObservation` owns Obsidian listener lifecycle, Self Event attribution, buffering, normalization, Semantic Root inference, subscriber completion, and teardown. The retired single-event path had no repository caller and competed with bulk observation at the pop-on-match `SelfEventTracker` seam.

**Rename handling**: `shouldIgnore()` is evaluated once for each of `newPath` and `oldPath`. A rename is filtered only when both match, confirming a genuine Self Event rename. If only one path matches, the event passes through and the idempotent tree remains the safety net.

### 7.2 Windowing and Semantic Roots

**Source**: `impl/event-processing/bulk-event-emmiter/batteries/`

Groups events into time-windowed batches, then collapses and reduces before delivering.

#### 7.2.1 BulkEventAccumulator

**Source**: `batteries/event-accumulator.ts`

Buffers events with a dual-window strategy:

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `quietWindowMs` | 250ms | Flush when no new events arrive for this long |
| `maxWindowMs` | 2000ms | Safety cap: force flush even if events keep arriving |

**Mechanics**:
- First event starts a new window, records `windowStartedAt`
- Each `push()` resets the quiet timer
- If `maxWindow` exceeded on push → force flush immediately
- On flush → emits `BulkWindow { allObsidianEvents[], debug { startedAt, endedAt } }`
- `clear()` drops buffer and stops timers (used on teardown)

#### 7.2.2 Processing Chain

After accumulation, `VaultObservation` runs two stages:

**Stage 1: Collapse** (`batteries/processing-chain/collapse.ts`)

1. **Exact dedupe** — keep last occurrence per key (`dedupeByKey`)
2. **Rename chain collapse** — `A→B + B→C → A→C` (file and folder renames separately)
   - Builds a forward map: `fromKey → to` (keep last per fromKey)
   - Resolves chains by following the forward map until reaching a terminal hop
   - Emits only chain roots (fromKey that doesn't appear as any toKey)
   - Drops no-op renames (`A→A`)
   - Cycle guard: stops collapsing if a loop is detected

**Stage 2: Reduce Roots** (`batteries/processing-chain/reduce-roots.ts`)

Removes events semantically implied by higher-level folder operations:

| Event | Is Root If... |
|-------|--------------|
| `FolderRenamed` | Not covered by another `FolderRenamed` |
| `FileRenamed` | Not covered by ANY `FolderRenamed` |
| `FolderDeleted` | Not nested under another `FolderDeleted` |
| `FileDeleted` | Not under ANY `FolderDeleted` |
| `FileCreated`, `FolderCreated` | Always excluded from roots (not `PossibleRootVaultEvent`) |

**Coverage detection** (`isCoveredByFolderRename`): A child rename is covered by a parent rename if:
1. Child `from` path is a prefix of parent `from` path
2. Child `to` path is a prefix of parent `to` path
3. Relative suffixes match (same position after parent folder)
4. Type compatibility (file→file, folder→folder)

#### 7.2.3 BulkVaultEvent

**Source**: `types/bulk/bulk-vault-event.ts`

The final output delivered to subscribers:

```typescript
type BulkVaultEvent = {
    events: VaultEvent[];                      // all collapsed events
    roots: PossibleRootVaultEvent[];           // semantic roots (rename + delete only)
    debug: {
        startedAt: number;
        endedAt: number;
        trueCount:     { renames, creates, deletes };   // raw from Obsidian
        collapsedCount: { renames, creates, deletes };   // after collapse
        reduced:       { rootRenames, rootDeletes };     // root counts
    };
};
```

**Contract for downstream consumers**: Base logic on `roots`, not `events`. A `FolderRenamed` root implies all descendants were renamed. Descendant rename events are derived noise.

### 7.3 Subscription Lifecycle

**Lazy initialization** — observation starts only when both conditions are met:
1. `startListening()` has been called
2. At least one subscriber exists

**Teardown** — `subscribeToBulk()` returns a `Teardown` function. When the last subscriber unsubscribes, observation removes all three Obsidian listeners and clears the current window.

```
startListening()
  ↓
subscribeToBulk(handler) → starts VaultObservation if needed
  ↓
[Obsidian events flow through pipeline]
  ↓
teardown() → removes handler → stops observation if no subscribers remain
```

---

## 8. SelfEventTracker — Preventing Feedback Loops

**Source**: `impl/event-processing/self-event-tracker.ts`

When VAM dispatches actions, Obsidian emits vault events for those changes. Without filtering, these events would propagate to subscribers (Librarian, Textfresser) and trigger new healing/processing cycles — potentially infinite loops.

### 8.1 Current Role

As of the idempotent tree changes, `SelfEventTracker` is a **performance optimization** rather than a correctness requirement. `tree.apply()` returns `{ changed, node }` and the healer skips healing when `!changed`, preventing infinite loops at the source.

**Benefits of keeping it**:
- Avoids processing self-events entirely (better performance)
- Supplies internal readiness signals to `VaultActionManagerTestingAdapter`
- Cleaner event logs (only user-triggered events appear)

### 8.2 Two-Level Matching

**Exact path tracking** (`tracked: Map<string, { timeout, isFilePath }>`):
- **Pop-on-match**: `shouldIgnore(path)` removes the path from the map after first match
- One-time use: each dispatched path is matched at most once
- TTL: 5 seconds (auto-cleanup if Obsidian event never arrives)

**Prefix tracking** (`trackedPrefixes: Map<string, timeout>`):
- **Persistent**: does NOT pop on match (allows many descendants to match)
- Used for folder operations that cascade to children
- TTL: 5 seconds

### 8.3 Registration Rules by Action Kind

| Action Kind | Exact Paths Tracked | Prefix Tracked |
|-------------|-------------------|----------------|
| `CreateFolder` | Folder path + all parent folders (Obsidian auto-creates parents) | — |
| `CreateFile`, `UpsertMdFile` | File path only (NOT parents — parents handled by explicit CreateFolder) | — |
| `ProcessMdFile` | **Not tracked** — triggers `modify` events which emitters don't listen for; stale entries caused user renames/deletes to be dropped | — |
| `TrashFolder` | Folder path | Source folder path (catches child delete events) |
| `TrashFile`, `TrashMdFile` | File path | — |
| `RenameFolder` | Source + all source parents, destination folder | Source folder path (catches child rename events) |
| `RenameFile`, `RenameMdFile` | `from` path + `to` path (NOT parents) | — |

**Key design decisions**:
- **CreateFolder tracks parents**: Obsidian's `vault.createFolder()` auto-creates missing parents, emitting create events for each. These must be filtered.
- **File operations DON'T track parents**: Parent folders either already exist or are created via explicit `CreateFolder` actions. Tracking parents from file ops incorrectly filters user folder operations.
- **RenameFolder only tracks source as prefix**: Tracking the destination prefix would incorrectly filter user-created files in the renamed folder.

### 8.4 E2E Test Integration

The tracker keeps readiness primitives internal:

```typescript
getRegisteredFilePaths(): readonly string[]
// Returns all currently tracked file paths (not folders, not trashed)
// Called BEFORE waitForAllRegistered() to capture snapshot

waitForAllRegistered(): Promise<void>
// Resolves when all tracked paths have been popped by Obsidian events
// Returns immediately if no paths tracked
```

`VaultActionManagerTestingAdapter` composes those primitives with the real dispatch and observation modules:
```
wait for DispatchBatchCoordinator
  → flush any pending VaultObservation window
  → wait for subscribers and any batches they submit
  → wait for registered Self Events
  → verify resulting files are queryable
```

The adapter is returned alongside the manager by `createVaultActionManager(app)`. Production callers receive the `VaultActionManager` interface and do not learn readiness, polling, queue state, or diagnostics.

---

## 9. Read-Only Operations

**Source**: `impl/vault-reader.ts`

VaultReader provides read-only access without going through the dispatch pipeline:

```typescript
readContent(splitPath: SplitPathToMdFile): Promise<Result<string, ReadContentError>>
// Delegates active/background routing to MarkdownFileAccess
// Error type: ReadContentError { kind: FileNotFound | PermissionDenied | Unknown, reason }

exists(target: AnySplitPath): boolean
// Folder → tfolderHelper.getFolder().isOk()
// File → tfileHelper.getFile().isOk()

findByBasename(basename: string, opts?: { folder?: SplitPathToFolder }): SplitPathToMdFile[]
// Vault-wide or folder-scoped search for markdown files by basename
// Used by Lemma command for polysemy disambiguation (V3)

resolveLinkpathDest(linkpath: string, from: SplitPathToMdFile): SplitPathToMdFile | null
// Uses Obsidian metadataCache.getFirstLinkpathDest(linkpath, sourcePath)
// Converts resolved TFile to SplitPathToMdFile; returns null when unresolved/non-md
// Used by Lemma pre-prompt safe-linking to avoid dead temporary links

list(folder: SplitPathToFolder): Result<AnySplitPath[], string>
// List immediate children of folder

listAllFilesWithMdReaders(folder: SplitPathToFolder): Result<SplitPathWithReader[], string>
// Recursive listing with attached read() functions (no TFile leakage)
```

---

## 10. Markdown File Access

**Source**: `file-services/markdown-file-access.ts`

`MarkdownFileAccess` is the deep module for Markdown-file content, selection, navigation, and route choice. It has no knowledge of higher-level Librarian document kinds. Callers express intent through `VaultActionManager`; they cannot obtain the active-editor implementation.

It has two adapters:

- `ActiveFileService`: active editor content, selection, navigation, and inline-title selection preservation.
- `TFileHelper` plus `Vault`: background read/transform/write operations.

The routing policy is implemented once for reads and transforms. Rename selection preservation also stays inside this module rather than leaking the editor protocol into the action executor.

The public intent-level methods are:

```typescript
readContent(path)
getOpenedContent()
mdPwd()
getSelectionInfo()
getSelectionText()
cd(path)
scrollOpenedFileToLine(line)
```

`SelectionInfo` continues to use cursor offsets rather than `indexOf`, so duplicate selected text is handled correctly.

---

## 11. Testing Adapter

**Source**: `testing-adapter.ts`

The production interface contains no mutable traces, private-map inspection, event waiters, or queryability polling. `createVaultActionManager(app)` returns two adapters over one object graph:

```typescript
const { manager, testing } = createVaultActionManager(app);

await manager.dispatch(actions); // production outcome
await testing.whenSettled();     // running-Obsidian readiness
```

`whenSettled()` observes the real Dispatch Batch coordinator, Vault observation module, and Self Event tracker. Queryability polling (50ms → 200ms exponential backoff, 10-second cap) lives here rather than in the production facade. Unit tests assert through the `dispatch`, `VaultObservation`, and `MarkdownFileAccess` interfaces instead of accumulated implementation traces.

---

## 12. Key Design Decisions

### Two Pipelines, Shared Filter

The dispatch pipeline (outbound: actions → Obsidian API) and the event pipeline (inbound: Obsidian events → subscribers) run independently but share the `SelfEventTracker`. This clean separation means:
- Dispatch doesn't wait for events
- Events don't block dispatch
- The only coupling is the path filter

### Collapse Before Sort

Collapse runs before the dependency graph is built. This reduces the action count before the (more expensive) graph construction and topological sort. It also ensures the graph never sees redundant actions that might create spurious dependencies.

### Register All Before Execute

All action paths are registered with `SelfEventTracker` before ANY action is executed. Without this, earlier actions could pop paths that later actions register, causing incorrect filtering.

### EnsureExist as First-Class Semantic

`UpsertMdFile(content: null)` is a deliberate semantic choice, not just "missing content". It enables the collapse logic to differentiate between "create with content" and "just make sure it exists", composing correctly with ProcessMdFile.

### Trash Wins

Trash actions are terminal. If a path is being trashed, no other action for that path makes sense. This is enforced in both collapse (Trash replaces any existing action) and ensure-requirements (Trash paths skip EnsureExist). Trash actions have no dependencies.

### Route Once in MarkdownFileAccess

The executor and reader do not independently choose between editor and Vault operations. `MarkdownFileAccess` owns that policy and its two adapters, preventing route drift and keeping editor state, inline-title selection, and navigation knowledge behind one internal interface.

---

## 13. Key File Index

| File | Purpose |
|------|---------|
| **Entry Points** | |
| `index.ts` | Public interface, type exports, factory exports |
| `facade.ts` | Wires one production manager graph and its testing adapter |
| `testing-adapter.ts` | Running-Obsidian readiness over the real graph |
| **Types** | |
| `types/split-path.ts` | SplitPath discriminated union + Zod schemas |
| `types/read-content-error.ts` | Typed read error union (`ReadContentError`) + helpers |
| `types/vault-action.ts` | VaultAction discriminated union (10 kinds) |
| `types/vault-event.ts` | VaultEvent discriminated union (6 kinds) |
| `types/literals.ts` | Zod literal schemas for action/event kind composition |
| `types/dependency.ts` | ActionDependency, DependencyGraph |
| **Dispatch Pipeline** | |
| `impl/actions-processing/dispatch-batch.ts` | Deep Dispatch Batch coordination module |
| `impl/actions-processing/ensure-requirements-helpers.ts` | Filter invalid deletes, auto-create parents |
| `impl/actions-processing/collapse.ts` | Dedupe + compose transforms |
| `impl/actions-processing/dependency-detector.ts` | Build DAG, folder-creator indexing |
| `impl/actions-processing/topological-sort.ts` | Kahn's algorithm with depth tie-breaking |
| `impl/actions-processing/executor.ts` | Action → Obsidian API call |
| `impl/actions-processing/helpers/make-key-for-action.ts` | Action → path key for collapse |
| **Event Pipeline** | |
| `impl/event-processing/self-event-tracker.ts` | Exact + prefix path filtering, TTL, E2E support |
| `impl/event-processing/vault-observation.ts` | Single intake, lifecycle, attribution, buffering, Bulk output |
| `impl/event-processing/bulk-event-emmiter/batteries/event-accumulator.ts` | Quiet/max window buffering |
| `impl/event-processing/bulk-event-emmiter/batteries/processing-chain/collapse.ts` | Exact dedupe + rename chain collapse |
| `impl/event-processing/bulk-event-emmiter/batteries/processing-chain/reduce-roots.ts` | Semantic root extraction |
| `impl/event-processing/bulk-event-emmiter/types/bulk/bulk-vault-event.ts` | BulkVaultEvent type with debug metadata |
| `impl/event-processing/bulk-event-emmiter/types/bulk/helpers.ts` | Type predicates: isRename, isDelete, isPossibleRoot |
| `impl/event-processing/vault-events-for-events.ts` | TAbstractFile → VaultEvent encoding |
| **Read-Only** | |
| `impl/vault-reader.ts` | Content reading, existence, listing, basename search |
| `impl/common/split-path-and-system-path.ts` | SplitPath ↔ system path codec |
| `impl/common/collapse-helpers.ts` | makeKeyFor, sameRename, dedupeByKey |
| **Markdown File Access** | |
| `file-services/markdown-file-access.ts` | Owns active-editor/background-vault routing |
| `file-services/active-view/active-file-service.ts` | Facade: reader + writer + navigation |
| `file-services/active-view/writer/reader/active-file-reader.ts` | Read content, pwd, cursor |
| `file-services/active-view/writer/active-file-writer.ts` | Write content, save/restore selection |
| `file-services/active-view/selection-service.ts` | SelectionInfo: text, surrounding block, path |
| `file-services/active-view/navigation/cd.ts` | Open file in editor |
| **Background Helpers** | |
| `file-services/background/helpers/tfile-helper.ts` | File ops: create, rename, trash, read |
| `file-services/background/helpers/tfolder-helper.ts` | Folder ops: create, rename, trash |
| `file-services/background/helpers/common.ts` | Shared Obsidian API utilities |
| **Path Codecs** | |
| `helpers/pathfinder/index.ts` | Pathfinder facade |
| `helpers/pathfinder/path-codecs/split-and-abstract/` | TAbstractFile ↔ SplitPath |
| `helpers/pathfinder/path-codecs/system-and-any-split/` | String path ↔ SplitPath |
| `helpers/pathfinder/path-utils.ts` | Path part utilities |
| **Utility** | |
| `helpers/action-helpers.ts` | Type predicates: isRename, isTrash, isProcess, isUpsert |
| `errors.ts` | Error message builders |

---

## 14. Issues & Concerns

### 14.1 Zod v4 Import in `literals.ts` and `vault-action.ts` — PARTIALLY RESOLVED

`vault-event.ts` was migrated to `zod/v3` (safe — only uses string extraction via `.enum`).

The remaining three files **must stay v4** due to runtime dependencies on v4-only features:
- `types/literals.ts` — `MdSchema` (v4 `ZodLiteral`) is consumed by `split-path.ts`'s `.extend()`. Passing a v3 schema into v4 `.extend()` causes `_zod.run is not a function`.
- `types/split-path.ts` — `SplitPathSchema` is consumed by `z.codec()` in `system-path-and-split-path-codec.ts`, a v4-only API.
- `types/vault-action.ts` — `z.enum()` with `.options.map()` template literals only infers correctly in v4. Switching to v3 breaks discriminated union narrowing in all consuming files.

Each file has an explanatory comment documenting why it must stay v4. The latent risk is mitigated by the fact that these schemas operate in a separate domain from the v3-based prompt-smith schemas.

### 14.2 Typo: "Emmiter" → "Emitter"

The historical `bulk-event-emmiter/` directory name remains around the accumulator and Bulk event types. The public module is correctly named `VaultObservation`; the remaining path typo is internal and can be migrated separately.

### 14.3 `collapseActions` is Async but Rarely Needs To Be

`collapseActions()` is `async` and returns `Promise<VaultAction[]>` because the UpsertMdFile(content) + ProcessMdFile path eagerly applies the transform (`const transformed = await transform(upsertContent)`). This makes the entire function async even though most collapse paths are synchronous. The async overhead is negligible, but it's a slightly unusual signature for what's conceptually a pure data transform.

### 14.4 Dispatch Batch Overflow: Caller Attribution — RESOLVED

The overflow path now:
1. Logs a warning with submitted-batch and action counts.
2. Drops all batches beyond the configured drain-cycle limit.
3. Resolves every dropped submission with its own `err(DispatchError[])`.
4. Leaves no shared drain waiter that can report unconditional success.

The `maxBatches` limit (default 10) is configurable via `DispatchBatchOptions` for testing.

### 14.5 Rename Event Filtering: OR→AND and ProcessMdFile Stale Paths — RESOLVED

Two interacting bugs caused user renames/moves to be silently dropped:

1. **Stale ProcessMdFile entries**: `ProcessMdFile` calls `vault.modify()` which triggers `modify` events, but emitters only listen for `create`/`rename`/`delete`. Tracked paths were never popped and lingered for the 5s TTL, causing subsequent user events on the same path to be incorrectly filtered. **Fix**: `ProcessMdFile` paths are no longer registered in `extractPaths()`.

2. **OR logic in rename handlers**: `if (newPathIgnored || oldPathIgnored)` was too aggressive — a single stale path match would drop the entire rename event. A genuine Self Event rename has both paths registered. **Fix**: `VaultObservation` evaluates each path once and filters only when both match. The idempotent tree (`changed: false` for already-applied actions) acts as a safety net.

Both `shouldIgnore()` calls are still evaluated into separate variables before the `if` check to ensure both paths are popped from the tracker regardless of the filter outcome.

### 14.6 Topological Sort Re-sorts Entire Queue on Each Addition

In `topological-sort.ts`, `sortQueue(queue)` is called every time a new zero-degree action is added to the queue (line 73). The sort operates on the entire remaining queue, not just the insertion point. For typical batch sizes (tens of actions) this is negligible, but it's O(k log k) per newly-unblocked action where k is the queue length — total O(n * k log k) in the worst case. A priority queue / binary heap would reduce this to O(n log n) total but is likely overkill for current workloads.

### 14.7 Unbounded Mutable Event Diagnostics — RESOLVED

The mutable raw-event array and dispatcher traces were removed from the production implementation. Interface-level tests now feed callbacks and observe complete Bulk Vault Events.

### 14.8 MarkdownFileAccess's 50ms Sleep After Rename

`markdown-file-access.ts` has a hardcoded 50ms delay before restoring an inline-title selection after rename. The editor protocol is now local to the correct module, but the timing heuristic could still be replaced by an observable view-update signal.

### 14.9 Queryability Polling in Production Code — RESOLVED

Queryability polling moved to `VaultActionManagerTestingAdapter`. `VaultActionManager` no longer exposes `waitForObsidianEvents()`.

### 14.10 No Rollback on Partial Failure

If action #3 of 10 fails, actions #1 and #2 have already been executed. There's no rollback mechanism — the batch returns `err(errors)` but the file system is in a partially-applied state. This is acceptable for an Obsidian plugin (users have undo and git), but it's worth noting. Callers must be prepared for partial application.

### 14.11 `as` Casts in `vault-reader.ts` listAll

`vault-reader.ts` `listAll()` (lines 96-109) uses `as unknown as TFolder` and `as SplitPathToFolderWithTRef` casts when building internal types. These bypass TypeScript's type system and could mask bugs if the underlying data shape changes.

### 14.12 `hasActionForKey` is O(N) Linear Scan — RESOLVED

Added `buildActionKeyIndex(actions)` which pre-computes `{ folderKeys: Set<string>, fileKeys: Set<string> }` in a single O(N) pass. All 4 call sites in `ensureDestinationsExist()` now use `actionIndex.folderKeys.has(key)` / `actionIndex.fileKeys.has(key)` for O(1) lookups. The original `hasActionForKey()` is kept (deprecated) for backward compatibility in existing tests.

### 14.13 Event Accumulator's `maxWindow` Check Happens on `push()`

In `event-accumulator.ts`, the max window check (`now - windowStartedAt >= maxWindowMs`) only runs when a new event arrives. If events stop arriving just before the max window, the quiet window timer (250ms) will flush instead — which is correct. But if events arrive at, say, 200ms intervals forever, the max window forces a flush only when the next `push()` happens after 2000ms from window start. Events arriving at exactly 250ms intervals would never trigger the max window because the quiet timer would flush first. This is fine behavior but somewhat non-obvious.
