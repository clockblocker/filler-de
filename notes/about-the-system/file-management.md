# File Management Architecture

Hybrid Diff-based + Event Queue approach for maintaining Library files.

## Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                           LIBRARIAN                                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐ │
│  │ LibraryTree  │───▶│  TreeDiffer  │───▶│  VaultActionQueue    │ │
│  │ (pure state) │    │ (derive ops) │    │  (batch & execute)   │ │
│  └──────────────┘    └──────────────┘    └──────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
                                          ┌──────────────────────┐
                                          │ BackgroundFileService│
                                          │   (single ops only)  │
                                          └──────────────────────┘
```

## Core Idea

1. **LibraryTree** is pure in-memory state (source of truth for structure)
2. **Mutations** are wrapped: snapshot before → mutate → snapshot after
3. **TreeDiffer** computes what changed between snapshots
4. **DiffToActionsMapper** derives file operations from diff
5. **VaultActionQueue** collects, dedupes, sorts, batches actions
6. **Executor** flushes queue to disk via BackgroundFileService

## Responsibility Split

| Layer | Responsibility |
|-------|----------------|
| `LibraryTree` | Pure state mutations, status computation, snapshot |
| `TreeDiffer` | Detect what changed (added/removed/status) |
| `DiffToActionsMapper` | Derive file ops + **chain logic** (folder order) |
| `VaultActionQueue` | Dedupe (same file → one write), sort by weight, debounce |
| `VaultActionExecutor` | Execute actions via BackgroundFileService |
| `BackgroundFileService` | **Single file ops only** (no chains) |
| `TFileHelper` / `TFolderHelper` | Low-level Obsidian vault ops |

**Key design**: Chain logic (create parents before children, cleanup empty folders) lives in `DiffToActionsMapper`, NOT in the file service layer.

## Why This Approach

### Problem
Single user action can cascade:
- Mark page Done → update PageNode status
- → recompute TextNode status
- → recompute SectionNode status (up to root)
- → update Codex files for all affected ancestors

Direct execution would:
- Write same Codex file multiple times
- Risk race conditions on rapid clicks
- Can't optimize operation order

### Solution: Diff + Queue

| Component | Responsibility |
|-----------|----------------|
| Tree | Pure state mutations, status computation |
| Differ | Detect what changed (added/removed/status) |
| Mapper | Derive file ops from changes |
| Queue | Dedupe (same file → one write), sort by weight, debounce |
| Executor | Actually write to disk |

## Action Types & Weights

Operations execute in weight order (lower = first):

```
0: CreateFolder   — must exist before files
1: RenameFolder
2: TrashFolder    — after contents moved

3: CreateFile
4: RenameFile
5: TrashFile      — after renames

6: ProcessFile    — content transforms
7: WriteFile      — content replacement
8: ReadFile       — no-op in queue
```

## Flow Example

```typescript
// User marks page done
librarian.setStatus("Library", ["Avatar", "Season_1", "Episode_1", "000"], "Done");

// Internally (withDiff wrapper):
const before = tree.snapshot();
tree.setStatus(path, "Done");  // mutates + recomputes ancestors
const after = tree.snapshot();

const diff = treeDiffer.diff(before, after);
// → { statusChanges: [{ path, oldStatus, newStatus }] }

const actions = mapper.mapDiffToActions(diff);
// → [ProcessFile(Codex_Episode_1), ProcessFile(Codex_Season_1), ...]

queue.pushMany(actions);
// Queue dedupes by target path
// Schedules flush after 200ms debounce
```

## Queue Behavior

### Deduplication
```typescript
queue.push({ type: "WriteFile", path: "Codex_A", content: "v1" });
queue.push({ type: "WriteFile", path: "Codex_A", content: "v2" });
// Only "v2" gets written (last wins)
```

### Debouncing
```
User clicks rapidly: Done → NotStarted → Done → NotStarted
Each triggers queue.push()
Only ONE flush happens 200ms after last click
```

### Sorting
```
Queue contains: [TrashFile, CreateFolder, WriteFile, CreateFile]
After sort:     [CreateFolder, CreateFile, WriteFile, TrashFile]
```

## Key Abstractions

### TreeSnapshot
```typescript
type TreeSnapshot = {
  texts: TextDto[];           // All texts with page statuses
  sectionPaths: TreePath[];   // All section paths (excluding root)
};
```

### TreeDiff
```typescript
type TreeDiff = {
  addedTexts: TextDto[];
  removedTexts: TextDto[];
  statusChanges: StatusChange[];
  addedSections: TreePath[];
  removedSections: TreePath[];
};
```

### BackgroundVaultAction
```typescript
type BackgroundVaultAction =
  | { type: "CreateFolder"; payload: { prettyPath: PrettyPath } }
  | { type: "CreateFile"; payload: { prettyPath: PrettyPath; content?: string } }
  | { type: "WriteFile"; payload: { prettyPath: PrettyPath; content: string } }
  | { type: "ProcessFile"; payload: { prettyPath: PrettyPath; transform: (s) => s } }
  | { type: "TrashFile"; payload: { prettyPath: PrettyPath } }
  // ... etc
```

## File Structure

```
src/commanders/librarian/
├── librarian.ts              // withDiff() wrapper, setStatus, addTexts, etc.
├── library-tree/
│   ├── library-tree.ts       // snapshot(), getAllTextsInTree(), etc.
│   └── helpers/
│       └── serialization.ts  // makeTextsFromTree, serializeTextNode
├── codex/                    // Codex generation (TODO)
└── diffing/
    ├── types.ts              // TreeSnapshot, TreeDiff, StatusChange
    ├── tree-differ.ts        // TreeDiffer.diff()
    ├── diff-to-actions.ts    // DiffToActionsMapper.mapDiffToActions()
    └── index.ts

src/services/obsidian-services/file-services/background/
├── background-vault-actions.ts   // Action types + weights + helpers
├── vault-action-queue.ts         // Queue + debounce
├── vault-action-executor.ts      // Execute actions via BackgroundFileService
├── background-file-service.ts    // High-level file/folder ops (single ops only)
├── abstract-file-helper.ts       // Orchestrates TFileHelper/TFolderHelper
└── helpers/
    ├── tfile-helper.ts           // Low-level file ops
    └── tfolder-helper.ts         // Low-level folder ops (single folder only)
```

## Benefits

1. **Batching** — multiple changes → single write cycle
2. **Ordering** — folders before files, creates before deletes
3. **Deduplication** — same target → only final state written
4. **Testability** — can inspect queue without executing
5. **Separation** — tree logic is pure, file ops are derived
6. **Debouncing** — rapid user actions don't spam disk
7. **Simplicity** — file service is dumb, chain logic in one place (mapper)

## Implementation Status

- ✅ Phase 1: Queue Infrastructure (VaultActionQueue, VaultActionExecutor)
- ✅ Phase 2: Tree Snapshots & Diffing (TreeDiffer, DiffToActionsMapper)
- ✅ Phase 3: Librarian Integration (withDiff, setStatus, addTexts, etc.)
- ⏳ Phase 4: Codex Integration (pending)
