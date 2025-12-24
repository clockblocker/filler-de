# Topological Sort Migration Plan

## Goal

Replace weight-based sorting with explicit dependency graph + topological sort for guaranteed correct execution order.

## Current State

- **Dispatcher flow**: `ensureAllDestinationsExist` → `collapseActions` → `sortActionsByWeight` → `execute`
- **Sorting**: Weight-based (0-10) + path depth + same-file heuristics
- **Dependencies**: Implicit, handled by weights and heuristics
- **Issues**: Same-file dependencies not guaranteed, system-generated actions can conflict

## Target State

- **Dispatcher flow**: `ensureAllRequirementsMet` → `collapseActions` → `buildDependencyGraph` → `topologicalSort` → `execute`
- **Sorting**: Topological sort (Kahn's algorithm) respecting explicit dependencies
- **Dependencies**: Explicit graph, computed from action types and paths
- **Benefits**: Guaranteed ordering, no conflicts, easier debugging

## Invariant: Executor Requirements

**Critical Invariant**: When actions are passed to executor, all requirements are met.

The dispatcher enforces this invariant in `ensureAllRequirementsMet()`:

1. **File/Folder Existence**:
   - `ProcessMdFile`/`UpsertMdFile`: File + folder chain exist (added if needed)
   - `RenameFile`/`RenameFolder`: Destination parent folders exist (added if needed)
   - `CreateFolder`/`UpsertMdFile`: Only added if they don't already exist

2. **Delete Actions**:
   - `TrashFile`/`TrashFolder`: Only execute if target exists (filtered out if not)

3. **Executor Simplification**:
   - Executor assumes all requirements are met
   - No existence checks in executor (removed `ensureFileExists()`)
   - Executor focuses solely on executing actions

This invariant ensures:
- No redundant operations (don't create what already exists)
- No invalid operations (don't delete what doesn't exist)
- Clear separation of concerns (dispatcher = requirements, executor = execution)

---

## Phase 1: Core Infrastructure (No Breaking Changes)

### 1.1 Create Dependency Types

**File**: `src/obsidian-vault-action-manager/types/dependency.ts` (new)

```typescript
import type { VaultAction } from "./vault-action";

/**
 * Dependency relationship between two actions.
 */
export type ActionDependency = {
  /** Action that depends on others */
  action: VaultAction;
  /** Actions that must execute before this one */
  dependsOn: VaultAction[];
  /** Actions that require this one (inverse of dependsOn) */
  requiredBy: VaultAction[];
};

/**
 * Dependency graph: map from action key to dependency info.
 */
export type DependencyGraph = Map<string, ActionDependency>;

/**
 * Action key for dependency tracking.
 * Uses same key format as getActionKey() for consistency.
 */
export type ActionKey = string;
```

**Tasks**:
- [ ] Create file with types
- [ ] Export from `types/index.ts`
- [ ] Add JSDoc comments

---

### 1.2 Create Dependency Detection

**File**: `src/obsidian-vault-action-manager/impl/dependency-detector.ts` (new)

```typescript
import type { VaultAction } from "../types/vault-action";
import { VaultActionType } from "../types/vault-action";
import type { DependencyGraph } from "../types/dependency";
import { getActionKey, coreSplitPathToKey } from "../types/vault-action";
import { makeSystemPathForSplitPath } from "./split-path";

/**
 * Build dependency graph from actions.
 * 
 * Rules:
 * - ProcessMdFile/UpsertMdFile depends on UpsertMdFile for same file
 * - Rename actions depend on CreateFolder for destination parent folders
 * - Trash actions have no dependencies
 * - CreateFolder depends on parent CreateFolder actions
 */
export function buildDependencyGraph(actions: VaultAction[]): DependencyGraph {
  // Implementation: analyze each action, find dependencies
}
```

**Dependency Rules**:

1. **File content operations**:
   - `ProcessMdFile` → depends on `UpsertMdFile` (same file)
   - `UpsertMdFile` → depends on `UpsertMdFile` (same file)

2. **Folder operations**:
   - `CreateFolder` → depends on parent `CreateFolder` actions
   - `RenameFolder` → depends on destination parent `CreateFolder` actions

3. **File operations**:
   - `RenameFile/RenameMdFile` → depends on destination parent `CreateFolder` actions

4. **No dependencies**:
   - `TrashFolder`, `TrashFile`, `TrashMdFile`
   - `CreateFile`, `UpsertMdFile` (only folder dependencies)

**Tasks**:
- [ ] Implement `buildDependencyGraph()`
- [ ] Add helper: `findDependenciesForAction(action, allActions)`
- [ ] Add helper: `getParentFolderKeys(splitPath)`
- [ ] Add unit tests for each dependency rule
- [ ] Handle edge cases (root folder, same action twice)

---

### 1.3 Create Topological Sort

**File**: `src/obsidian-vault-action-manager/impl/topological-sort.ts` (new)

```typescript
import type { VaultAction } from "../types/vault-action";
import type { DependencyGraph } from "../types/dependency";

/**
 * Topological sort using Kahn's algorithm.
 * 
 * Within each dependency level, sort by path depth (shallow first).
 * This ensures parent folders are created before children when there are no explicit dependencies.
 * 
 * Returns sorted actions respecting dependencies.
 */
export function topologicalSort(
  actions: VaultAction[],
  graph: DependencyGraph
): VaultAction[] {
  // Kahn's algorithm implementation
}
```

**Algorithm**:
1. Build in-degree map (how many dependencies each action has)
2. Start with actions that have 0 dependencies
3. Process level by level:
   - Sort level by path depth (shallow first) - no weights needed
   - Remove processed actions from graph
   - Add newly available actions (dependencies satisfied)
4. Repeat until all actions processed
5. Detect cycles (shouldn't happen for file ops, but safety check)

**Tie-breaking**: Path depth only (no weights). Dependencies handle all required ordering.

**Tasks**:
- [x] Implement Kahn's algorithm
- [x] Add tie-breaking: path depth only (weights removed)
- [x] Add cycle detection (throw error if found)
- [ ] Add unit tests (simple cases, complex cases, cycles)
- [ ] Performance test (1000+ actions)

---

## Phase 2: Integration (Feature Flag)

### 2.1 Add Feature Flag

**File**: `src/obsidian-vault-action-manager/impl/dispatcher.ts`

**Tasks**:
- [ ] Add feature flag (private field)
- [ ] Add conditional logic in `dispatch()`
- [ ] Import new functions
- [ ] Keep old path as fallback

---

### 2.2 Update ensureAllDestinationsExist

**Tasks**:
- [ ] Add optional marker to system-generated actions
- [ ] Update dependency detection to handle markers
- [ ] Ensure system-generated actions have lower priority in tie-breaking

---

## Phase 3: Collapse Integration

### 3.1 Make Collapse Dependency-Aware

**File**: `src/obsidian-vault-action-manager/impl/collapse.ts`

When collapsing, preserve dependency relationships:

```typescript
export async function collapseActions(
  actions: readonly VaultAction[],
  graph?: DependencyGraph // Optional: if provided, preserve dependencies
): Promise<VaultAction[]> {
  // Current collapse logic...
  
  // After collapse, if graph provided:
  // - Rebuild graph for collapsed actions
  // - Ensure dependencies still valid
}
```

**Key Insight**: Collapse can merge actions, but dependencies must be preserved.

**Example**:
- `UpsertMdFile("initial")` + `ProcessMdFile("+A")` → `ProcessMdFile` (reads from disk)
- Dependency: `ProcessMdFile` depends on file existing
- After collapse: Still need to ensure file exists before processing

**Tasks**:
- [x] Re-ensure requirements after collapse (simpler than graph parameter)
- [x] After collapse, re-run `ensureAllRequirementsMet` to restore missing UpsertMdFile
- [x] Add tests: collapse preserves dependencies
- [x] Handle edge case: collapse removes UpsertMdFile needed for ProcessMdFile (re-ensured)

---

## Phase 4: Testing & Validation

### 4.1 Unit Tests

**File**: `tests/unit/dependency-detector.test.ts` (new)

- [x] Test each dependency rule
- [x] Test complex scenarios (multiple files, nested folders)
- [x] Test edge cases (root folder, same action twice)

**File**: `tests/unit/topological-sort.test.ts` (new)

- [x] Test simple linear dependencies
- [x] Test parallel actions (no dependencies)
- [x] Test complex graph (multiple levels)
- [x] Test cycle detection
- [x] Test tie-breaking (path depth only)

**File**: `tests/unit/collapse-dependency.test.ts` (new)

- [x] Test UpsertMdFile + ProcessMdFile collapse preserves dependency needs
- [x] Test folder dependencies preserved after collapse
- [x] Test UpsertMdFile + UpsertMdFile collapse
- [x] Test multiple ProcessMdFile collapse

### 4.2 Integration Tests

**File**: `tests/specs/dispatcher/dependency-sorting.e2e.ts` (new)

- [ ] Test ProcessMdFile after UpsertMdFile
- [ ] Test RenameFolder after CreateFolder
- [ ] Test complex batch with mixed dependencies
- [ ] Compare results: topological vs weight-based (should match for simple cases)

### 4.3 Regression Tests

- [ ] Run all existing e2e tests with feature flag ON
- [ ] Verify no behavior changes (except ordering improvements)
- [ ] Fix any issues found

---

## Phase 5: Gradual Rollout

### 5.1 Enable for Specific Scenarios

Start with low-risk scenarios:

```typescript
// Enable for ProcessMdFile/UpsertMdFile batches
if (actions.some(a => 
  a.type === VaultActionType.ProcessMdFile || 
  a.type === VaultActionType.UpsertMdFile
)) {
  this.useTopologicalSort = true;
}
```

**Tasks**:
- [ ] Add conditional enable logic
- [ ] Monitor for issues
- [ ] Gradually expand to all scenarios

### 5.2 Full Enablement

Once validated:

```typescript
private useTopologicalSort = true; // Always on
```

**Tasks**:
- [ ] Remove feature flag
- [ ] Remove fallback to `sortActionsByWeight`
- [ ] Update documentation

---

## Phase 6: Cleanup

### 6.1 Remove Weight-Based Sorting

**File**: `src/obsidian-vault-action-manager/types/vault-action.ts`

- [ ] Mark `sortActionsByWeight()` as deprecated
- [ ] Remove after migration complete
- [ ] Remove `weightForVaultActionType` (no longer needed - topological sort uses path depth only)

### 6.2 Documentation

- [ ] Update architecture docs
- [ ] Add dependency graph visualization (optional)
- [ ] Document dependency rules

---

## Migration Checklist

### Pre-Migration
- [ ] All existing tests passing
- [ ] Feature flag infrastructure ready
- [ ] Rollback plan documented

### Phase 1: Infrastructure
- [x] Dependency types created
- [x] Dependency detector implemented
- [x] Topological sort implemented (path depth tie-breaking, no weights)
- [ ] Unit tests passing

### Phase 2: Integration
- [x] Feature flag added
- [x] Dispatcher updated
- [ ] ensureAllDestinationsExist enhanced (optional - can skip for now)
- [ ] Integration tests passing

### Phase 3: Collapse
- [ ] Collapse made dependency-aware
- [ ] Tests for collapse + dependencies

### Phase 4: Testing
- [ ] All unit tests passing
- [ ] All e2e tests passing
- [ ] Performance acceptable

### Phase 5: Rollout
- [ ] Full enablement

### Phase 6: Cleanup
- [ ] Old code removed
- [ ] Documentation updated

---

## Risk Mitigation

1. **Feature Flag**: Easy rollback if issues found
2. **Gradual Rollout**: Start with low-risk scenarios
3. **Comprehensive Testing**: Unit + integration + e2e
4. **Backward Compatibility**: Keep weight-based as fallback initially
5. **Monitoring**: Log when topological sort used, compare results

---

## Performance Considerations

- **Topological Sort**: O(V + E) where V = actions, E = dependencies
- **Typical batch**: < 100 actions, < 200 dependencies → < 1ms
- **Worst case**: 1000 actions → ~10ms (acceptable)
- **Cache**: Dependency graph can be cached if needed

---

## Questions to Resolve

1. **System-generated actions**: Should they have special handling in dependencies?
   - Answer: Yes, mark them, give lower priority in tie-breaking

2. **Collapse + Dependencies**: How to handle when collapse merges actions?
   - Answer: Rebuild graph after collapse, dependencies should still be valid

3. **Weight preservation**: Keep weights for tie-breaking?
   - Answer: **No** - removed weights entirely. Dependencies handle ordering, path depth is sufficient for tie-breaking within same dependency level

4. **Error handling**: What if cycle detected?
   - Answer: Throw error with cycle details (shouldn't happen for file ops)

---

## Timeline Estimate

- **Phase 1**: 2-3 days (infrastructure)
- **Phase 2**: 1-2 days (integration)
- **Phase 3**: 1 day (collapse)
- **Phase 4**: 2-3 days (testing)
- **Phase 5**: 1 week (gradual rollout)
- **Phase 6**: 1 day (cleanup)

**Total**: ~2-3 weeks

---

## Success Criteria

1. ✅ All existing tests pass
2. ✅ Topological sort correctly orders actions
3. ✅ No performance regression
4. ✅ Dependency graph correctly identifies all dependencies
5. ✅ System-generated actions don't conflict with user actions
6. ✅ Easy to debug (can visualize dependency graph)

