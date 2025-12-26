# Librarian Naming Migration Refactor

## Breaking Change

**Codex naming format change:**
- **Old:** `__CodexName-parent.md` (prefix pattern)
- **New:** `__-CodexName-parent.md` (`__` is now the NodeName)

The `__` is now part of the nodeName, not a prefix. Codexes follow the same suffix pattern as regular files.

## Current State

### ✅ Completed
- `canonicalBasenameToChainCodec` - decodes/encodes section basenames to chains
- `canonicalBasenameForCodexToParentSectionChainCodec` - decodes/encodes codex basenames to parent section chains

### 📍 Migration Target
Move naming-related code from `utils/...` to `naming/...` and make it pure/decomposable.

## Files to Migrate

### From `utils/` to `naming/`

1. **`utils/parse-basename.ts`** → `naming/codecs/basename-to-parsed-codec.ts`
   - `parseBasenameDeprecated()` → new codec-based approach
   - Currently used in: 8 files

2. **`utils/path-suffix-utils.ts`** → `naming/codecs/` (split into focused codecs)
   - `buildBasenameDepreacated()` → codec
   - `buildCanonicalBasenameDeprecated()` → codec
   - `computeSuffixFromPathDepreacated()` → codec
   - `computePathPartsFromSuffixDepreacated()` → codec
   - `suffixMatchesPathDepreacated()` → codec
   - Currently used in: 5 files

3. **`utils/codex-utils.ts`** → `naming/codecs/` (replace with codecs)
   - `isBasenamePrefixedAsCodexDeprecated()` → use `canonicalBasenameForCodexToParentSectionChainCodec`
   - `addCodexPrefixDeprecated()` → **NEEDS FIX** - currently takes string but called with SectionNode
   - Currently used in: 4 files

### Keep in `utils/` (not naming-related)
- `find-common-ancestor.ts`
- `split-path-to-leaf.ts`
- `tree-path-utils.ts`

## Impact Analysis

### High Impact Areas

1. **Codex Creation/Regeneration** (`codex-builder.ts`, `codex-regenerator.ts`)
   - `addCodexPrefixDeprecated(section)` - type mismatch (expects string, gets SectionNode)
   - Must build basename using new format: `__-SectionName-parent` pattern
   - Uses `canonicalBasenameToChainCodec` to build full basename

2. **Codex Content Generation** (`codex-generator.ts`)
   - `addCodexPrefixDeprecated()` called 3 times with different args (string vs SectionNode)
   - Must generate links using new format
   - Backlink generation needs update

3. **Codex Link Parsing** (`click-handler.ts`)
   - `parseCodexLinkTarget()` - already handles prefix stripping
   - May need update for new format validation

4. **Healing/Reconciliation** (5 files)
   - `intent-resolver.ts` - uses `parseBasenameDeprecated`, `buildBasenameDepreacated`
   - `init-healer.ts` - uses `parseBasenameDeprecated`, `buildBasenameDepreacated`
   - `drag-handler.ts` - uses `parseBasenameDeprecated`, `computePathPartsFromSuffixDepreacated`
   - `create-handler.ts` - uses `parseBasenameDeprecated`, `buildBasenameDepreacated`
   - `vault-to-tree.ts` - uses `parseBasenameDeprecated`

5. **Path Parsing** (`path-parsers.ts`)
   - `parseBasenameDeprecated()` used for delete path parsing

### Medium Impact Areas

6. **Event Handlers** (`event-handlers.ts`)
   - `isBasenamePrefixedAsCodexDeprecated()` - validation only
   - Can be replaced with codec validation

7. **Tree Reader** (`tree-reader.ts`)
   - `isBasenamePrefixedAsCodexDeprecated()` - validation only

### Low Impact Areas

8. **Tests**
   - Unit tests for deprecated functions need migration
   - Integration tests may need updates for new codex format

## Refactor Strategy

### Phase 1: Create New Codecs (Pure Functions)

1. **`naming/codecs/basename-to-parsed-codec.ts`**
   - Replace `parseBasenameDeprecated()`
   - Input: basename string
   - Output: `SeparatedSuffixedBasename` (nodeName + splitSuffix)

2. **`naming/codecs/chain-to-suffixed-basename-codec.ts`**
   - Replace `buildBasenameDepreacated()` / `buildCanonicalBasenameDeprecated()`
   - Input: `NodeNameChain`
   - Output: suffixed basename string
   - Uses `canonicalBasenameToChainCodec.encode()`

3. **`naming/codecs/suffix-to-chain-codec.ts`**
   - Replace `computePathPartsFromSuffixDepreacated()`
   - Input: `SplitSuffix`
   - Output: `NodeNameChain`
   - Simple reverse operation

