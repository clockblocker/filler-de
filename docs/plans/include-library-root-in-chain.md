# Include Library Root in nodeNameChainToParent

## Problem

Current ambiguity: `__-Section` can mean:
- Root section with name "Section": `{ nodeNameChainToParent: [], nodeName: "Section" }`
- Section "Section" under library root: `{ nodeNameChainToParent: [], nodeName: "Section" }`

Both have empty `nodeNameChainToParent`, making them indistinguishable.

## Note
"Library" is a shorthand for libraryRoot from the settings

## Solution

Include library root in `nodeNameChainToParent` internally:

**Before:**
- Root section: `{ nodeNameChainToParent: [], nodeName: "Section" }`
- Nested section: `{ nodeNameChainToParent: ["Parent"], nodeName: "Child" }`

**After:**
- Root section: `{ nodeNameChainToParent: ["Library"], nodeName: "Section" }`
- Library root itself: `{ nodeNameChainToParent: [], nodeName: "Library" }` (currently `nodeName: ""`)
- Nested section: `{ nodeNameChainToParent: ["Library", "Parent"], nodeName: "Child" }`

**User-visible formats remain unchanged:**
- Codex lines: `__-Section` still means root section
- File paths: `Library/Section/Note.md` unchanged
- Suffixes: `Note-Parent` unchanged

## Impact Assessment

### Core Data Structures

#### ✅ Low Impact
- `TreeNode` types (`SectionNode`, `ScrollNode`, `FileNode`)
  - Type definitions unchanged
  - Only data values change

#### ⚠️ Medium Impact
- `NodeNameChain` type
  - Type unchanged, but semantic meaning changes
  - Empty array `[]` now means "library root itself" instead of "root section"

### Conversion Layers (Boundary Functions)

These functions convert between internal (with library root) and external (without library root) representations:

#### 1. Path Conversion
**File:** `src/commanders/librarian/naming/codecs/atomic/path-parts-and-node-name-chain.ts`

**Current:**
- `makePathPartsFromNodeNameChain`: `["Parent"]` → `["Library", "Parent"]`
- `makeNodeNameChainFromPathParts`: `["Library", "Parent"]` → `["Parent"]`

**After:**
- `makePathPartsFromNodeNameChain`: `["Library", "Parent"]` → `["Library", "Parent"]` (no-op)
- `makeNodeNameChainFromPathParts`: `["Library", "Parent"]` → `["Library", "Parent"]` (no-op)

**Impact:** Logic becomes simpler - direct mapping, no library root stripping/adding

#### 2. Codex Basename Encoding/Decoding
**File:** `src/commanders/librarian/naming/functions/codexes.ts`

**Current:**
- `makeCanonicalBasenameForCodexFromSectionNode`: 
  - Input: `{ nodeNameChainToParent: [], nodeName: "Section" }`
  - Creates: `["Section"]` → adds library root → `["Library", "__"]` → `"__-Library"` ❌ (wrong)
  - Actually creates: `["Section"]` → `["Section", "__"]` → `"__-Section"` ✓

**After:**
- `makeCanonicalBasenameForCodexFromSectionNode`:
  - Input: `{ nodeNameChainToParent: ["Library"], nodeName: "Section" }`
  - Creates: `["Library", "Section"]` → `["Library", "Section", "__"]` → `"__-Section-Library"` ❌
  - **Need:** Strip library root before encoding: `["Section"]` → `["Section", "__"]` → `"__-Section"` ✓

**Functions to update:**
- `makeCanonicalBasenameForCodexFromSectionNode`: Strip library root before encoding
- `makeNodeNameChainToParentFromCanonicalBasenameForCodex`: Add library root after decoding

**Impact:** Add library root stripping/adding in codex encoding/decoding functions

#### 3. Codex Line Formatting/Parsing
**Files:** 
- `src/commanders/librarian/codex/content/parsers-and-formatters/format-as-typed-codex-line.ts`
- `src/commanders/librarian/codex/content/parsers-and-formatters/parse-intended-tree-node.ts`

