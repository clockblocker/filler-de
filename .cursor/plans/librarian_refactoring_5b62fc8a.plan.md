---
name: Librarian Refactoring
overview: Refactor `librarian.ts` to use existing codecs and extract pure functions to utils, improving type safety, reusability, and maintainability.
todos:
  - id: create-codex-helper
    content: Create `isCodexSplitPath` helper in `healer/library-tree/codex/helpers.ts`
    status: pending
  - id: create-segment-id-helper
    content: Create `extractNodeNameFromScrollSegmentId` in `healer/library-tree/utils/segment-id-helpers.ts`
    status: pending
  - id: consolidate-compute-scroll-split-path
    content: Create consolidated `computeScrollSplitPath` in `healer/library-tree/utils/compute-scroll-split-path.ts` (Result-returning version)
    status: pending
  - id: extract-collect-codex-paths
    content: Extract `collectValidCodexPaths` to `healer/library-tree/utils/collect-codex-paths.ts`
    status: pending
  - id: extract-find-invalid-codex-files
    content: Extract `findInvalidCodexFiles` to `healer/library-tree/utils/find-invalid-codex-files.ts`
    status: pending
  - id: extract-scroll-status-actions
    content: Extract `extractScrollStatusActions` to `healer/library-tree/utils/extract-scroll-status-actions.ts`
    status: pending
    dependencies:
      - create-segment-id-helper
      - consolidate-compute-scroll-split-path
  - id: update-librarian-path-construction
    content: Replace manual path construction with `systemPathFromSplitPathInternal` in `librarian.ts` (2 locations)
    status: pending
  - id: update-librarian-codex-checks
    content: Replace codex checking logic with `isCodexSplitPath` helper in `librarian.ts` (3 locations)
    status: pending
    dependencies:
      - create-codex-helper
  - id: update-librarian-use-helpers
    content: Update `librarian.ts` to use all extracted helper functions
    status: pending
    dependencies:
      - extract-scroll-status-actions
      - extract-collect-codex-paths
      - extract-find-invalid-codex-files
  - id: update-codex-impact-actions
    content: Update `codex-impact-to-actions.ts` to use consolidated `computeScrollSplitPath` with Result handling
    status: pending
    dependencies:
      - consolidate-compute-scroll-split-path
isProject: false
---

# Librarian.ts Refactoring Plan

## Overview

Refactor `librarian.ts` to replace manual logic with existing codecs and extract pure functions to reusable utilities.

## High Priority: Use Existing Codecs

### 1. Replace Manual Path Construction

**Files**: `[src/commanders/librarian-new/librarian.ts](src/commanders/librarian-new/librarian.ts)`

- **Lines 308-311** (`findInvalidCodexFiles`): Replace manual `join("/")` with `systemPathFromSplitPathInternal`
- **Lines 338-341** (`collectValidCodexPaths`): Replace manual `join("/")` with `systemPathFromSplitPathInternal`

**Import**: `systemPathFromSplitPathInternal` from `../../managers/obsidian/vault-action-manager/helpers/pathfinder`

**Note**: `AnySplitPathInsideLibrary` is structurally compatible with `AnySplitPath` (same fields), so `systemPathFromSplitPathInternal` accepts it directly. No need to use `fromInsideLibrary` first - the function uses `pathParts` as-is, which matches the current manual construction behavior (library-scoped paths).

### 2. Extract Codex Checking Helper

**New file**: `[src/commanders/librarian-new/healer/library-tree/codex/helpers.ts](src/commanders/librarian-new/healer/library-tree/codex/helpers.ts)`

Create `isCodexSplitPath(splitPath: { basename: string }, codecs: Codecs): boolean` helper.

**Signature**: Accepts `{ basename: string }` (sufficient - function only uses `basename` field, more flexible than requiring full split path type).

**Replace in**:

- **Lines 195-202** (`buildInitialCreateActions`)
- **Lines 295-299** (`findInvalidCodexFiles`)
- **Lines 381-388** (`handleCheckboxClick`)

## Medium Priority: Extract Pure Functions

