# High ROI Places to Replace `AnyCanonicalSplitPathInsideLibrary` with Generic

## Executive Summary

**Goal:** Replace `AnyCanonicalSplitPathInsideLibrary` (union) with `CanonicalSplitPathInsideLibraryOf<SK>` (generic) where type information can be preserved.

**Key Finding:** The `LocatorCodecs` interface already uses generics correctly! The issues are:
1. Type assertions that lose type information
2. Explicit union type annotations where inference would work
3. Fallback overloads in internal functions (may be necessary due to union inputs)

**Highest ROI:** Remove type assertions and let TypeScript infer types from overloads.

---

## Summary
`AnyCanonicalSplitPathInsideLibrary` (alias: `CanonicalSplitPathInsideLibrary`) is a union type. We can improve type safety by using `CanonicalSplitPathInsideLibraryOf<SK>` generics where the kind is known or can be inferred.

## High ROI Replacements

### 1. **Locator Codec Internal Functions** (HIGHEST ROI)
**Files:**
- `src/commanders/librarian-new/codecs/locator/internal/to.ts`
- `src/commanders/librarian-new/codecs/locator/internal/from.ts`

**Current Issue:**
- Fallback overloads use `CanonicalSplitPathInsideLibrary` (union)
- Specific overloads already use concrete types (good)
- Fallback loses type information

**Impact:** HIGH - These are core codec functions used throughout the system

**Example:**
```typescript
// Current (line 48 in to.ts):
export function locatorToCanonicalSplitPathInsideLibrary(
	...
	loc: TreeNodeLocator,
): Result<CanonicalSplitPathInsideLibrary, CodecError>; // ❌ Union type

// Could be:
export function locatorToCanonicalSplitPathInsideLibrary<NK extends TreeNodeKind>(
	...
	loc: TreeNodeLocator,
): Result<CanonicalSplitPathInsideLibraryOf<CorrespondingSplitPathKind<NK>>, CodecError>;
```

**Question:** Can we infer `NK` from `TreeNodeLocator`? Or do we need to keep the overload pattern?

**Note:** The `LocatorCodecs` interface (in `make.ts`) already uses generics correctly! The issue is only in the internal implementation functions' fallback overloads.

---

### 2. **Legacy Utility Functions** (HIGH ROI)
**File:** `src/commanders/librarian-new/healer/library-tree/tree-action/utils/canonical-naming/canonical-split-path-codec.ts`

**Current Issue:**
- `tryParseCanonicalSplitPathInsideLibrary` has overloads but fallback uses union
- `makeRegularSplitPathInsideLibrary` has overloads but fallback uses union
- Internal variable `out` explicitly typed as union (line 60)

**Impact:** MEDIUM-HIGH - Legacy utilities, but still used

**Example (line 60):**
```typescript
const out: CanonicalSplitPathInsideLibrary = { // ❌ Explicit union type
	...sp,
	...
};
```

**Question:** Can we infer the kind from `sp` parameter? The overloads suggest we can.

---

### 3. **Type Assertions** (MEDIUM ROI)
**File:** `src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/locator.ts`

**Current Issue:**
- Line 34: `cspRes.value as CanonicalSplitPathInsideLibrary` - type assertion
- Line 124: Return type `Result<CanonicalSplitPathInsideLibrary, string>` - union type

**Impact:** MEDIUM - Type assertions indicate lost type information

**Example (line 34):**
```typescript
codecs.locator.canonicalSplitPathInsideLibraryToLocator(
	cspRes.value as CanonicalSplitPathInsideLibrary, // ❌ Type assertion
)
```

**Question:** Can `cspRes.value` be typed more specifically? It comes from `CanonicalSplitPathToDestination<E>` which should preserve kind.

---

### 4. **Legacy Locator Codec** (MEDIUM ROI)
**File:** `src/commanders/librarian-new/healer/library-tree/tree-action/utils/locator/locator-codec.ts`

**Current Issue:**
- `makeLocatorFromCanonicalSplitPathInsideLibrary` fallback uses union (line 32)
- `makeCanonicalSplitPathInsideLibraryFromLocator` fallback uses union (line 98)

**Impact:** MEDIUM - Legacy code, but still used

**Note:** This file seems to be a legacy version of the codec. Consider deprecating in favor of `codecs/locator`.

---

### 5. **Type Exports** (LOW ROI - Keep for Compatibility)
**Files:**
- `src/commanders/librarian-new/codecs/canonical-split-path/index.ts`
- `src/commanders/librarian-new/codecs/locator/types.ts`
- `src/commanders/librarian-new/codecs/index.ts`

