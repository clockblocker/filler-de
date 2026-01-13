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

### 7. Old Codec Wrapper Refactoring ✅

**File**: `src/commanders/librarian-new/codecs/canonical-split-path/internal/to.ts`

- Refactored `splitPathInsideLibraryToCanonical` to use new codec + policy internally
- Maintains backward compatibility as wrapper function
- Implementation:
  1. Uses `splitPathInsideLibraryToWithSeparatedSuffix` to convert (validates NodeNames, parses basename)
  2. Handles duplicate markers in business logic (extracts and re-attaches to coreName)
  3. Uses `canonizeSplitPathWithSeparatedSuffix` to validate and canonize
  4. Returns `CanonicalSplitPathInsideLibraryOf<SK>`

**Why this matters**: Validates architecture, provides backward compatibility during transition

### 8. NameKing Policy Refactoring ✅

**File**: `src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/locator.ts`

- Refactored NameKing paths (Move intent and regular NameKing) in `tryCanonicalizeSplitPathToDestination`:
  1. Uses new codec `splitPathInsideLibraryToWithSeparatedSuffix` to convert
  2. Handles duplicate markers in business logic
  3. Manipulates pathParts based on suffix interpretation (business logic):
     - Move: suffix reversed = new path location
     - Create: suffix becomes parent chain
  4. Uses policy functions to build expected canonical format from new pathParts
  5. Uses `canonizeSplitPathWithSeparatedSuffix` to validate and canonize
  6. Returns `CanonicalSplitPathInsideLibraryOf<SK>` with type assertions

**Pattern**: Same as PathKing (convert → manipulate → canonize), but manipulation interprets basename suffix as path intent

### 9. Business Consumer Update ✅

**File**: `src/commanders/librarian-new/healer/library-tree/tree-action/utils/canonical-naming/canonical-split-path-codec.ts`

- Updated `tryParseCanonicalSplitPathInsideLibrary` to use new codec + policy
- Creates codecs internally from user settings
- Implementation:
  1. Uses `splitPathInsideLibraryToWithSeparatedSuffix` to convert
  2. Uses `buildCanonicalSeparatedSuffixedBasename` to build expected canonical
  3. Uses `canonizeSplitPathWithSeparatedSuffix` to validate and canonize
- Removed duplicate logic that's now in codec/policy
- Maintains same API for tests

### 10. Type Narrowing Fixes ✅

**File**: `src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/locator.ts`

- Fixed TypeScript type narrowing issues in return statements
- Added type assertions using pattern:
  ```typescript
  return ok(
    canonizedResult.value as unknown as
      | CanonicalSplitPathInsideLibraryOf<SK>
      | CanonicalSplitPathInsideLibrary,
  );
  ```
- Applied to NameKing paths (Move and regular)

### 11. Index Exports Update ✅

**File**: `src/commanders/librarian-new/codecs/canonical-split-path/index.ts`

- Exported `SplitPathInsideLibraryWithSeparatedSuffixOf` type
- Business logic needs this intermediate type for manipulation before canonization
- New codec functions already exposed via `CanonicalSplitPathCodecs` interface

## Unfinished Issues

None - all planned refactoring work is complete! ✅


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

## Refactoring Summary

All planned refactoring work has been completed! The architecture now cleanly separates:

1. **Codec layer** (`splitPathInsideLibraryToWithSeparatedSuffix`): Pure format conversion, validates NodeNames, parses basename
2. **Policy layer** (`canonicalization-policy.ts`): Business rules for canonical format (suffixParts derived from pathParts)
3. **Business logic layer**: Handles duplicate markers, interprets suffix as path intent (NameKing), manipulates paths

### Key Achievements

- ✅ Codecs are now pure format converters (no policy enforcement)
- ✅ Policy functions moved to codecs layer (avoids circular dependencies)
- ✅ All consumers updated to use new architecture
- ✅ Backward compatibility maintained via wrapper function
- ✅ Type system properly reflects semantic differences (canonical vs non-canonical)
- ✅ All type narrowing issues resolved

### Future Considerations

- Consider deprecating `splitPathInsideLibraryToCanonical` wrapper once all consumers are confirmed updated
- Monitor for any remaining uses of old manual parsing/validation patterns

## Notes

- Duplicate marker handling correctly moved to business logic
- NodeName validation correctly lives in codec (split by delimiter)
- Policy enforcement correctly separated from format conversion
- Type system properly reflects semantic differences (canonical vs non-canonical)