### 3. Extract `extractScrollStatusActions`

**New file**: `[src/commanders/librarian-new/healer/library-tree/utils/extract-scroll-status-actions.ts](src/commanders/librarian-new/healer/library-tree/utils/extract-scroll-status-actions.ts)`

Move from **lines 596-645** in `librarian.ts`. Accept `codecs` as parameter instead of using `this.codecs`.

**Dependencies**: Will use `extractNodeNameFromScrollSegmentId` and `computeScrollSplitPath` (extracted separately).

### 4. Extract `extractNodeNameFromScrollSegmentId`

**New file**: `[src/commanders/librarian-new/healer/library-tree/utils/segment-id-helpers.ts](src/commanders/librarian-new/healer/library-tree/utils/segment-id-helpers.ts)`

Move from **lines 650-659** in `librarian.ts`. Accept `codecs` as parameter.

### 5. Consolidate `computeScrollSplitPath`

**New file**: `[src/commanders/librarian-new/healer/library-tree/utils/compute-scroll-split-path.ts](src/commanders/librarian-new/healer/library-tree/utils/compute-scroll-split-path.ts)`

Consolidate two implementations:

- **Lines 664-719** in `librarian.ts` (Result-returning, uses locator API)
- **Lines 201-229** in `codex-impact-to-actions.ts` (direct return, uses suffix API)

**Decision**: Use Result-returning version (more type-safe). Update `codex-impact-to-actions.ts` to handle Result.

**Error Handling**: The `codex-impact-to-actions.ts` version currently silently skips parse errors (`continue` on line 212). After consolidation:

- Return `Result<SplitPathToMdFileInsideLibrary, CodecError>` for proper error handling
- In `codex-impact-to-actions.ts` (lines 130-134), handle Result by logging and skipping:
  ```typescript
  const splitPathResult = computeScrollSplitPath(nodeName, parentChain, codecs);
  if (splitPathResult.isErr()) {
    logger.warn("[Codex] Failed to compute scroll split path:", splitPathResult.error);
    continue; // Maintain current behavior: skip on error
  }
  const splitPath = splitPathResult.value;
  ```
- This maintains current behavior while adding observability for debugging tree state issues

### 6. Extract `collectValidCodexPaths`

**New file**: `[src/commanders/librarian-new/healer/library-tree/utils/collect-codex-paths.ts](src/commanders/librarian-new/healer/library-tree/utils/collect-codex-paths.ts)`

Move from **lines 327-350** in `librarian.ts`. Accept `codecs` as parameter. Return `Set<string>` (already does via `paths` parameter).

**Note**: This function uses `computeCodexSplitPath` from `codex-split-path.ts`. Path string construction (line 338-341) should also use `systemPathFromSplitPathInternal` for consistency.

### 7. Make `findInvalidCodexFiles` Pure

**New file**: `[src/commanders/librarian-new/healer/library-tree/utils/find-invalid-codex-files.ts](src/commanders/librarian-new/healer/library-tree/utils/find-invalid-codex-files.ts)`

Move from **lines 279-322** in `librarian.ts`. Accept `healer`, `codecs`, and `rules` as parameters instead of using `this.*`.

**Note**: This function calls `collectValidCodexPaths`, so extract that first.

## Implementation Order

1. Create helper functions (items 2, 4, 5, 6, 7)
2. Update `librarian.ts` to use helpers (items 1, 2, 3)
3. Update `codex-impact-to-actions.ts` to use consolidated `computeScrollSplitPath` (item 5)

## Notes

- All extracted functions should accept `codecs` (and `rules`/`healer` where needed) as parameters
- Maintain existing error handling patterns (log and skip for loops, propagate for single operations)
- Update imports in `librarian.ts` and `codex-impact-to-actions.ts`
- The consolidated `computeScrollSplitPath` will return `Result<SplitPathToMdFileInsideLibrary, CodecError>` - update `codex-impact-to-actions.ts` to handle errors by logging warnings then skipping
- `systemPathFromSplitPathInternal` works directly with `AnySplitPathInsideLibrary` (structurally compatible)
- `isCodexSplitPath` accepts `{ basename: string }` for flexibility
- Test after each extraction to catch issues early

