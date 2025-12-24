# EnsureExist Actions Implementation Plan

## Goal

Add "EnsureExist" behavior using existing action types (`CreateFolder` and `UpsertMdFile` with `content: null`) to guarantee prerequisites exist before mutator actions execute. These actions are added recursively for all parent paths and sorted via topological sort to execute before dependent actions.

## Design Decisions

1. **No new action types**: Use existing `CreateFolder` (already idempotent) and `UpsertMdFile` with `content: null` (meaning "don't overwrite existing content")
2. **Recursive addition**: When ensuring a path, add EnsureExist actions for all parent folders
3. **Pure functions**: Extracted `getDestinationsToCheck` and `ensureDestinationsExist` as pure, testable functions
4. **Caching**: Existence checks cached in per-batch Sets for O(1) lookups (no redundant file ops)
5. **Trash wins**: If Trash and EnsureExist for same path exist, Trash wins and EnsureExist is filtered out
6. **Dependencies**: EnsureExist actions depend on parent EnsureExist actions; mutator actions depend on EnsureExist actions
7. **Collapse**: EnsureExist + Create/Upsert collapses to Create/Upsert (EnsureExist is absorbed)

## Implementation Status

### Phase 1: Update UpsertMdFile to Support null Content ✅

**Files**: 
- `src/obsidian-vault-action-manager/types/vault-action.ts`
- `src/obsidian-vault-action-manager/impl/executor.ts`

**Changes**:
- Updated `UpsertMdFilePayload.content` to `content?: string | null`
- Executor handles `content === null`: returns existing file if exists, creates with empty content if not
- JSDoc updated: `null` means "ensure file exists, don't overwrite if it already exists"

**Status**: ✅ Complete

---

### Phase 2: Refactor ensureAllRequirementsMet with Pure Functions ✅

**Files**:
- `src/obsidian-vault-action-manager/impl/dispatcher.ts`
- `src/obsidian-vault-action-manager/impl/ensure-requirements-helpers.ts` (new)

**Changes**:
- Extracted pure functions: `getDestinationsToCheck` and `ensureDestinationsExist`
- `getDestinationsToCheck`: Analyzes actions and returns all destinations that need checking
- `ensureDestinationsExist`: Handles existence checking with internal caching, returns actions to add
- Cache sets (checkedFolders, checkedFiles, existingFolders, existingFiles) moved inside `ensureDestinationsExist`
- Dispatcher now lean (~40 lines, down from ~330)
- Recursive EnsureExist actions for all parent folders
- Trash filtering (Trash wins over EnsureExist)
- Per-batch caching for O(1) existence checks

**Pure Functions Created**:
- `collectTrashPaths` - collects trash folder/file keys
- `collectRequirements` - collects required folder/file keys from actions
- `buildParentFolderKeys` - builds all parent folder keys from a splitPath
- `buildEnsureExistKeys` - builds EnsureExist keys recursively (filters out trash)
- `hasActionForKey` - checks if an action already exists in batch
- `getDestinationsToCheck` - analyzes actions and returns destinations to check
- `ensureDestinationsExist` - ensures destinations exist with caching

**Unit Tests**: ✅ 24 tests covering all pure functions

**Status**: ✅ Complete

---

### Phase 3: Update Dependency Graph to Handle EnsureExist Actions ✅

**File**: `src/obsidian-vault-action-manager/impl/dependency-detector.ts`

**Changes**:
1. `CreateFolder` (used as EnsureExist) depends on parent `CreateFolder` actions
2. `UpsertMdFile` with `content === null` (used as EnsureExist) depends on parent `CreateFolder` actions
3. Mutator actions (`ProcessMdFile`, `UpsertMdFile`) depend on `UpsertMdFile` (with any content, including null) for same file
4. Rename actions depend on destination parent `CreateFolder` actions

**Implementation**: Dependency graph already handled EnsureExist correctly - no changes needed. Added tests to verify:
- ProcessMdFile depends on UpsertMdFile with null content
- UpsertMdFile depends on UpsertMdFile with null content
- UpsertMdFile with null content depends on parent folders

**Status**: ✅ Complete

---

### Phase 4: Update Collapse to Handle EnsureExist Actions ✅

**File**: `src/obsidian-vault-action-manager/impl/collapse.ts`

**Changes**:
1. `CreateFolder` (EnsureExist) + `CreateFolder` (actual create) → `CreateFolder` (actual create) - already handled (idempotent)
2. `UpsertMdFile(null)` (EnsureExist) + `UpsertMdFile(content)` (actual create) → `UpsertMdFile(content)` (actual create)
3. `UpsertMdFile(null)` (EnsureExist) + `ProcessMdFile` → keep both (ProcessMdFile needs file to exist) - already handled
4. `UpsertMdFile(null)` (EnsureExist) + `UpsertMdFile` → `UpsertMdFile(content)` (merge) - already handled

**Implementation**: Updated collapse logic to handle `UpsertMdFile(null)` + `UpsertMdFile(content)` collapsing. Added tests for all scenarios.

**Status**: ✅ Complete

---

### Phase 5: Verify Topological Sort ✅

**File**: `src/obsidian-vault-action-manager/impl/topological-sort.ts`

**Changes**: Already works correctly since it uses dependency graph. No weights needed - topological sort handles ordering.

**Verification**: Added tests to verify:
- UpsertMdFile(null) sorts before ProcessMdFile
- EnsureExist folders sort recursively (parent before child)
- Complex dependency chains work correctly

**Status**: ✅ Complete

---

### Phase 6: Testing ✅

**Unit Tests**:
- [x] `UpsertMdFile` with `content: null` behavior
- [x] Pure functions (`collectTrashPaths`, `collectRequirements`, `buildParentFolderKeys`, `buildEnsureExistKeys`, `hasActionForKey`, `getDestinationsToCheck`, `ensureDestinationsExist`) - 24 tests
- [x] Dependency graph includes EnsureExist dependencies - 3 new tests
- [x] Collapse handles EnsureExist + Create/Upsert correctly - 4 new tests
- [x] Topological sort with EnsureExist - 2 new tests
- [x] Integration tests for EnsureExist scenarios - 4 tests

**Test Coverage**:
- EnsureExist actions execute before mutator actions ✅
- Recursive parent folder creation works ✅
- Collapse scenarios (EnsureExist + Create/Upsert) ✅
- Dependency graph with EnsureExist ✅
- Topological sort with EnsureExist ✅

**Status**: ✅ Complete

---

## Migration Checklist

- [x] Phase 1: Update UpsertMdFile to support null content
- [x] Phase 2: Refactor ensureAllRequirementsMet with pure functions
- [x] Phase 2: Add unit tests for pure functions
- [x] Phase 3: Update dependency graph (verified - already works)
- [x] Phase 4: Update collapse logic
- [x] Phase 5: Verify topological sort
- [x] Phase 6: Add comprehensive tests
- [x] Update documentation

---

## Questions Resolved

1. **Weight-based sorting**: ✅ Moving off weight-based for top-sort-only. EnsureExist actions don't need weights - handled by topological sort.
2. **Error handling**: ✅ If EnsureExist action fails, the batch fails (standard error collection).
3. **Performance**: ✅ Add per-batch cache of checked folders/files so majority of EnsureExist checks are O(1) without file ops. Cache existence checks during `ensureAllRequirementsMet`.
4. **Edge cases**: ✅ Trash should win, filter out EnsureExist. If both Trash and EnsureExist for same path exist, Trash wins and EnsureExist is filtered out.

