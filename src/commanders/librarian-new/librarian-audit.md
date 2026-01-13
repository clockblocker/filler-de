# Librarian.ts Audit Report

## 1. Places where existing codecs should be used instead of hand-written logic

### Issue 1: Manual path string construction (Lines 308-311, 338-341)

**Current code:**
```typescript
const filePath = [
    ...libraryScopedResult.value.pathParts,
    libraryScopedResult.value.basename,
].join("/");
```

**Problem:** Manual string concatenation instead of using existing path utilities.

**Solution:** Use `systemPathFromSplitPathInternal` from `vault-action-manager/helpers/pathfinder`:
```typescript
import { systemPathFromSplitPathInternal } from "../../managers/obsidian/vault-action-manager/helpers/pathfinder";
const filePath = systemPathFromSplitPathInternal(libraryScopedResult.value);
```

**Locations:**
- Line 308-311 in `findInvalidCodexFiles`
- Line 338-341 in `collectValidCodexPaths`

### Issue 2: Repeated codex checking pattern (Lines 195-202, 295-299, 381-388)

**Current code:** Repeated pattern:
```typescript
const coreNameResult = this.codecs.suffix.parseSeparatedSuffix(file.basename);
if (coreNameResult.isErr()) continue;
if (coreNameResult.value.coreName !== CODEX_CORE_NAME) continue;
```

**Problem:** Logic is duplicated 3 times. Similar pattern exists in `translate-material-events.ts` as `isCodexEvent`.

**Solution:** Extract to helper function in `healer/library-tree/codex/`:
```typescript
// In healer/library-tree/codex/helpers.ts
export function isCodexSplitPath(
    splitPath: { basename: string },
    codecs: Codecs,
): boolean {
    const result = codecs.suffix.parseSeparatedSuffix(splitPath.basename);
    return result.isOk() && result.value.coreName === CODEX_CORE_NAME;
}
```

**Locations:**
- Line 195-202 in `buildInitialCreateActions`
- Line 295-299 in `findInvalidCodexFiles`
- Line 381-388 in `handleCheckboxClick`

## 2. Functions that can be made pure and moved to helpers/codecs

### Function 1: `extractScrollStatusActions` (Lines 596-645)

**Current:** Private method in `Librarian` class.

**Issues:**
- Pure function (no side effects, only depends on inputs)
- Uses `this.codecs` - should accept as parameter
- Could be reused elsewhere

**Solution:** Move to `healer/library-tree/utils/`:
```typescript
// In healer/library-tree/utils/extract-scroll-status-actions.ts
export function extractScrollStatusActions(
    actions: TreeAction[],
    codecs: Codecs,
): WriteScrollStatusAction[]
```

**Dependencies:** Already uses `extractNodeNameFromScrollSegmentId` and `computeScrollSplitPath` which should also be extracted.

### Function 2: `extractNodeNameFromScrollSegmentId` (Lines 650-659)

**Current:** Private method in `Librarian` class.

**Issues:**
- Pure function
- Only uses codec API
- Could be useful utility

**Solution:** Move to `healer/library-tree/utils/` or `codecs/segment-id/helpers.ts`:
```typescript
// In healer/library-tree/utils/segment-id-helpers.ts
export function extractNodeNameFromScrollSegmentId(
    segmentId: ScrollNodeSegmentId,
    codecs: Codecs,
): Result<string, CodecError>
```

### Function 3: `computeScrollSplitPath` (Lines 664-719)

**Current:** Private method in `Librarian` class.

**Issues:**
- Pure function
- Complex logic that could be reused
- Similar function exists in `codex-impact-to-actions.ts` (line 201) - should consolidate

**Solution:** Move to `healer/library-tree/utils/` and reuse in both places:
```typescript
// In healer/library-tree/utils/compute-scroll-split-path.ts
export function computeScrollSplitPath(
    nodeName: string,
    parentChain: SectionNodeSegmentId[],
    codecs: Codecs,
): Result<SplitPathToMdFileInsideLibrary, CodecError>
```

**Note:** There's a similar function in `codex-impact-to-actions.ts` that returns `SplitPathToMdFileInsideLibrary` directly (not Result). Should consolidate both.

### Function 4: `collectValidCodexPaths` (Lines 327-350)

**Current:** Private method in `Librarian` class.

**Issues:**
- Pure function (only depends on tree structure and codecs)
- Uses `this.codecs` - should accept as parameter
- Could be useful for testing/debugging

**Solution:** Move to `healer/library-tree/utils/`:
```typescript
// In healer/library-tree/utils/collect-codex-paths.ts
export function collectValidCodexPaths(
    section: SectionNode,
    parentChain: SectionNodeSegmentId[],
    codecs: Codecs,
): Set<string>
```

### Function 5: `findInvalidCodexFiles` (Lines 279-322)

**Current:** Private method that depends on `this.healer`.

**Issues:**
- Could be pure if healer is passed as parameter
- Logic is self-contained

**Solution:** Make pure by accepting healer as parameter:
```typescript
// In healer/library-tree/utils/find-invalid-codex-files.ts
export function findInvalidCodexFiles(
    allFiles: SplitPathWithReader[],
    healer: Healer,
    codecs: Codecs,
    rules: CodecRules,
): HealingAction[]
```

**Note:** Also uses `tryParseAsInsideLibrarySplitPath` which is already a helper.

## Summary

### High Priority (Use existing codecs)
1. Replace manual path string construction with `systemPathFromSplitPathInternal` (2 locations)
2. Extract codex checking to helper function (3 locations)

### Medium Priority (Extract pure functions)
3. Extract `extractScrollStatusActions` to utils
4. Extract `extractNodeNameFromScrollSegmentId` to utils
5. Extract `computeScrollSplitPath` to utils (consolidate with existing in codex-impact-to-actions.ts)
6. Extract `collectValidCodexPaths` to utils
7. Make `findInvalidCodexFiles` pure and move to utils

### Benefits
- **Type safety:** Using codec APIs ensures consistent validation
- **Reusability:** Pure functions can be tested and reused
- **Maintainability:** Centralized logic reduces duplication
- **Testability:** Pure functions are easier to unit test