## ⚠️ Notes & Suggestions

### 1. `computeScrollSplitPath` Consolidation Strategy

**Decision**: Log and skip (maintain current behavior, add observability).

- Use Result-returning version (more type-safe, consistent with codec patterns)
- In `codex-impact-to-actions.ts`, handle Result by logging warnings then skipping
- Maintains current defensive behavior while adding observability for debugging

### 2. Path String Construction

**Decision**: Use `systemPathFromSplitPathInternal` directly with `AnySplitPathInsideLibrary`.

- `AnySplitPathInsideLibrary` is structurally compatible with `AnySplitPath` (same fields)
- `systemPathFromSplitPathInternal` uses `pathParts` as-is, matching current manual construction
- No need for `fromInsideLibrary` conversion - paths are library-scoped for comparison purposes
- Works for both locations: lines 308-311 (`findInvalidCodexFiles`) and 338-341 (`collectValidCodexPaths`)

**Note**: This function calls `computeCodexSplitPath` which returns `SplitPathToMdFileInsideLibrary`, so path construction should work the same way.

### 4. Error Handling Consistency

**Current**: Mixed patterns:

- `librarian.ts`: Logs errors, returns early
- `codex-impact-to-actions.ts`: Silently skips errors

**Recommendation**:

- Document error handling strategy in consolidated functions
- Consider adding optional logger parameter for pure functions that need logging
- OR: Let callers handle logging (keeps functions pure)

### 5. Type Safety Improvements

`**extractScrollStatusActions**`: Currently uses type assertion on line 717. The consolidated `computeScrollSplitPath` should preserve types better through the codec chain, reducing need for assertions.

### 6. Testing Considerations

**Strategy**: Test after each extraction (recommended for early issue detection).

**After each extraction:**

- Run existing tests to catch issues early
- Unit test each extracted pure function
- Test error cases (invalid segment IDs, parse failures)
- Test `computeScrollSplitPath` with both valid and invalid inputs
- Verify `codex-impact-to-actions.ts` behavior unchanged after Result handling

**Critical test points:**

- `computeScrollSplitPath` (consolidation with error handling change)
- `extractScrollStatusActions` (complex, multiple dependencies)
- `findInvalidCodexFiles` (depends on `collectValidCodexPaths`)

### 7. Import Paths

**Verify imports are correct:**

- `systemPathFromSplitPathInternal` path: `../../managers/obsidian/vault-action-manager/helpers/pathfinder`
- From `librarian.ts` to utils: `./healer/library-tree/utils/...`
- From `codex-impact-to-actions.ts` to utils: `../utils/...`

### 8. Function Naming

**Consider**:

- `isCodexSplitPath` vs `isCodexFile` - current name is more explicit about input type
- `extractNodeNameFromScrollSegmentId` - good, descriptive
- `computeScrollSplitPath` - matches existing `computeCodexSplitPath` pattern ✅

### 9. Dependencies Order

**Correct order** (respects dependencies):

1. `create-codex-helper` (no deps)
2. `create-segment-id-helper` (no deps)
3. `consolidate-compute-scroll-split-path` (uses segment-id codecs)
4. `extract-collect-codex-paths` (uses codecs, computeCodexSplitPath)
5. `extract-find-invalid-codex-files` (uses collect-codex-paths, isCodexSplitPath)
6. `extract-scroll-status-actions` (uses segment-id-helper, compute-scroll-split-path)
7. Update librarian (uses all helpers)
8. Update codex-impact-actions (uses compute-scroll-split-path)

### 10. Potential Issues

`**findInvalidCodexFiles**`:

- Currently depends on `this.healer.getRoot()`. After extraction, needs `healer: Healer` parameter.
- Verify `Healer` type is exported or use `TreeAccessor` interface if available.

`**collectValidCodexPaths**`:

- Recursive function. Ensure extracted version maintains same behavior.
- Uses `computeCodexSplitPath` - verify import path is correct.