**Current:** Uses `nodeNameChainToParent` directly

**After:** 
- Formatting: Strip library root before creating codex line
- Parsing: Add library root after parsing codex line

**Impact:** Add conversion layer in format/parse functions

### Tree Construction

#### 1. Reconciliation (Vault → Tree)
**File:** `src/commanders/librarian/reconciliation/vault-to-tree.ts`

**Functions:**
- `toNodeNameChain(splitPath)`: Currently strips library root
  - **After:** Keep library root: `["Library", "Parent"]` → `["Library", "Parent"]`
- `toParentChain(splitPath)`: Currently strips library root
  - **After:** Keep library root: `["Library", "Parent"]` → `["Library"]`

**Impact:** Remove library root stripping logic

#### 2. Library Tree Operations
**File:** `src/commanders/librarian/library-tree.ts`

**Functions:**
- `createNode`: Uses `nodeNameChainToParent` directly
- `moveNode`: Uses `nodeNameChainToParent` directly
- `getNodeInternal`: Uses full chain `[...nodeNameChainToParent, nodeName]`

**Impact:** All operations now work with library root included - should be transparent

#### 3. Tree Actions
**File:** `src/commanders/librarian/types/tree-action.ts`

**Impact:** Action payloads include library root in chains - should be transparent

### Codex Generation

**File:** `src/commanders/librarian/codex/codex-generator.ts`

**Current logic:**
```typescript
if (section.nodeNameChainToParent.length === 0 && section.nodeName === "") {
  // Root library - no backlink
} else if (section.nodeNameChainToParent.length > 0) {
  // Nested section - parent is last element
  const parentName = section.nodeNameChainToParent[section.nodeNameChainToParent.length - 1];
}
```

**After:**
```typescript
if (section.nodeNameChainToParent.length === 0 && section.nodeName === libraryRoot) {
  // Root library - no backlink
} else if (section.nodeNameChainToParent.length === 1 && section.nodeNameChainToParent[0] === libraryRoot) {
  // Root section (first level under library) - no backlink? Or backlink to library root?
  // **Question:** Should root sections have backlink to library root?
} else if (section.nodeNameChainToParent.length > 1) {
  // Nested section - parent is last element (skip library root)
  const parentName = section.nodeNameChainToParent[section.nodeNameChainToParent.length - 1];
}
```

**Impact:** Update parent detection logic

### Event Handlers

**File:** `src/commanders/librarian/orchestration/event-handlers.ts`

**Functions:**
- `computeImpactedChainsFromActions`: Extracts chains from actions
- `parseDeletePathToChain`: Parses paths to chains

**Impact:** Chains now include library root - should be transparent

### Utility Functions

**Files:**
- `src/commanders/librarian/utils/split-path-to-leaf.ts`
- `src/commanders/librarian/utils/tree-path-utils.ts`
- `src/commanders/librarian/utils/find-common-ancestor.ts`
- `src/commanders/librarian/orchestration/path-parsers.ts`

**Impact:** Review each function - may need updates if they assume empty chain = root

### Tests

**Impact:** All tests need updates:
- Update test data to include library root in chains
- Update expectations for root sections
- Update codex encoding/decoding tests
- Update tree construction tests
- Update codex generation tests

**Files to update:**
- All test files in `tests/unit/librarian/`
- All test files in `tests/specs/library-tree/`

## Implementation Plan

### Phase 1: Update Core Conversion Functions

1. **Path Conversion** (`path-parts-and-node-name-chain.ts`)
   - Update `makePathPartsFromNodeNameChain`: Remove library root prepending
   - Update `makeNodeNameChainFromPathParts`: Remove library root stripping
   - Update tests

