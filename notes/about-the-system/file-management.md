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
                                           └──────────────────────┘
```

## Core Idea

1. **LibraryTree** is pure in-memory state (source of truth for structure)
2. **Mutations** are wrapped: snapshot before → mutate → snapshot after
3. **TreeDiffer** computes what changed between snapshots
4. **DiffToActionsMapper** derives file operations from diff
5. **VaultActionQueue** collects, dedupes, sorts, batches actions
6. **Executor** flushes queue to disk via BackgroundFileService

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
```

## Flow Example

```typescript
// User marks page done
librarian.setPageStatus(path, "Done");

// Internally:
const before = tree.snapshot();
tree.setStatus(path, "Done");  // mutates + recomputes ancestors
const after = tree.snapshot();

const diff = differ.diff(before, after);
// → { statusChanges: [Episode_1, Season_1, Library] }

const actions = mapper.mapDiffToActions(diff, tree);
// → [WriteFile(Codex_Episode_1), WriteFile(Codex_Season_1), WriteFile(Codex_Library)]

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
  sections: TreePath[];       // All section paths
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
  | { type: "CreateFolder"; path: SplitPathToFolder }
  | { type: "CreateFile"; path: SplitPathToFile; content: string }
  | { type: "WriteFile"; path: SplitPathToFile; content: string }
  | { type: "TrashFile"; path: SplitPathToFile }
  // ... etc
```

## File Structure

```
src/commanders/librarian/
├── librarian.ts              // Uses withDiff() wrapper
├── library-tree/
│   └── library-tree.ts       // snapshot()
├── codex/                    // Codex generation
└── diffing/
    ├── tree-differ.ts
    └── diff-to-actions.ts

src/services/obsidian-services/file-services/background/
├── background-vault-actions.ts   // Action types + weights
├── vault-action-queue.ts         // Queue + debounce
└── vault-action-executor.ts      // Execute actions
```

## Benefits

1. **Batching** — multiple changes → single write cycle
2. **Ordering** — folders before files, creates before deletes
3. **Deduplication** — same target → only final state written
4. **Testability** — can inspect queue without executing
5. **Separation** — tree logic is pure, file ops are derived
6. **Debouncing** — rapid user actions don't spam disk

