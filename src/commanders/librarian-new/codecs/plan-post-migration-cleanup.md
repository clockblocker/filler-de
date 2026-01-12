# Post-Migration Cleanup Plan - Test Failures

## Critical Issues Found After Migration

### 1. Import Path Error in `split.ts` ⚠️ BLOCKING

**File**: `src/commanders/librarian-new/healer/library-tree/codecs/internal/suffix/split.ts:3`

**Error**: 
```
Cannot find module '../../../../../../types/utils' from 'split.ts'
```

**Issue**: Wrong relative import path. File is at:
- `src/commanders/librarian-new/healer/library-tree/codecs/internal/suffix/split.ts`
- Trying to import: `../../../../../../types/utils` (7 levels up - WRONG)
- Should be: `../../../../../../../types/utils` (8 levels up - CORRECT)
- Verified: Path exists at `../../../../../../../types/utils.ts` from `split.ts` location

**Impact**: Blocks all tests that import codec modules (cascading failure).

**Fix**: Update import path to correct relative path or use absolute import from `src/types/utils`.

---

### 2. `tryParseTreeNode` Function Signature Changed ⚠️ BREAKING

**File**: `tests/unit/librarian/library-tree/tree-node/codecs/node-and-segment-id.test.ts`

**Error**: Tests call `tryParseTreeNode(segmentId)` but function now requires `TreeNodeCodecs` as first parameter.

**Current signature** (from Phase 2):
```typescript
export function tryParseTreeNode(
  treeNodeCodecs: TreeNodeCodecs,
  dirtySegmentId: string,
): Result<TreeNode, CodecError>
```

**Test calls** (old signature):
```typescript
const result = tryParseTreeNode(segmentId); // Missing TreeNodeCodecs
```

**Failing tests**:
- `tryParseTreeNode > parses valid Section segment ID`
- `tryParseTreeNode > parses valid Scroll segment ID`
- `tryParseTreeNode > parses valid File segment ID`
- `tryParseTreeNode and makeTreeNode consistency > tryParseTreeNode produces same result as makeTreeNode for valid input`

**Fix**: Update tests to:
1. Create codecs using `makeCodecRulesFromSettings(defaultSettingsForUnitTests)` and `makeCodecs(rules)`
2. Create `TreeNodeCodecs` using `makeTreeNodeCodecs(codecs.segmentId)`
3. Pass `TreeNodeCodecs` as first parameter to `tryParseTreeNode`

**Pattern**:
```typescript
const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
const codecs = makeCodecs(rules);
const treeNodeCodecs = makeTreeNodeCodecs(codecs.segmentId);
const result = tryParseTreeNode(treeNodeCodecs, segmentId);
```

---

### 3. `makeEventLibraryScoped` Function Signature Changed ⚠️ BREAKING

**File**: `tests/unit/librarian/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/make-library-scoped.test.ts`

**Error**: Tests call `makeEventLibraryScoped(event)` but function now requires `CodecRules` as second parameter.

**Current signature** (from Phase 3):
```typescript
export function makeEventLibraryScoped(
  event: VaultEvent,
  rules: CodecRules,
): EnscopedEvent<VaultEvent>
```

**Test calls** (old signature):
```typescript
const result = makeEventLibraryScoped(event); // Missing CodecRules
```

**Error message**:
```
TypeError: undefined is not an object (evaluating 'rules.libraryRootPathParts')
```

**Failing tests**:
- All `makeEventLibraryScoped` tests in `make-library-scoped.test.ts` (FileCreated, FileRenamed, FileDeleted, FolderCreated, FolderRenamed, FolderDeleted)
- All `makeEventLibraryScoped` tests in `roundtrip.test.ts` (11 test cases)

**Fix**: Update tests to:
1. Create `CodecRules` using `makeCodecRulesFromSettings(defaultSettingsForUnitTests)` (or from spy)
2. Pass `rules` as second parameter to `makeEventLibraryScoped`

**Pattern**:
```typescript
const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
const result = makeEventLibraryScoped(event, rules);
```

**Note**: Tests use `setupGetParsedUserSettingsSpy()` - should extract rules from spy return value or create rules directly from `defaultSettingsForUnitTests`.

---

### 4. Module Loading Errors (Cascading from Issue #1)

**Impact**: Tests that import codec modules fail to load due to import error in `split.ts`:
- `codex/generate-codex-content.test.ts`
- `codex/codex-split-path.test.ts`
- `codex/codex-impact-to-actions.test.ts`
- `codex/codex-init-nested.test.ts`
- `tree-action/bulk-vault-action-adapter/index.test.ts`

**Fix**: Resolve Issue #1 first - these should pass once import is fixed.

---

## Summary of Required Fixes

### Priority 1 (Blocking)
1. ✅ Fix import path in `split.ts` - blocks all codec module loading

### Priority 2 (Breaking Changes)
2. ✅ Update `tryParseTreeNode` tests - function signature changed (Phase 2)
3. ✅ Update `makeEventLibraryScoped` tests - function signature changed (Phase 3)

### Priority 3 (Verify After Fixes)
4. ✅ Re-run tests to verify cascading failures are resolved

---

## Migration Pattern for Tests

**Before** (old API):
```typescript
const result = tryParseTreeNode(segmentId);
const scoped = makeEventLibraryScoped(event);
```

**After** (new API):
```typescript
// Setup codecs
const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
const codecs = makeCodecs(rules);
const treeNodeCodecs = makeTreeNodeCodecs(codecs.segmentId);

// Use codecs
const result = tryParseTreeNode(treeNodeCodecs, segmentId);
const scoped = makeEventLibraryScoped(event, rules);
```

---

## Affected Files Summary

### Test Files Requiring Updates
1. `tests/unit/librarian/library-tree/tree-node/codecs/node-and-segment-id.test.ts`
   - 7 calls to `tryParseTreeNode` need `TreeNodeCodecs` parameter
   
2. `tests/unit/librarian/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/make-library-scoped.test.ts`
   - 18 calls to `makeEventLibraryScoped` need `CodecRules` parameter
   
3. `tests/unit/librarian/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/roundtrip.test.ts`
   - 11 calls to `makeEventLibraryScoped` need `CodecRules` parameter

### Source Files Requiring Fixes
1. `src/commanders/librarian-new/healer/library-tree/codecs/internal/suffix/split.ts`
   - Import path needs correction (line 3)

### Total Impact
- **1 source file** with import error (blocking)
- **3 test files** with function signature mismatches
- **~36 test cases** affected by signature changes
- **5+ test files** blocked by import error (cascading)

---

## Notes

- **Function signature changes**: Both `tryParseTreeNode` and `makeEventLibraryScoped` were updated during migration to accept codec dependencies, but tests weren't updated.
- **Import path**: Relative path calculation error in `split.ts` - verified correct path is `../../../../../../../types/utils` (8 levels up).
- **Test helpers**: Consider creating test helpers for codec setup to reduce boilerplate:
  - `makeTestCodecs()` - returns `{ codecs, rules, treeNodeCodecs }`
  - `makeTestRules()` - returns `CodecRules` from default settings
