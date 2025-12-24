# Topological Sort Migration Plan

## Goal
Complete migration from weight-based action sorting to topological sort. Remove all weight-based logic entirely.

## Current State Analysis

### Architecture Assessment

#### ✅ **Is architecture clear?**

**YES** - Architecture is well-defined:

1. **Dependency Graph System** (`dependency-detector.ts`):
   - `buildDependencyGraph()` builds explicit dependency relationships
   - Rules are clear:
     - `ProcessMdFile` depends on `UpsertMdFile` for same file
     - Rename actions depend on `CreateFolder` for destination parents
     - `CreateFolder`/`UpsertMdFile`/`CreateFile` depend on parent folders
     - Trash actions have no dependencies

2. **Topological Sort** (`topological-sort.ts`):
   - Kahn's algorithm implementation
   - Path depth tie-breaking within same dependency level
   - Cycle detection

3. **Dispatcher** (`dispatcher.ts`):
   - Feature flag `useTopologicalSort = false` (currently disabled)
   - Dual-path: weight-based (legacy) vs topological (new)

4. **Integration Points**:
   - `ensureDestinationsExist()` adds EnsureExist actions
   - `collapseActions()` deduplicates actions
   - `topologicalSort()` respects dependencies

#### ⚠️ **Are there missing logic pieces?**

**YES** - Gaps identified:

1. **Missing Dependencies**:
   - ❌ **Rename dependencies**: `ensureDestinationsExist` should update dependencies when adding CreateFolder actions for rename destination parents. Currently not handled - **NEEDS FIX**
   - ✅ **Trash after Create**: Collapse handles this - no dependency needed
   - ✅ **ProcessMdFile → UpsertMdFile**: Already handled
   - ✅ **Parent folder dependencies**: Already handled (but may need verification after rename fix)

2. **Weight-based Logic Still Present**:
   - `weightForVaultActionType` map in `vault-action.ts`
   - `sortActionsByWeight()` function with complex tie-breaking
   - Special case: "UpsertMdFile before ProcessMdFile" handled in weight sort but should be in dependency graph (already is)

3. **Tie-breaking Logic**:
   - Weight sort: path depth + same-file priority (UpsertMdFile before ProcessMdFile)
   - Top sort: path depth only (within dependency level)
   - ✅ **No weight needed**: Dependency graph ensures UpsertMdFile → ProcessMdFile, path depth handles rest

4. **Test Coverage**:
   - ✅ Topological sort has tests
   - ✅ Weight-based sort has extensive tests
   - ✅ **Use existing e2e tests**: After migration, run e2e tests to verify everything works

#### ✅ **Does existing top-sort stuff fit together?**

**YES** - Components fit well:

1. **Dependency Graph → Topological Sort**: ✅
   - Graph provides `dependsOn` and `requiredBy`
   - Top sort uses graph correctly

2. **EnsureExist → Dependencies**: ✅
   - `ensureDestinationsExist()` adds `CreateFolder`/`UpsertMdFile` actions
   - Dependency detector finds parent folder dependencies
   - Top sort orders them correctly

3. **Collapse → Dependencies**: ✅
   - Collapse happens BEFORE dependency graph building
   - Collapsed actions have correct dependencies
   - No conflicts

4. **Path Depth Tie-breaking**: ✅
   - Top sort uses path depth within same dependency level
   - Matches weight-based behavior for independent actions

## Migration Plan

### Phase 1: Enable Topological Sort (Testing)

**Goal**: Verify topological sort works correctly in production

**Tasks**:
1. Enable `useTopologicalSort = true` in `Dispatcher`
2. Run existing test suite
3. Add integration tests comparing weight vs topological results
4. Monitor for regressions

**Files**:
- `src/obsidian-vault-action-manager/impl/dispatcher.ts` (line 40)

**Validation**:
- All existing tests pass
- Integration tests show equivalent ordering (where applicable)
- No production issues

**Rollback Plan**: Set `useTopologicalSort = false` if issues found

---

### Phase 2: Remove Weight-Based Code

**Goal**: Delete all weight-based logic

**Tasks**:

