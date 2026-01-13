# CanonicalSplitPath Codec Refactoring Progress

## Overview

Refactoring to separate business logic from codec layer in `CanonicalSplitPath` codec. Codecs should be pure format converters, not policy enforcers.

## Completed Work

### 1. Type System Updates ✅

**File**: `src/commanders/librarian-new/codecs/canonical-split-path/types/canonical-split-path.ts`

- Added `SplitPathInsideLibraryWithSeparatedSuffixOf<SK>` type
  - Can be non-canonical (suffixParts may not match pathParts)
  - Structure: `Omit<SplitPathInsideLibraryOf<SK>, "basename"> & { separatedSuffixedBasename: SeparatedSuffixedBasename }`
  
- Updated `CanonicalSplitPathInsideLibraryOf<SK>` to be a type alias
  - Now: `SplitPathInsideLibraryWithSeparatedSuffixOf<SK>`
  - JSDoc indicates semantic validation/canonical status
  - Structure is identical, but type indicates policy validation

- Updated concrete types (`CanonicalSplitPathToFolderInsideLibrary`, etc.) to use new base type

### 2. New Codec: SplitPath <-> SplitPathWithSeparatedSuffix ✅

**Files**:
- `src/commanders/librarian-new/codecs/canonical-split-path/internal/split-path-with-separated-suffix/to.ts`
- `src/commanders/librarian-new/codecs/canonical-split-path/internal/split-path-with-separated-suffix/from.ts`

**Functionality**:
- `splitPathInsideLibraryToWithSeparatedSuffix`: Converts `SplitPathInsideLibraryOf<SK>` → `SplitPathInsideLibraryWithSeparatedSuffixOf<SK>`
  - Validates pathParts as NodeNames (split by delimiter validation)
  - Parses basename using `suffix.parseSeparatedSuffix` (validates NodeNames via splitBySuffixDelimiter)
  - **No canonization policy enforcement** - can be non-canonical
  
- `fromSplitPathInsideLibraryWithSeparatedSuffix`: Converts `SplitPathInsideLibraryWithSeparatedSuffixOf<SK>` → `SplitPathInsideLibraryOf<SK>`
  - Serializes separated suffix into basename
  - Pure conversion

### 3. Codec Interface Updates ✅

**File**: `src/commanders/librarian-new/codecs/canonical-split-path/make.ts`

- Added new codec functions to `CanonicalSplitPathCodecs` interface:
  - `splitPathInsideLibraryToWithSeparatedSuffix`
  - `fromSplitPathInsideLibraryWithSeparatedSuffix`
- Old `splitPathInsideLibraryToCanonical` still present (for backward compatibility)

### 4. Canonization Policy Extraction ✅

**File**: `src/commanders/librarian-new/codecs/canonical-split-path/internal/canonicalization-policy.ts`

**Functions**:
- `buildCanonicalSeparatedSuffixedBasename`: Builds expected canonical separated suffix from pathParts
  - Canonization policy: suffixParts derived from pathParts (reversed, sans root)
  - Folders have empty suffixParts
  
- `validateCanonicalFormat`: Validates that separated suffix matches canonical format
  - Policy enforcement: actual suffixParts must match expected (from pathParts)
  - Folders must have empty suffixParts
  
- `canonizeSplitPathWithSeparatedSuffix`: Canonizes split path with separated suffix
  - Uses pathParts to build expected canonical format
  - Validates against actual

**Note**: 
- Policy functions moved from healer layer to codecs layer to avoid circular dependencies
- Healer layer re-exports policy functions for backward compatibility
- Duplicate marker handling moved to business logic (not in codec/policy)

### 5. Locator Codec Refactoring ✅

**File**: `src/commanders/librarian-new/codecs/locator/internal/to.ts`

- Refactored `locatorToCanonicalSplitPathInsideLibrary` to use new structure
- Builds `SplitPathInsideLibraryWithSeparatedSuffixOf` directly
- Assumes canonical I/O as invariant - **no validation**
- Returns as `CanonicalSplitPathInsideLibraryOf` (type alias, structure is same)

### 6. PathKing Policy Refactoring ✅

**File**: `src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/locator.ts`

- Refactored PathKing path in `tryCanonicalizeSplitPathToDestination`:
  1. Uses new codec `splitPathInsideLibraryToWithSeparatedSuffix` to convert
  2. Handles duplicate markers in business logic (not codec)
  3. Uses policy functions to build expected canonical format
  4. Uses `canonizeSplitPathWithSeparatedSuffix` to validate and canonize
  5. Returns `CanonicalSplitPathInsideLibraryOf<SK>`

## Unfinished Issues

### 1. Old Codec Wrapper Needs Refactoring ⚠️

**File**: `src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/locator.ts`

**Lines**: 223-315 (approximately)

**Current State**:
- NameKing paths (Move intent and regular NameKing) still use old `splitPathInsideLibraryToCanonical` approach
- Still build basenames manually and call old codec

**Needs**:
- Refactor to use new codec `splitPathInsideLibraryToWithSeparatedSuffix`
- Use policy functions for canonization
- Handle duplicate markers in business logic (already done)

