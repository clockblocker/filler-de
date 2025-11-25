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

## ✅ Phase 4: Codex Integration (DONE)

- [x] Create `CodexGenerator` and `CodexFormatter`
- [x] Section/Book create → Codex file
- [x] Section/Book delete → trash Codex
- [x] Status change → update ancestor Codexes
- [x] Integration tests

## ✅ Refactoring: VaultEventService (DONE)

- [x] Create `VaultEventService` 
- [x] Listen to `delete`, `rename`, `create` events
- [x] Filter by Library folder
- [x] Remove event listeners from Librarian constructor
- [x] Wire in main.ts after trees init

---

## ⏳ Phase 5: User Interaction Handlers

### 5.1 Vault Event Handlers
- [ ] `onFileDeleted` — remove text/section from tree, update parent Codex
- [ ] `onFileRenamed` — detect rename vs move, update tree + files
- [ ] `onFileCreated` — check if needs to be added to tree (external file dropped in)

### 5.2 Click Handlers
- [ ] Checkbox click → `setStatus` (mark page/text as Done/NotStarted), update all impacted codexes up/down the line

### 5.3 Command Handlers (already done)
- [x] `makeNoteAText` — convert note to scroll/book
- [x] `createNewTextInTheCurrentFolder` — create new text node

---

## Phase 6: Rename/Move Implementation

### 6.1 Rename Text
- [ ] Detect: old path vs new path, same parent
- [ ] Update tree node name
- [ ] Rename all page files (new reversed path)
- [ ] Rename Codex file (if book)
- [ ] Update parent Codex (link text changed)

### 6.2 Move Text
- [ ] Detect: old parent vs new parent
- [ ] Update tree (remove from old, add to new)
- [ ] Move files to new location
- [ ] Update OLD parent Codex (remove item)
- [ ] Update NEW parent Codex (add item)
- [ ] Rename files if path changed (reversed path in name)

### 6.3 Rename Section
- [ ] Update tree node name
- [ ] Rename folder
- [ ] Rename Codex file
- [ ] Update all children's file names (they include section in name)
- [ ] Update parent Codex

---

## Phase 7: Edge Cases & Polish

### 7.1 Edge Cases
- [ ] Empty sections (no children)
- [ ] Concurrent mutations
- [ ] Queue flush during mutation
- [ ] External files dropped into Library folder
- [ ] Codex manually edited by user

### 7.2 Performance
- [ ] Tune debounce delay
- [ ] Consider parallel execution for independent actions
- [ ] Profile large tree operations

### 7.3 UX
- [ ] Show loading indicator during batch operations
- [ ] Error notifications for failed operations
- [ ] Undo support?