#### 2.1 Remove from `vault-action.ts`
- Delete `weightForVaultActionType` constant (lines 100-111)
- Delete `sortActionsByWeight()` function (lines 153-223)
- Remove weight-related imports if any

**Files**:
- `src/obsidian-vault-action-manager/types/vault-action.ts`

**Dependencies**: None (top sort already working)

#### 2.2 Remove from `dispatcher.ts`
- Remove `sortActionsByWeight` import
- Remove feature flag `useTopologicalSort`
- Remove conditional logic (lines 62-69)
- Always use topological sort

**Files**:
- `src/obsidian-vault-action-manager/impl/dispatcher.ts`

**Dependencies**: Phase 1 complete

#### 2.3 Update Tests
- Delete or migrate `sort.test.ts` tests
- Keep topological sort tests
- Add tests for edge cases that weight sort handled

**Files**:
- `tests/unit/obsidian-vault-action-manager/sort.test.ts` (delete or migrate)
- `tests/unit/vault-actions/vault-action-queue.test.ts` (update if uses weight sort)

**Dependencies**: Phase 2.1, 2.2 complete

---

### Phase 3: Fix Rename Dependencies

**Goal**: Ensure `ensureDestinationsExist` properly handles dependencies for rename actions

**Tasks**:

#### 3.1 Investigate Current Behavior
- Review `getDestinationsToCheck` - does it recursively check parent folders of rename destination parents?
- Review `ensureDestinationsExist` - when it adds CreateFolder for rename destination, does it also add parent folders?
- Review `buildDependencyGraph` - are newly added CreateFolder actions getting their parent dependencies?

**Files**:
- `src/obsidian-vault-action-manager/impl/ensure-requirements-helpers.ts`
- `src/obsidian-vault-action-manager/impl/dependency-detector.ts`

#### 3.2 Fix Rename Dependencies
- Ensure `getDestinationsToCheck` recursively finds all parent folders needed for rename destinations
- Verify `ensureDestinationsExist` adds all necessary parent CreateFolder actions
- Verify `buildDependencyGraph` correctly sets dependencies for newly added actions
- Add tests for rename with nested destination paths

**Files**:
- `src/obsidian-vault-action-manager/impl/ensure-requirements-helpers.ts`
- `src/obsidian-vault-action-manager/impl/dependency-detector.ts`
- `tests/unit/obsidian-vault-action-manager/ensure-requirements-helpers.test.ts`

**Dependencies**: Phase 2 complete

---

### Phase 4: Verify Dependency Coverage

**Goal**: Ensure all implicit weight-based ordering is captured in dependencies

**Tasks**:

#### 4.1 Review Weight-Based Ordering Rules
From `sortActionsByWeight()`:
1. ✅ Folders before files before content ops → **Handled by dependencies**
2. ✅ Path depth (shallow first) → **Handled by top sort tie-breaking**
3. ✅ UpsertMdFile before ProcessMdFile (same file) → **Handled by dependency graph**

#### 4.2 Verify No Missing Dependencies
- **Rename ordering**: Weight sort had RenameFolder(1) < RenameFile(4) < RenameMdFile(7)
  - ✅ **Decision**: No dependency needed - path depth tie-breaking sufficient

- **Trash ordering**: Weight sort had TrashFolder(2) < TrashFile(5) < TrashMdFile(8)
  - ✅ **Decision**: No dependency needed - path depth tie-breaking sufficient

#### 4.3 Run E2E Tests
- Use existing e2e tests to verify migration success
- All e2e tests should pass with topological sort
- No regressions in action ordering

**Files**:
- All e2e test files in `tests/specs/`

**Dependencies**: Phase 3 complete

---

### Phase 5: Cleanup and Documentation

**Goal**: Final cleanup and documentation

**Tasks**:

#### 4.1 Remove Dead Code
- Search for any remaining weight references
- Remove unused imports
- Clean up comments mentioning weights

**Files**: All files in `obsidian-vault-action-manager/`

#### 4.2 Update Documentation
- Update `action-dependency-system.md` to reflect completion
- Update `ensure-exist-actions.md` if needed
- Add migration notes if relevant