**Current:** Re-export `CanonicalSplitPathInsideLibrary` (legacy alias)

**Impact:** LOW - Keep for backward compatibility, but document as legacy

---

## Questions to Resolve

1. **Overload Pattern vs Generic:**
   - Current pattern uses overloads for type narrowing (good for call sites)
   - Fallback overloads use union type (loses type info)
   - **Recommendation:** Keep overloads but make fallback generic if possible
   - **Challenge:** `TreeNodeLocator` is a union, can't directly infer `NK`

2. **Type Inference:**
   - Can we infer `SK` from `CanonicalSplitPathInsideLibrary` union?
   - **Answer:** No - union types don't preserve discriminant for inference
   - **Solution:** Use overloads with specific types (already done) + generic fallback

3. **Backward Compatibility:**
   - Should we keep `CanonicalSplitPathInsideLibrary` alias?
   - **Recommendation:** Keep for now, document as legacy
   - Internal code should prefer `CanonicalSplitPathInsideLibraryOf<SK>`

4. **Legacy Code:**
   - `locator-codec.ts` vs `codecs/locator/` - which is canonical?
   - **Answer:** `codecs/locator/` is canonical (factory pattern)
   - **Recommendation:** Deprecate `locator-codec.ts` utilities

---

## Concrete Examples

### Example 1: Locator Codec Fallback Overload

**Current (locator/internal/to.ts:48):**
```typescript
export function locatorToCanonicalSplitPathInsideLibrary(
	segmentId: SegmentIdCodecs,
	canonicalSplitPath: CanonicalSplitPathCodecs,
	suffix: SuffixCodecs,
	loc: TreeNodeLocator,
): Result<CanonicalSplitPathInsideLibrary, CodecError>; // ❌ Union
```

**Proposed:**
```typescript
// Keep specific overloads, but fallback could be:
export function locatorToCanonicalSplitPathInsideLibrary<NK extends TreeNodeKind>(
	segmentId: SegmentIdCodecs,
	canonicalSplitPath: CanonicalSplitPathCodecs,
	suffix: SuffixCodecs,
	loc: NodeLocatorOf<NK>,
): Result<CanonicalSplitPathInsideLibraryOf<CorrespondingSplitPathKind<NK>>, CodecError>;
```

**Challenge:** `TreeNodeLocator` is a union, so we can't infer `NK`. Current overload pattern is actually correct for call sites.

**Verdict:** ✅ Keep overloads, but internal implementation could preserve type better.

---

### Example 2: Type Assertion Removal

**Current (helpers/locator.ts:34):**
```typescript
const locatorRes = adaptCodecResult(
	codecs.locator.canonicalSplitPathInsideLibraryToLocator(
		cspRes.value as CanonicalSplitPathInsideLibrary, // ❌ Assertion
	),
);
```

**Proposed:**
```typescript
// cspRes.value is CanonicalSplitPathToDestination<E>
// Should preserve kind from event
const locatorRes = adaptCodecResult(
	codecs.locator.canonicalSplitPathInsideLibraryToLocator(cspRes.value), // ✅ No assertion
);
```

**Question:** Does `CanonicalSplitPathToDestination<E>` preserve the kind? Need to check type definition.

**Answer:** ✅ YES! `CanonicalSplitPathToDestination<E>` uses conditional types to preserve kind:
- Maps to `CanonicalSplitPathToFolderInsideLibrary` | `CanonicalSplitPathToMdFileInsideLibrary` | `CanonicalSplitPathToFileInsideLibrary`
- The codec function has overloads that accept these specific types
- **Action:** Remove type assertion, let overloads handle it

---

### Example 3: Legacy Utility Internal Variable

**Current (canonical-split-path-codec.ts:60):**
```typescript
const out: CanonicalSplitPathInsideLibrary = { // ❌ Explicit union
	...sp,
	pathParts: pathPartsRes.value,
	separatedSuffixedBasename: { coreName, suffixParts },
};
```

**Proposed:**
```typescript
// Infer from sp parameter (which has overloads with specific types)
const out = { // ✅ Let TS infer
	...sp,
	pathParts: pathPartsRes.value,
	separatedSuffixedBasename: { coreName, suffixParts },
} as const;
```

**Note:** The overloads ensure `sp` is already narrowed, so we can let TS infer.

---

## Recommended Priority

1. **Phase 1:** Remove type assertions in helpers/locator.ts (easy win)
2. **Phase 2:** Fix internal variable types in legacy utilities (let TS infer)
3. **Phase 3:** Review locator codec fallback overloads (may need to keep as-is)
4. **Phase 4:** Document legacy alias, keep for compatibility