**Pattern** (same as PathKing, different manipulation):
```typescript
// 1. Convert to split path with separated suffix
const withSeparatedSuffixResult = adaptCodecResult(
  codecs.canonicalSplitPath.splitPathInsideLibraryToWithSeparatedSuffix(sp),
);

// 2. Manipulate pathParts based on suffix (business logic)
//    - Move: suffix reversed = new path
//    - Create: suffix becomes parent chain
const newPathParts = [...suffixParts].reverse(); // or convert suffixParts

// 3. Build expected canonical from new pathParts (policy)
const expected = buildCanonicalSeparatedSuffixedBasename(...);

// 4. Update and canonize
spWithSeparatedSuffix = { ...spWithSeparatedSuffix, pathParts: newPathParts, ... };
return canonizeSplitPathWithSeparatedSuffix(...);
```

### 3. Type Narrowing Issues ⚠️

**File**: `src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/locator.ts`

**Lines**: 248, 273, 307

**Issue**: TypeScript can't narrow union types properly in return statements

**Error**: 
```
Type 'Result<CanonicalSplitPathInsideLibraryOf<"Folder" | "File" | "MdFile">, string>' 
is not assignable to type 'Result<CanonicalSplitPathInsideLibraryOf<SK> | AnyCanonicalSplitPathInsideLibrary, string>'
```

**Solution**: Use type assertions (same pattern as PathKing line 214-219)
```typescript
return ok(
  canonizedResult.value as unknown as
    | CanonicalSplitPathInsideLibraryOf<SK>
    | CanonicalSplitPathInsideLibrary,
);
```

### 4. Business Consumer Update Needed ⚠️

**File**: `src/commanders/librarian-new/healer/library-tree/tree-action/utils/canonical-naming/canonical-split-path-codec.ts`

**Current State**: Still uses old approach with manual parsing and validation

**Needs**:
- Update to use new codec `splitPathInsideLibraryToWithSeparatedSuffix`
- Use policy functions for canonization validation
- Remove duplicate logic that's now in codec/policy

**Note**: Used in tests, so keep it but update implementation

### 5. Index Exports ⚠️

**File**: `src/commanders/librarian-new/codecs/canonical-split-path/index.ts`

**Needs**:
- Export `SplitPathInsideLibraryWithSeparatedSuffixOf` (business logic needs this intermediate type)
- New codec functions already exposed via `CanonicalSplitPathCodecs` interface


## Architecture Summary

### Before
```
SplitPathInsideLibrary 
  → splitPathInsideLibraryToCanonical (codec + policy mixed)
  → CanonicalSplitPathInsideLibrary
```

### After
```
SplitPathInsideLibrary 
  → splitPathInsideLibraryToWithSeparatedSuffix (pure codec)
  → SplitPathInsideLibraryWithSeparatedSuffixOf (can be non-canonical)
  → canonizeSplitPathWithSeparatedSuffix (business logic/policy)
  → CanonicalSplitPathInsideLibraryOf (validated)
```

## Next Steps (Recommended Order)

### 1. Refactor Old Codec Wrapper (First) 🔴
**File**: `src/commanders/librarian-new/codecs/canonical-split-path/internal/to.ts`

Refactor `splitPathInsideLibraryToCanonical` to use new codec + policy internally:
```typescript
export function splitPathInsideLibraryToCanonical<SK extends SplitPathKind>(
  suffix: SuffixCodecs,
  libraryRootName: string,
  sp: SplitPathInsideLibraryOf<SK>,
): Result<CanonicalSplitPathInsideLibraryOf<SK>, CodecError> {
  // Use new codec
  const withSeparatedSuffixResult = splitPathInsideLibraryToWithSeparatedSuffix(suffix, sp);
  if (withSeparatedSuffixResult.isErr()) return withSeparatedSuffixResult;
  
  // Use policy to canonize
  return canonizeSplitPathWithSeparatedSuffix(suffix, libraryRootName, withSeparatedSuffixResult.value);
}
```

**Why first**: Validates architecture, provides backward compatibility, enables other refactors

### 2. Refactor NameKing Paths 🔴
**File**: `src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/locator.ts`

Follow same pattern as PathKing:
- Convert to separated suffix using new codec
- Manipulate pathParts based on suffix (business logic)
- Build expected canonical from new pathParts
- Canonize using policy

**Why second**: Completes main refactoring work

### 3. Update Business Consumer 🟡
**File**: `src/commanders/librarian-new/healer/library-tree/tree-action/utils/canonical-naming/canonical-split-path-codec.ts`

Update to use new codec + policy instead of manual parsing/validation.

**Why third**: Proves architecture works, used in tests

### 4. Fix Type Narrowing Issues 🟡
**File**: `src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/locator.ts`

Use type assertions (same pattern as line 214).

**Why fourth**: Cleanup/polish

### 5. Update Exports 🟢
**File**: `src/commanders/librarian-new/codecs/canonical-split-path/index.ts`

Export `SplitPathInsideLibraryWithSeparatedSuffixOf` (business logic needs it).

**Why fifth**: Finalize API surface

## Notes

- Duplicate marker handling correctly moved to business logic
- NodeName validation correctly lives in codec (split by delimiter)
- Policy enforcement correctly separated from format conversion
- Type system properly reflects semantic differences (canonical vs non-canonical)