4. **`naming/codecs/chain-to-suffix-codec.ts`**
   - Replace `computeSuffixFromPathDepreacated()`
   - Input: `NodeNameChain`
   - Output: `SplitSuffix`
   - Simple reverse operation

5. **`naming/codecs/codex-basename-builder-codec.ts`**
   - Replace `addCodexPrefixDeprecated()` (fix type mismatch)
   - Input: `SectionNode` or `NodeNameChain`
   - Output: codex basename string
   - Uses `canonicalBasenameToChainCodec` with `CODEX_CORE_NAME` as nodeName

6. **`naming/codecs/codex-basename-validator-codec.ts`**
   - Replace `isBasenamePrefixedAsCodexDeprecated()`
   - Uses `canonicalBasenameForCodexToParentSectionChainCodec.safeParse()`

### Phase 2: Update Call Sites

Replace deprecated function calls with new codecs:
- `parseBasenameDeprecated()` → `basenameToParsedCodec.decode()`
- `buildBasenameDepreacated()` → `chainToCanonicalBasenameCodec.encode()`
- `addCodexPrefixDeprecated()` → `codexBasenameBuilderCodec.encode()`
- `isBasenamePrefixedAsCodexDeprecated()` → `codexBasenameValidatorCodec.safeParse()`

### Phase 3: Remove Deprecated Code

- Delete deprecated functions from `utils/`
- Update imports
- Remove deprecated tests

## Questions

1. **Codex Basename Building Logic** ⚠️ **CRITICAL BUG**
   - Current: `addCodexPrefixDeprecated(section)` - **TYPE MISMATCH**
     - Function signature: `(sectionName: string) => string`
     - Called with: `SectionNode` in 2 places (`codex-builder.ts`, `codex-regenerator.ts`)
     - Implementation: Only does `__${sectionName}` - **DOESN'T BUILD SUFFIX**
   - Comments say: "Root: __Library (no suffix), Nested: __Salad-Recipe (suffix = parent chain reversed)"
   - **Actual behavior:** Function doesn't match comments - missing suffix building logic
   - **New format should be:**
     - Root: `__-Library` (nodeName=`__`, suffix=`Library` from libraryRoot)
     - Nested: `__-Child-Parent` (nodeName=`__`, suffix=`Child-Parent` from section chain)
   - **Solution:** Use `canonicalBasenameToChainCodec.encode([...section.nodeNameChainToParent, CODEX_CORE_NAME])`
   - **Question:** Should we fix the current bug first, or implement new format directly?

2. **Backward Compatibility**
   - Should we support both old (`__CodexName`) and new (`__-CodexName`) formats during migration?
   - Or hard break and require manual migration of existing codexes?

3. **Codex Link Format in Content**
   - Codex generator creates links like `[[__SectionName-Parent|SectionName]]`
   - With new format: `[[__-SectionName-Parent|SectionName]]`
   - Question: Should links use the full basename or just the section name?

4. **Settings Dependency**
   - Many functions read `getParsedUserSettings()` internally
   - Question: Should codecs accept settings as parameters (more pure) or read from global state?

5. **Type Safety for `addCodexPrefixDeprecated`**
   - Currently accepts `string` but called with `SectionNode` in 2 places
   - Question: Should the new codec accept `SectionNode | NodeNameChain | string`?

6. **Migration Order**
   - Should we migrate all codecs first, then update call sites?
   - Or migrate file-by-file (create codec + update call sites together)?

## Testing Strategy

1. **Unit Tests**
   - Test each new codec independently
   - Test encode/decode roundtrips
   - Test edge cases (empty chains, root sections, etc.)

2. **Integration Tests**
   - Test codex creation with new format
   - Test codex link parsing
   - Test healing flows with new naming

3. **Migration Tests**
   - If supporting both formats: test detection and conversion
   - Test cleanup of old-format codexes

## Files Requiring Updates

### High Priority (Core Functionality)
- `codex-builder.ts` - codex creation
- `codex-regenerator.ts` - codex cleanup
- `codex-generator.ts` - codex content generation
- `click-handler.ts` - codex link parsing

### Medium Priority (Healing)
- `intent-resolver.ts`
- `init-healer.ts`
- `drag-handler.ts`
- `create-handler.ts`
- `vault-to-tree.ts`

### Low Priority (Utilities)
- `path-parsers.ts`
- `event-handlers.ts`
- `tree-reader.ts`

## Estimated Impact

- **Files to create:** 6 new codec files
- **Files to update:** 13 files
- **Files to delete:** 3 deprecated utility files
- **Test files to update:** ~5 test files

