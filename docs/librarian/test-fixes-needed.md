# Test Fixes Needed for Suffix Invariants

## Summary

Tests need to be updated to reflect:
1. **tRef removed** - Tree nodes no longer store `TFile` references
2. **extension added** - Tree nodes now store `extension` field
3. **getCurrentBasename required** - Healing functions now require a function to resolve current basename

## 1. translateVaultAction Tests

**File:** `tests/unit/librarian/reconciliation/vault-to-tree.test.ts`

### Issues:

1. **Line 12-15:** `defaultContext` includes `getTRef` which is no longer needed
   ```typescript
   const defaultContext: TranslationContext = {
     getTRef: () => fakeTFile,  // ❌ REMOVE - no longer in TranslationContext
     libraryRoot: "Library",
   };
   ```

2. **Line 87:** CreateNode(Scroll) expects `tRef` in payload
   ```typescript
   expect(result).toEqual({
     payload: {
       coreName: "Note",
       coreNameChainToParent: ["A", "B"],
       nodeType: TreeNodeType.Scroll,
       status: TreeNodeStatus.NotStarted,
       tRef: fakeTFile,  // ❌ REMOVE
     },
     // ...
   });
   ```
   **Should be:**
   ```typescript
   expect(result).toEqual({
     payload: {
       coreName: "Note",
       coreNameChainToParent: ["A", "B"],
       nodeType: TreeNodeType.Scroll,
       status: TreeNodeStatus.NotStarted,
       extension: "md",  // ✅ ADD
     },
     // ...
   });
   ```

3. **Line 93-112:** Test "returns null if no TRef available" - **REMOVE ENTIRELY**
   - This test is no longer relevant since we don't require tRef

4. **Line 137:** CreateNode(File) expects `tRef` in payload
   ```typescript
   expect(result).toEqual({
     payload: {
       coreName: "doc",
       coreNameChainToParent: ["A"],
       nodeType: TreeNodeType.File,
       status: TreeNodeStatus.Unknown,
       tRef: fakeTFile,  // ❌ REMOVE
       extension: "pdf",  // ✅ ADD
     },
     // ...
   });
   ```

5. **Line 215-216:** Rename tests use full basenames without suffixes
   - These should test with suffixed basenames to verify parsing works
   - Example: `basename: "OldName-A"` should parse to `coreName: "OldName"`

## 2. splitPathToLeaf Tests

**File:** `tests/unit/librarian/utils/split-path-to-leaf.test.ts`

### Issues:

1. **Line 25-31:** Expects `tRef` in result
   ```typescript
   expect(result).toEqual({
     coreName: "Note",
     coreNameChainToParent: ["parent", "child"],
     status: TreeNodeStatus.NotStarted,
     tRef: fakeTFile,  // ❌ REMOVE
     type: TreeNodeType.Scroll,
     extension: "md",  // ✅ ADD
   });
   ```

2. **Line 90-96:** FileNode expects `tRef` in result
   ```typescript
   expect(result).toEqual({
     coreName: "document",
     coreNameChainToParent: ["doc", "Pekar", "2025"],
     status: TreeNodeStatus.Unknown,
     tRef: fakeTFile,  // ❌ REMOVE
     type: TreeNodeType.File,
     extension: "pdf",  // ✅ ADD
   });
   ```

3. **All tests correctly test suffix parsing** ✅
   - Tests use basenames with suffixes (e.g., "Note-child-parent")
   - Verify that `coreName` is extracted correctly
   - This is correct behavior per invariants

## 3. healOnInit Tests

**File:** `tests/unit/librarian/healing/init-healer.test.ts`

### Issues:

1. **Line 25-38:** `scrollLeaf` helper creates leaves with `tRef`
   ```typescript
   function scrollLeaf(...): TreeLeaf {
     return {
       coreName,
       coreNameChainToParent,
       status: TreeNodeStatus.NotStarted,
       tRef: mockTFile(...),  // ❌ REMOVE
       type: TreeNodeType.Scroll,
       extension: "md",  // ✅ ADD
     };
   }
   ```

