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

**File**: `src/commanders/librarian-new/healer/library-tree/tree-action/utils/canonical-naming/canonicalization-policy.ts`

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

**Note**: Duplicate marker handling moved to business logic (not in codec/policy)

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

### 1. NameKing Paths Still Use Old Approach ⚠️

**File**: `src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/locator.ts`

**Lines**: 223-315 (approximately)

**Current State**:
- NameKing paths (Move intent and regular NameKing) still use old `splitPathInsideLibraryToCanonical` approach
- Still build basenames manually and call old codec

**Needs**:
- Refactor to use new codec `splitPathInsideLibraryToWithSeparatedSuffix`
- Use policy functions for canonization
- Handle duplicate markers in business logic (already done)

**Example Pattern** (from PathKing):
```typescript
// Convert to split path with separated suffix
const withSeparatedSuffixResult = adaptCodecResult(
  codecs.canonicalSplitPath.splitPathInsideLibraryToWithSeparatedSuffix(sp),
);
// ... handle duplicate markers ...
// ... use policy to build expected canonical ...
// ... canonize using policy ...
```

### 2. Type Narrowing Issues ⚠️

**File**: `src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/locator.ts`

**Lines**: 248, 273, 307

**Issue**: TypeScript can't narrow union types properly in return statements

**Error**: 
```
Type 'Result<CanonicalSplitPathInsideLibraryOf<"Folder" | "File" | "MdFile">, string>' 
is not assignable to type 'Result<CanonicalSplitPathInsideLibraryOf<SK> | AnyCanonicalSplitPathInsideLibrary, string>'
```

**Solution**: May need type assertions or refactor return type handling

### 3. Business Consumer Update Needed ⚠️

**File**: `src/commanders/librarian-new/healer/library-tree/tree-action/utils/canonical-naming/canonical-split-path-codec.ts`

**Current State**: Still uses old approach with manual parsing and validation

**Needs**:
- Update to use new codec `splitPathInsideLibraryToWithSeparatedSuffix`
- Use policy functions for canonization validation
- Remove duplicate logic that's now in codec/policy

### 4. Index Exports and Deprecation ⚠️

**File**: `src/commanders/librarian-new/codecs/canonical-split-path/index.ts`

**Needs**:
- Export new types: `SplitPathInsideLibraryWithSeparatedSuffixOf`
- Export new codec functions (if needed)
- Add deprecation notice to `splitPathInsideLibraryToCanonical` (or remove if safe)

### 5. Old Codec Function Cleanup ⚠️

**File**: `src/commanders/librarian-new/codecs/canonical-split-path/internal/to.ts`

**Current State**: `splitPathInsideLibraryToCanonical` still contains business logic

**Options**:
- Deprecate and keep for backward compatibility
- Remove after all consumers are updated
- Refactor to use new codec + policy internally (wrapper)

**Recommendation**: Keep as wrapper that uses new codec + policy for backward compatibility during transition

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

## Next Steps

1. **High Priority**: Refactor NameKing paths in `tryCanonicalizeSplitPathToDestination`
2. **High Priority**: Fix type narrowing issues
3. **Medium Priority**: Update `canonical-split-path-codec.ts` business consumer
4. **Medium Priority**: Update exports and add deprecation notices
5. **Low Priority**: Clean up old codec function (after all consumers updated)

## Notes

- Duplicate marker handling correctly moved to business logic
- NodeName validation correctly lives in codec (split by delimiter)
- Policy enforcement correctly separated from format conversion
- Type system properly reflects semantic differences (canonical vs non-canonical)
