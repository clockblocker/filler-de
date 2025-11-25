# File Management Implementation

## Phase 1: Queue Infrastructure

### 1.1 Finalize Action Types
- [ ] Complete `BackgroundVaultAction` union type in `background-vault-actions.ts`
  - CreateFolder, TrashFolder, RenameFolder
  - CreateFile, TrashFile, RenameFile
  - ProcessFile, WriteFile
- [ ] Define weight map for execution order
- [ ] Add helper to get action key (for deduplication)

### 1.2 Create VaultActionQueue
- [ ] Create `vault-action-queue.ts`
- [ ] Implement `push(action)` — adds to Map keyed by target path
- [ ] Implement `pushMany(actions)`
- [ ] Implement `scheduleFlush()` — debounced (200ms)
- [ ] Implement `flush()` — sort by weight, execute
- [ ] Implement `getActionKey(action)` — unique key per target

### 1.3 Create VaultActionExecutor
- [ ] Create `vault-action-executor.ts`
- [ ] Implement `execute(actions)` — iterate sorted actions
- [ ] Implement `executeOne(action)` — switch on action type
- [ ] Wire to BackgroundFileService methods

### 1.4 Tests
- [ ] Unit: queue push + dedupe
- [ ] Unit: queue sort by weight
- [ ] Unit: debounce behavior
- [ ] Integration: executor → file service

---

## Phase 2: Tree Snapshots & Diffing

### 2.1 Add Snapshot to LibraryTree
- [ ] Add `snapshot(): TreeSnapshot` method
- [ ] Define `TreeSnapshot` type
  - texts: TextDto[]
  - sections: TreePath[]

### 2.2 Create TreeDiffer
- [ ] Create `src/commanders/librarian/diffing/tree-differ.ts`
- [ ] Implement `diff(before, after): TreeDiff`
- [ ] Define `TreeDiff` type
  - addedTexts, removedTexts
  - statusChanges
  - addedSections, removedSections
- [ ] Helper: `findAdded()`, `findRemoved()`, `findStatusChanges()`

### 2.3 Create DiffToActionsMapper
- [ ] Create `src/commanders/librarian/diffing/diff-to-actions.ts`
- [ ] Implement `mapDiffToActions(diff, tree): BackgroundVaultAction[]`
- [ ] Map addedSections → CreateFolder + CreateFile (Codex)
- [ ] Map addedTexts → CreateFile (Scroll or Pages)
- [ ] Map removedTexts → TrashFile
- [ ] Map removedSections → TrashFolder
- [ ] Map statusChanges → WriteFile (Codex updates)

### 2.4 Tests
- [ ] Unit: TreeDiffer detects additions
- [ ] Unit: TreeDiffer detects removals
- [ ] Unit: TreeDiffer detects status changes
- [ ] Unit: Mapper produces correct action types

---

## Phase 3: Librarian Integration

### 3.1 Add withDiff Helper
- [ ] Add `withDiff<T>(mutation: () => T): T` to Librarian
- [ ] Captures before/after snapshots
- [ ] Diffs and queues actions automatically

### 3.2 Refactor Existing Methods
- [ ] Wrap `setStatus()` with withDiff
- [ ] Wrap `createNewTextInTheCurrentFolderAndOpenIt()` with withDiff
- [ ] Wrap any future mutation methods

### 3.3 Initialize Queue
- [ ] Inject VaultActionQueue into Librarian
- [ ] Inject VaultActionExecutor into Queue
- [ ] Wire up in main.ts plugin initialization

### 3.4 Tests
- [ ] Integration: setStatus → queue → files updated
- [ ] Integration: createText → queue → files created

---

## Phase 4: Codex Integration

### 4.1 Wire Codex Generation
- [ ] Inject CodexGenerator + CodexFormatter into DiffToActionsMapper
- [ ] Implement `createCodexAction(tree, path)` — generate content
- [ ] Implement `updateCodexAction(tree, path)` — regenerate content
- [ ] Implement `getAffectedCodexPaths(statusChanges)` — all ancestors

### 4.2 Handle All Codex Cases
- [ ] Section created → create Codex
- [ ] Section deleted → delete Codex
- [ ] Section renamed → rename Codex + update parent
- [ ] Text (Book) created → create Codex
- [ ] Text deleted → delete Codex
- [ ] Page added/removed → update Book Codex
- [ ] Status changed → update ancestor Codexes

### 4.3 Tests
- [ ] Integration: create section → Codex file exists
- [ ] Integration: status change → Codex checkbox updated
- [ ] Integration: rapid status changes → single Codex write

---

## Phase 5: Edge Cases & Polish

### 5.1 Edge Cases
- [ ] Empty sections (no children)
- [ ] Scroll (single page, no Codex)
- [ ] Root Library Codex (no back link)
- [ ] Concurrent mutations
- [ ] Queue flush during mutation

### 5.2 Error Handling
- [ ] Action execution failure → log + continue
- [ ] Partial flush recovery
- [ ] Retry logic for transient failures

### 5.3 Performance
- [ ] Tune debounce delay
- [ ] Consider parallel execution for independent actions
- [ ] Profile large tree operations

---

## File Structure

```
src/commanders/librarian/
├── librarian.ts                    // withDiff() wrapper
├── library-tree/
│   └── library-tree.ts             // snapshot()
├── codex/
│   ├── types.ts
│   ├── codex-generator.ts
│   ├── codex-formatter.ts
│   └── codex-parser.ts
└── diffing/
    ├── tree-differ.ts
    └── diff-to-actions.ts

src/services/obsidian-services/file-services/background/
├── background-vault-actions.ts     // Action types + weights (exists)
├── vault-action-queue.ts           // NEW
└── vault-action-executor.ts        // NEW
```

---

## Dependencies

```
Phase 1 (Queue) ← no dependencies, can start now
Phase 2 (Diffing) ← no dependencies, can start now
Phase 3 (Integration) ← depends on Phase 1 + 2
Phase 4 (Codex) ← depends on Phase 3 + Codex implementation (see codexes.md)
Phase 5 (Polish) ← depends on Phase 4
```

Can parallelize Phase 1 and Phase 2.

