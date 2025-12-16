# LibraryTree E2E Test Plan

## Overview

E2E tests for `LibraryTree` and `Librarian` using WebdriverIO + Mocha, following the pattern established in `t-abstract-file-helpers` tests.

## Test Categories by Difficulty

### Level 1: Easy Tests (Basic Happy Path)

#### `Librarian.readTreeFromVault()` - Happy Path
- [ ] **File**: `read-tree-from-vault.test.ts`
- [ ] Create test structure using `createTestTreeActions()`
- [ ] Read tree from vault
- [ ] Verify tree structure matches expected:
  - Root section exists
  - All sections created (Avarar, S1, S2, E1)
  - All files present (E1-S1-Avarar.md, E2-S1-Avarar.md, etc.)
  - Correct `coreName` extracted from basenames
  - Correct `coreNameChainToParent` for all nodes
- **Effort**: Low - Use existing `createTestTreeActions()`, verify structure

#### `LibraryTree.getNode()` - Happy Path
- [ ] **File**: `tree-navigation.test.ts`
- [ ] Get root node (empty chain) → returns root SectionNode
- [ ] Get section node by chain → returns correct SectionNode
- [ ] Get file node by chain → returns correct FileNode/ScrollNode
- [ ] Get non-existent node → returns null
- **Effort**: Low - Direct API calls, simple assertions

#### `LibraryTree.serializeToTreeLeafDtos()` - Happy Path
- [ ] **File**: `tree-serialization.test.ts`
- [ ] Serialize tree → returns all leaf nodes
- [ ] Verify `pathParts` are correct (full path from root)
- [ ] Verify all files included, no sections
- [ ] Round-trip: create tree → serialize → create new tree → verify identical
- **Effort**: Low - Direct API calls, verify structure

### Level 2: Medium Tests (Tree Actions)

#### `LibraryTree.applyTreeAction()` - CreateNode
- [ ] **File**: `tree-actions.test.ts`
- [ ] Create ScrollNode → node appears in tree
- [ ] Create FileNode → node appears in tree
- [ ] Create SectionNode → node appears with empty children
- [ ] Create node with parent → parent's children includes new node
- [ ] Create duplicate node → returns existing chain (idempotent)
- **Effort**: Medium - Need to verify tree structure after each action

#### `LibraryTree.applyTreeAction()` - DeleteNode
- [ ] **File**: `tree-actions.test.ts`
- [ ] Delete leaf node → removed from parent's children
- [ ] Delete section node → removes entire subtree
- [ ] Delete non-existent node → returns chain (no-op)
- [ ] Delete node → parent's children updated
- **Effort**: Medium - Verify tree structure and parent relationships

#### `LibraryTree.applyTreeAction()` - ChangeNodeName
- [ ] **File**: `tree-actions.test.ts`
- [ ] Rename leaf node → `coreName` updated
- [ ] Rename section node → `coreName` updated
- [ ] Rename section → all children's `coreNameChainToParent` updated recursively
- [ ] Rename to existing name → throws error
- [ ] Verify `getNode()` works with new name
- **Effort**: Medium - Need to verify recursive updates

#### `LibraryTree.applyTreeAction()` - ChangeNodeStatus
- [ ] **File**: `tree-status-propagation.test.ts`
- [ ] Change ScrollNode status → only that node updated
- [ ] Change SectionNode status → all descendants updated recursively
- [ ] Change child to "Done" → parent checks children, updates if all done
- [ ] Change child to "NotStarted" → parent updates to "NotStarted"
- [ ] Change status propagates up to root
- [ ] Change FileNode status → no-op (returns early)
- **Effort**: Medium - Complex recursive logic to verify

### Level 3: Hard Tests (Complex Scenarios)

#### Status Propagation - Complex Tree
- [ ] **File**: `tree-status-propagation.test.ts`
- [ ] Multi-level tree with mixed statuses
- [ ] Change deep child → verify propagation up entire chain
- [ ] Change parent → verify propagation down entire subtree
- [ ] Multiple status changes in sequence → verify final state correct
- **Effort**: Hard - Complex state verification

#### Tree Building from Real Vault
- [ ] **File**: `read-tree-from-vault.test.ts`
- [ ] Create complex structure via vault actions
- [ ] Read tree from vault
- [ ] Verify tree matches actual vault structure
- [ ] Test with files that have complex basenames (long names, special chars)
- [ ] Test with nested folder structure (5+ levels)
- **Effort**: Hard - Need to verify against actual vault state

#### Round-trip: Actions → Tree → Serialize → Rebuild
- [ ] **File**: `tree-serialization.test.ts`
- [ ] Apply multiple tree actions
- [ ] Serialize to DTOs
- [ ] Create new tree from DTOs
- [ ] Verify trees are identical (structure, statuses, names)
- [ ] Test with various action sequences
- **Effort**: Hard - Complex state comparison

### Level 4: Very Hard Tests (Edge Cases & Integration)

#### Concurrent Tree Modifications
- [ ] **File**: `tree-actions.test.ts`
- [ ] Apply multiple actions in sequence
- [ ] Verify each action returns correct impacted node
- [ ] Verify final tree state is correct
- [ ] Test action ordering (create before delete, etc.)
- **Effort**: Very Hard - Complex state management

#### Integration with VaultActionManager
- [ ] **File**: `read-tree-from-vault.test.ts`
- [ ] Create structure via VaultActionManager
- [ ] Read tree from vault
- [ ] Apply tree actions
- [ ] Verify vault state matches tree state
- [ ] Test with actual file renames, moves, etc.
- **Effort**: Very Hard - Full integration testing

## Test Data

### Standard Test Structure
```
Library
- Avarar
  - S1
    - E1-S1-Avarar.md
    - E2-S1-Avarar.md
  - S2
    - E1
      - 000_E1-E1-S2-Avarar.md
      - 001_E1-E1-S2-Avarar.md
    - E2-S1-Avarar.md
```

### Test Helpers Needed

1. **`setupTestTree()`**: Creates test structure using `createTestTreeActions()`
2. **`verifyTreeStructure()`**: Asserts tree matches expected structure
3. **`getNodeByPath()`**: Helper to get node by human-readable path
4. **`assertNodeProperties()`**: Verify node has correct properties

## Implementation Order

1. **Phase 1**: Basic tree reading and navigation
   - `readTreeFromVault()` happy path
   - `getNode()` tests
   - `serializeToTreeLeafDtos()` basic tests

2. **Phase 2**: Tree actions
   - CreateNode tests
   - DeleteNode tests
   - ChangeNodeName tests
   - ChangeNodeStatus basic tests

3. **Phase 3**: Complex scenarios
   - Status propagation complex tests
   - Round-trip serialization
   - Complex tree structures

4. **Phase 4**: Integration
   - Full integration with VaultActionManager
   - Real vault state verification
   - Edge cases

## Notes

- Use `createTestTreeActions()` for consistent test setup
- Verify `coreNameChainToParent` is always correct after actions
- Test that `applyTreeAction()` returns correct impacted node
- Ensure status propagation works correctly up and down tree
- Test that serialization preserves all tree state