2. **Line 40-54:** `fileLeaf` helper creates leaves with `tRef`
   ```typescript
   function fileLeaf(...): TreeLeaf {
     return {
       coreName,
       coreNameChainToParent,
       status: TreeNodeStatus.Unknown,
       tRef: mockTFile(...),  // ❌ REMOVE
       type: TreeNodeType.File,
       extension: extension,  // ✅ ADD (already has it, but needs to be in right place)
     };
   }
   ```

3. **Line 63:** `healOnInit` call missing `getCurrentBasename` parameter
   ```typescript
   const result = healOnInit(leaves, LIBRARY_ROOT, DELIMITER);
   // ❌ MISSING: getCurrentBasename function
   ```
   **Should be:**
   ```typescript
   const getCurrentBasename = (path: string): string | null => {
     // Find leaf by path and return its currentBasename
     const leaf = leaves.find(l => {
       const chain = [...l.coreNameChainToParent, l.coreName];
       const expectedPath = `${LIBRARY_ROOT}/${chain.join("/")}.${l.extension}`;
       return expectedPath === path;
     });
     return leaf ? /* extract basename from leaf */ : null;
   };
   const result = healOnInit(leaves, LIBRARY_ROOT, DELIMITER, getCurrentBasename);
   ```

4. **All test cases need `getCurrentBasename`** - Every `healOnInit` call needs this parameter

## 4. leafNeedsHealing Tests

**File:** `tests/unit/librarian/healing/init-healer.test.ts`

### Issues:

1. **Same helper issues** - Uses `scrollLeaf` which has `tRef` ❌

2. **Line 147, 152, 157, 162:** `leafNeedsHealing` calls missing `getCurrentBasename` parameter
   ```typescript
   expect(leafNeedsHealing(leaf, LIBRARY_ROOT, DELIMITER)).toBe(false);
   // ❌ MISSING: getCurrentBasename function
   ```
   **Should be:**
   ```typescript
   const getCurrentBasename = (path: string): string | null => {
     // Return basename from leaf's currentBasename
     // For tests, we can use the currentBasename passed to scrollLeaf
     return /* extract from test setup */;
   };
   expect(leafNeedsHealing(leaf, LIBRARY_ROOT, DELIMITER, getCurrentBasename)).toBe(false);
   ```

## Test Helper Strategy

Since tests need to provide `getCurrentBasename`, we can:

1. **Option A:** Create a test helper that builds a lookup map from leaves
   ```typescript
   function createGetCurrentBasename(leaves: TreeLeaf[], libraryRoot: string) {
     const pathToBasename = new Map<string, string>();
     for (const leaf of leaves) {
       const chain = [...leaf.coreNameChainToParent, leaf.coreName];
       const path = `${libraryRoot}/${chain.join("/")}.${leaf.extension}`;
       // Reconstruct canonical basename
       const canonicalBasename = buildCanonicalBasename(
         leaf.coreName,
         leaf.coreNameChainToParent,
         "-"
       );
       pathToBasename.set(path, canonicalBasename);
     }
     return (path: string) => pathToBasename.get(path) ?? null;
   }
   ```

2. **Option B:** Store currentBasename in test setup and use it
   - Tests already pass `currentBasename` to helper functions
   - Can create a simple lookup function

## Summary of Changes Needed

1. ✅ Remove all `tRef` references from test expectations
2. ✅ Add `extension` field to all test expectations
3. ✅ Remove `getTRef` from `TranslationContext` in tests
4. ✅ Remove "returns null if no TRef available" test
5. ✅ Update `scrollLeaf` and `fileLeaf` helpers to not include `tRef`
6. ✅ Add `getCurrentBasename` parameter to all `healOnInit` calls
7. ✅ Add `getCurrentBasename` parameter to all `leafNeedsHealing` calls
8. ✅ Create helper function to generate `getCurrentBasename` for tests

