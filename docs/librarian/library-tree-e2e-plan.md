# LibraryTree E2E Test Plan

## Overview

E2E tests for `LibraryTree` and `Librarian` using WebdriverIO + Mocha.

Key concepts:
- `TreeLeaf = ScrollNode | FileNode` - leaf nodes with `coreNameChainToParent` set
- `SectionNode` - folder representation with children
- Status: `Done | NotStarted` for Scrolls/Sections, `Unknown` for Files
- Status propagation: sections derive status from children (Done if all children Done)

## Test Categories by Difficulty

### Level 1: Easy Tests (Basic Happy Path)

#### `Librarian.readTreeFromVault()` - Happy Path ✅
- [x] **File**: `read-tree-from-vault.test.ts`
- [x] Create test structure with metadata (status in file content)
- [x] Read tree from vault
- [x] Verify:
  - Root section exists
  - All sections created (Avarar, S1, S2, E1)
  - All ScrollNodes present with correct `coreName`
  - Correct `coreNameChainToParent` for all nodes
  - Scroll statuses read from metadata
  - Section statuses derived from children

#### `LibraryTree.getNode()` - Happy Path ✅
- [x] **File**: `tree-navigation.test.ts`
- [x] Get root node (empty chain) → returns root SectionNode
- [x] Get section node by chain → returns correct SectionNode
- [x] Get scroll node by chain → returns correct ScrollNode
- [x] Get non-existent node → returns null

#### `LibraryTree.serializeToLeaves()` - Happy Path
- [ ] **File**: `tree-serialization.test.ts`
- [ ] Serialize tree → returns all leaf nodes as `TreeLeaf[]`
- [ ] Verify `coreNameChainToParent` correct on each leaf
- [ ] Verify all ScrollNodes/FileNodes included, no SectionNodes
- [ ] Round-trip: create tree → serialize → create new tree → verify identical

### Level 2: Medium Tests (Tree Actions)

#### `LibraryTree.applyTreeAction()` - CreateNode
- [ ] **File**: `tree-actions.test.ts`
- [ ] Create ScrollNode → node appears in tree with correct status
- [ ] Create FileNode → node appears with `Unknown` status
- [ ] Create SectionNode → node appears with empty children, `NotStarted` status
- [ ] Create node → parent's children updated
- [ ] Create duplicate node → returns existing chain (idempotent)

#### `LibraryTree.applyTreeAction()` - DeleteNode
- [ ] **File**: `tree-actions.test.ts`
- [ ] Delete leaf node → removed from parent's children
- [ ] Delete section node → removes entire subtree from nodeMap
- [ ] Delete non-existent node → returns chain (no-op)

#### `LibraryTree.applyTreeAction()` - ChangeNodeName
- [ ] **File**: `tree-actions.test.ts`
- [ ] Rename leaf node → `coreName` updated, `getNode()` works with new name
- [ ] Rename section → all children's `coreNameChainToParent` updated recursively
- [ ] Rename to existing name → throws error

#### `LibraryTree.applyTreeAction()` - ChangeNodeStatus
- [ ] **File**: `tree-status-propagation.test.ts`
- [ ] Change ScrollNode status → only that node updated
- [ ] Change SectionNode status → all descendants updated recursively
- [ ] After change, parent recalculates: Done if all children Done, else NotStarted
- [ ] Status propagates up to root
- [ ] Change FileNode status → no-op (FileNode has Unknown, can't change)

### Level 3: Hard Tests (Complex Scenarios)

#### Status Propagation - Complex Tree
- [ ] **File**: `tree-status-propagation.test.ts`
- [ ] Tree with mixed statuses at different levels
- [ ] Change deep child to Done → verify propagation up entire chain
- [ ] Change parent to NotStarted → verify all descendants NotStarted
- [ ] Multiple status changes in sequence → verify final state

#### Tree Building with Metadata
- [ ] **File**: `read-tree-from-vault.test.ts`
- [ ] Files with different metadata statuses
- [ ] Files without metadata → default NotStarted
- [ ] Mixed Done/NotStarted → correct section status derivation

### Level 4: Integration Tests

#### Full Reconciliation Flow
- [ ] **File**: `tree-reconciliation.test.ts`
- [ ] Clone tree → apply TreeActions → diff → get VaultActions
- [ ] Verify VaultActions would sync vault to new tree state

## Test Data

### Standard Test Structure
```
Library/
├── Avarar/
│   ├── S1/
│   │   ├── E1-S1-Avarar.md (status: Done)
│   │   └── E2-S1-Avarar.md (status: NotStarted)
│   └── S2/
│       ├── E1/
│       │   ├── 000_E1-E1-S2-Avarar.md (status: Done)
│       │   └── 001_E1-E1-S2-Avarar.md (status: Done)
│       └── E2-S1-Avarar.md (status: Done)
```

Expected section statuses:
- `E1` (section): Done (all children Done)
- `S2`: Done (all children Done)
- `S1`: NotStarted (has NotStarted child)
- `Avarar`: NotStarted (S1 is NotStarted)
- Root: NotStarted

### Metadata Format
```
<section id={textfresser_meta_keep_me_invisible}>
{"fileType":"Scroll","status":"Done"}
</section>
```

### Test Setup Pattern
```typescript
// Create files with metadata
const files = [
  { path: "Library/folder/Note-folder.md", status: "Done" },
  // ...
];
const createActions = files.map(({ path }) => ({
  type: "CreateMdFile",
  payload: { content: "", splitPath: vaultSplitPath(path) },
}));
await manager.dispatch(createActions);

// Write metadata
const writeActions = files.map(({ path, status }) => ({
  type: "ReplaceContentMdFile", 
  payload: { content: makeMeta(status), splitPath: vaultSplitPath(path) },
}));
await manager.dispatch(writeActions);

// Read tree
const tree = await librarian.readTreeFromVault();
```

## Implementation Order

1. **Phase 1** ✅: Basic tree reading and navigation
   - `readTreeFromVault()` with metadata extraction
   - `getNode()` tests
   
2. **Phase 2**: Serialization and tree actions
   - `serializeToLeaves()` tests
   - CreateNode, DeleteNode, ChangeNodeName tests

3. **Phase 3**: Status propagation
   - ChangeNodeStatus tests
   - Complex propagation scenarios

4. **Phase 4**: Integration
   - Reconciliation flow
   - Edge cases
