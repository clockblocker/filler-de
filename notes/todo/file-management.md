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

## ⏳ Phase 4: Codex Integration (PENDING)

See `notes/todo/codexes.md` for detailed breakdown.

### 4.1 Wire Codex Generation
- [ ] Create `CodexGenerator` (tree node → CodexContent)
- [ ] Create `CodexFormatter` (CodexContent → markdown)
- [ ] Inject into DiffToActionsMapper

### 4.2 Update DiffToActionsMapper
- [ ] `createCodexAction()` — generate content for new sections/books
- [ ] `updateCodexAction()` — regenerate on status change
- [ ] `getAffectedCodexPaths()` — all ancestor paths (already has placeholder)

### 4.3 Handle All Cases
- [ ] Section created → create Codex
- [ ] Section deleted → delete Codex
- [ ] Book created → create Codex
- [ ] Book deleted → delete Codex
- [ ] Status changed → update ancestor Codexes

### 4.4 Tests
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

### 5.2 Performance
- [ ] Tune debounce delay
- [ ] Consider parallel execution for independent actions
- [ ] Profile large tree operations