2. **Codex Encoding/Decoding** (`codexes.ts`)
   - Update `makeCanonicalBasenameForCodexFromSectionNode`: Strip library root before encoding
   - Update `makeNodeNameChainToParentFromCanonicalBasenameForCodex`: Add library root after decoding
   - Update tests

3. **Codex Line Formatting/Parsing**
   - Update `formatAsTypedCodexLine`: Strip library root before formatting
   - Update `parseIntendedTreeNode`: Add library root after parsing
   - Update tests

### Phase 2: Update Tree Construction

4. **Reconciliation** (`vault-to-tree.ts`)
   - Update `toNodeNameChain`: Keep library root
   - Update `toParentChain`: Keep library root
   - Update tests

5. **Library Tree** (`library-tree.ts`)
   - Update `createRootSection()`: Change `nodeName: ""` to `nodeName: libraryRoot`
   - Review all methods - should work transparently
   - Update root section detection logic
   - Update tests

### Phase 3: Update Codex Generation

6. **Codex Generator** (`codex-generator.ts`)
   - Update parent detection logic
   - Handle root library vs root section distinction
   - Update tests

### Phase 4: Update Utilities & Event Handlers

7. **Utility Functions**
   - Review and update each utility function
   - Update tests

8. **Event Handlers** (`event-handlers.ts`)
   - Review chain extraction logic
   - Update tests

### Phase 5: Update All Tests

9. **Test Updates**
   - Update all test data
   - Update all expectations
   - Ensure all tests pass

## Questions

1. **Root Library Node:**
   - Currently: `{ nodeNameChainToParent: [], nodeName: "" }` (empty name)
   - After: `{ nodeNameChainToParent: [], nodeName: "Library" }` (library root name)
   A: Use library root name for consistency

2. **Codex Generation for Root Sections:**
   - Should root sections (first level under library) have a backlink to library root?
   - Currently: No backlink for `nodeNameChainToParent.length === 0`
   - After: `nodeNameChainToParent.length === 1 && nodeNameChainToParent[0] === libraryRoot`
   - A: Add a backlink to library root

3. **Empty Chain Semantics:**
   - Currently: `[]` = "root section" (first level under library)
   - After: `[]` = "library root itself"
   - **Audit needed:** All `nodeNameChainToParent.length === 0` checks need review
   - **Key locations:**
     - `codex-generator.ts:31` - root library detection (update to check `nodeName === libraryRoot`)
     - `tree-node-to-split-path-codec.ts:33` - deprecated, but needs update
   - A: Update all checks to use `length === 0 && nodeName === libraryRoot` for root library, or `length === 1 && chain[0] === libraryRoot` for root sections

4. **Migration Strategy:**
   - Do we need to migrate existing tree data?
   - Or is tree rebuilt from vault on each load?
   - A: Tree rebuilt from vault on each load (no migration needed)

5. **Backward Compatibility:**
   - Are there any external APIs that expose `nodeNameChainToParent`?
   - Do we need to maintain backward compatibility?
   - A: We do NOT need to maintain backward compatibility (purely internal change)

6. **Codex Basename Format:**
   - Current: `__-Section` for root section
   - After: Still `__-Section` (stripped before encoding)
   - Confirmed: User-visible format unchanged ✓

7. **File Path Format:**
   - Current: `Library/Section/Note.md`
   - After: Still `Library/Section/Note.md`
   - Confirmed: User-visible format unchanged ✓

8. **Suffix Format:**
   - Current: `Note-Parent` for note under "Parent" section
   - After: Still `Note-Parent`
   - Confirmed: User-visible format unchanged ✓

9. **Testing Strategy:**
   - Should we update all tests at once?
   - Or update incrementally with each phase?
   - A: Incremental with each phase

10. **Edge Cases:**
    - What if library root name changes? A: Only when user changes settings. If they do, it triggers reload. We do not care about it now.
    - What if a section is named the same as library root? A: Then it is `["Library", "parent", "Library"]`. Totally fine for us.