**Files**:
- `docs/plans/action-dependency-system.md`
- `docs/plans/ensure-exist-actions.md`

#### 4.3 Code Review
- Review dependency rules for completeness
- Verify no performance regressions
- Ensure error messages are clear

**Dependencies**: All phases complete

---

## Risk Assessment

### Low Risk ✅
- Topological sort already implemented and tested
- Dependency graph logic is sound
- Path depth tie-breaking matches weight behavior

### Medium Risk ⚠️
- **Test coverage**: Need integration tests comparing both systems
- **Edge cases**: Some weight-based tie-breaking might have subtle differences
- **Performance**: Top sort might be slightly slower (should measure)

### Mitigation
1. Enable feature flag first (Phase 1) - easy rollback
2. Comprehensive integration tests
3. Monitor production metrics
4. Keep weight code until confident (Phase 2)

---

## Additional Considerations

### Performance
- **Top sort complexity**: O(V + E) where V = actions, E = dependencies
- **Weight sort complexity**: O(V log V) for grouping + sorting
- **Expected impact**: Top sort should be similar or faster for typical batch sizes (< 100 actions)
- **Action**: Monitor performance after migration

### Error Handling
- **Cycle detection**: Top sort throws error if cycle detected
- **Weight sort**: No cycle detection (assumes no cycles)
- **Action**: Verify cycle detection works correctly (shouldn't happen for file ops)

### Edge Cases
- **Empty batches**: Both handle correctly
- **Single action**: Both handle correctly
- **Independent actions**: Top sort uses path depth (same as weight)
- **Same-file actions**: Top sort uses dependencies (better than weight)

### Backward Compatibility
- **No API changes**: Dispatcher interface unchanged
- **Internal only**: Migration is internal refactor
- **Action**: No breaking changes expected

---

## Success Criteria

1. ✅ Topological sort enabled and working in production
2. ✅ All weight-based code removed
3. ✅ All tests passing
4. ✅ No regressions in action ordering
5. ✅ Documentation updated
6. ✅ Code review complete

---

## Timeline Estimate

- **Phase 1**: 1-2 days (enable flag, test, monitor)
- **Phase 2**: 1 day (remove code)
- **Phase 3**: 1-2 days (fix rename dependencies, test)
- **Phase 4**: 0.5 day (verify dependencies, run e2e)
- **Phase 5**: 0.5 day (cleanup)

**Total**: ~4-5 days

---

## Other Questions & Considerations

### Q1: What if dependency graph is incomplete?
**Risk**: Missing dependencies could cause execution order issues
**Mitigation**: 
- Phase 3 explicitly fixes rename dependencies
- E2E tests will catch any ordering issues
- Top sort will error on cycles (safety net)

### Q2: What about actions added during collapse?
**Current**: Collapse happens before dependency graph building
**Status**: ✅ Safe - collapsed actions included in graph

### Q3: What about actions added during ensureDestinationsExist?
**Current**: Actions added, then dependency graph built
**Status**: ⚠️ Needs verification in Phase 3 - ensure newly added actions get correct dependencies

### Q4: Performance impact?
**Consideration**: Top sort might be slower for very large batches
**Action**: Monitor performance, optimize if needed (unlikely to be issue)

### Q5: Debugging dependency issues?
**Consideration**: Harder to debug dependency graph than weight-based ordering
**Mitigation**: 
- Clear error messages on cycle detection
- Can log dependency graph for debugging
- Tests document expected dependencies

### Q6: What if we need to add new action types?
**Consideration**: Need to update dependency detector
**Status**: ✅ Clear process - add to `findDependenciesForAction` switch statement

### Q7: Should we add dependency visualization?
**Consideration**: Could help with debugging
**Decision**: Not needed for migration, but could be useful future enhancement

## Notes

- Legacy weight-based system in `background-vault-actions.ts` is separate and not affected
- Topological sort already handles all critical dependencies (except rename - Phase 3 fix)
- Path depth tie-breaking preserves weight-based behavior for independent actions
- No breaking changes expected - ordering should be equivalent or better
- E2E tests provide final validation

