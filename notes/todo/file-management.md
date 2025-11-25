# File Management Implementation

## ✅ Phase 1: Queue Infrastructure (DONE)

- [x] Complete `BackgroundVaultAction` union type
- [x] Define weight map for execution order
- [x] Add helper `getActionKey()` for deduplication
- [x] Add helper `sortActionsByWeight()`
- [x] Create `vault-action-queue.ts`
- [x] Create `vault-action-executor.ts`
- [x] Tests: queue push, dedupe, sort, debounce

## ✅ Phase 2: Tree Snapshots & Diffing (DONE)

- [x] Add `snapshot(): TreeSnapshot` to LibraryTree
- [x] Add `getAllSectionPaths()` to LibraryTree
- [x] Create `TreeDiffer` with `diff(before, after)`
- [x] Create `DiffToActionsMapper` with `mapDiffToActions()`
- [x] Tests: TreeDiffer, DiffToActionsMapper, snapshot

## ✅ Phase 3: Librarian Integration (DONE)

- [x] Add `withDiff()` helper to Librarian
- [x] Add `setStatus()`, `addTexts()`, `deleteTexts()` using withDiff
- [x] Add `getSnapshot()` for external access
- [x] Initialize VaultActionQueue in main.ts
- [x] Wire queue to Librarian constructor
- [x] Integration tests

## ✅ Refactoring: Remove Chain Logic from File Service (DONE)

- [x] Simplify TFolderHelper (single folder ops only)
- [x] Simplify AbstractFileHelper (no chain orchestration)
- [x] Add folder ops to BackgroundFileService
- [x] Update VaultActionExecutor to use folder ops
- [x] Chain logic now lives in DiffToActionsMapper

---

## ✅ Phase 4: Codex Integration

### ✅ 4.1 Wire Codex Generation (DONE)
- [x] Create `CodexGenerator` (tree node → CodexContent)
- [x] Create `CodexFormatter` (CodexContent → markdown)
- [x] Inject into DiffToActionsMapper via `getNode` callback

### ✅ 4.2 Update DiffToActionsMapper (DONE)
- [x] `createSectionCodexAction()` — generate content for new sections
- [x] `createTextActions()` — includes book Codex creation
- [x] `updateCodexAction()` — regenerate on status change
- [x] `getAffectedCodexPaths()` — all ancestor paths

### ✅ 4.3 Handle All Cases (DONE)
- [x] Section created → `createSectionCodexAction()`
- [x] Section deleted → `trashSectionCodexAction()`
- [x] Book created → in `createTextActions()`
- [x] Book deleted → in `trashTextActions()`
- [x] Status changed → `updateCodexAction()` via `getAffectedCodexPaths()`

### ✅ 4.4 Integration Tests (DONE)
- [x] Integration: create section → Codex file with correct content
- [x] Integration: status change → Codex checkbox updated
- [x] Integration: scroll exclusion, ancestor chain, root handling

---

## Phase 5: Edge Cases & Polish

### 5.1 Edge Cases
- [ ] Empty sections (no children)
- [ ] Scroll (single page, no Codex)
- [ ] Root Library Codex (no back link)
- [ ] Concurrent mutations
- [ ] Queue flush during mutation

### 5.2 Performance
- [ ] Tune debounce delay
- [ ] Consider parallel execution for independent actions
- [ ] Profile large tree operations
