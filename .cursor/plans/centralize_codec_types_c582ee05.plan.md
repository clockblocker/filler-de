---
name: Centralize Codec Types
overview: Move locator types to codecs/locator/types/, add generic SegmentIdOf<NK>, and centralize all codec-related types in codecs/types/ with consistent generic patterns.
todos: []
---

# Centralize Codec Types and Add Missing Generics

## Overview

Move all codec-related type **definitions** (not re-exports) into `codecs/{entity}/types/` folders. Codecs should own their types, not re-export from scattered locations. Use `{Entity}Of<NK>` pattern for generics. Common helpers live in `codecs/types/`.

## Problem

Currently codec types are scattered:

- `codecs/canonical-split-path/types.ts` just re-exports from `healer/library-tree/tree-action/utils/canonical-naming/types.ts`
- `codecs/split-path-inside-library/types.ts` just re-exports from `healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths.ts`
- Locator types live in `healer/library-tree/tree-action/types/target-chains.ts`

This creates a mess where types are defined far from where they're used.

## Solution

Move type **definitions** into codec folders. Codecs own their types.

## File Structure

```
codecs/
  types/
    type-mappings.ts          # Generic helpers: SegmentIdOf<NK>, NodeLocatorOf<NK>, etc.
    index.ts                  # Re-export all common helpers
  locator/
    types/
      schemas.ts              # Zod schemas (moved from target-chains.ts)
      index.ts                # Locator type definitions + re-exports
  split-path-inside-library/
    types/
      index.ts                # SplitPathInsideLibrary type definitions (moved from healer)
  canonical-split-path/
    types/
      index.ts                # CanonicalSplitPathInsideLibrary type definitions (moved from healer)
  segment-id/
    types.ts                  # SegmentIdComponents (already exists, may need updates)
```

## Implementation Tasks

### Phase 1: Move SplitPathInsideLibrary Types

1. **Create `codecs/split-path-inside-library/types/index.ts`**

   - Move type definitions from `healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths.ts`
   - Define: `SplitPathToFolderInsideLibrary`, `SplitPathToFileInsideLibrary`, `SplitPathToMdFileInsideLibrary`, `SplitPathInsideLibrary`
   - Keep `SplitPathInsideLibraryCandidate` (codec-specific)
   - Import base types from `managers/obsidian/vault-action-manager/types/split-path`

2. **Update `codecs/split-path-inside-library/types.ts`**

   - Remove re-exports
   - Re-export from `types/index.ts`

3. **Update imports across codebase**

   - Files importing from `inside-library-split-paths.ts` → update to `codecs/split-path-inside-library/types/`
   - Update `canonical-naming/types.ts` to import from codecs

### Phase 2: Move CanonicalSplitPathInsideLibrary Types

4. **Create `codecs/canonical-split-path/types/index.ts`**

   - Move type definitions from `healer/library-tree/tree-action/utils/canonical-naming/types.ts`
   - Define: `CanonicalSplitPathInsideLibrary`, `CanonicalSplitPathToFolderInsideLibrary`, `CanonicalSplitPathToFileInsideLibrary`, `CanonicalSplitPathToMdFileInsideLibrary`
   - Move helper types: `CanonicalSeparatedSuffixedBasename`, `MakeCanonical<SP>`
   - Import `SplitPathInsideLibrary` from `codecs/split-path-inside-library/types/`

5. **Update `codecs/canonical-split-path/types.ts`**

   - Remove re-exports
   - Re-export from `types/index.ts`

6. **Update imports across codebase**

   - Files importing from `canonical-naming/types.ts` → update to `codecs/canonical-split-path/types/`

### Phase 3: Move Locator Types

7. **Create `codecs/locator/types/schemas.ts`**

   - Move Zod schemas from `healer/library-tree/tree-action/types/target-chains.ts`
   - Import segment ID schemas from `healer/library-tree/tree-node/types/node-segment-id.ts`
   - Export: `BaseNodeLocatorSchema`, `SectionNodeLocatorSchema`, `ScrollNodeLocatorSchema`, `FileNodeLocatorSchema`, `TreeNodeLocatorSchema`

8. **Create `codecs/locator/types/index.ts`**

   - Define locator types using schemas: `SectionNodeLocator`, `ScrollNodeLocator`, `FileNodeLocator`, `TreeNodeLocator`
   - Re-export schemas from `schemas.ts`
   - Re-export `CanonicalSplitPathInsideLibrary` types from `codecs/canonical-split-path/types/`

9. **Update `codecs/locator/types.ts`**

   - Remove re-exports from healer
   - Re-export from `types/index.ts`

10. **Update `healer/library-tree/tree-action/types/target-chains.ts`**

    - Remove locator type definitions
    - Re-export from `codecs/locator/types/` (backward compatibility)

### Phase 4: Add Generic SegmentIdOf<NK>

11. **Update `codecs/types/type-mappings.ts`**

    - Add `SegmentIdOf<NK extends TreeNodeKind>` generic type
    - Pattern: `Extract<TreeNodeSegmentId, ...>` or use conditional type based on TreeNodeKind
    - Since segment IDs are template literal strings, may need helper type to match by kind

12. **Update `codecs/segment-id/types.ts`**

    - Re-export `SegmentIdOf<NK>` from `codecs/types/type-mappings.ts`

### Phase 5: Centralize Common Helpers

13. **Create `codecs/types/index.ts`**

    - Re-export all helpers from `type-mappings.ts`
    - Single entry point: `SegmentIdOf`, `NodeLocatorOf`, `SplitPathInsideLibraryOf`, `CanonicalSplitPathInsideLibraryOf`, `SegmentIdComponents`, etc.

14. **Update all codec modules**

    - Import common helpers from `codecs/types/` (not directly from `type-mappings.ts`)

### Phase 6: Update All Imports

15. **Update codec internal files**

    - `codecs/locator/internal/*.ts`: Import from `codecs/locator/types/`
    - `codecs/canonical-split-path/internal/*.ts`: Import from `codecs/canonical-split-path/types/`
    - `codecs/split-path-inside-library/internal/*.ts`: Import from `codecs/split-path-inside-library/types/`

16. **Update healer/library-tree files**

    - `healer.ts`, `tree.ts`, `librarian.ts`: Update imports
    - `codex/*.ts` files: Update imports
    - `tree-action/*.ts` files: Update imports

17. **Update `codecs/index.ts`**

    - Update re-exports to use new type locations

### Phase 7: Cleanup

18. **Remove or update old type files**

    - `healer/library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths.ts` → remove or keep as re-export stub
    - `healer/library-tree/tree-action/utils/canonical-naming/types.ts` → remove or keep as re-export stub
    - `healer/library-tree/tree-action/types/target-chains.ts` → remove or keep as re-export stub

19. **Verify**

    - No circular dependencies
    - All types compile correctly
    - Generic types narrow properly
    - Exhaustiveness checks pass

## Key Decisions

- **Codecs own their types**: Types are defined in codec folders, not re-exported from healer
- **Segment IDs stay in tree-node**: Domain types, but we add generic `SegmentIdOf<NK>` in codecs/types
- **Common helpers in codecs/types/**: All generic helpers (`Of` types, mappings) live there
- **Backward compatibility**: Keep re-export stubs in healer during migration if needed

## Files to Create

- `codecs/split-path-inside-library/types/index.ts`
- `codecs/canonical-split-path/types/index.ts`
- `codecs/locator/types/schemas.ts`
- `codecs/locator/types/index.ts`
- `codecs/types/index.ts`

## Files to Modify

- `codecs/types/type-mappings.ts` (add SegmentIdOf)
- `codecs/split-path-inside-library/types.ts`
- `codecs/canonical-split-path/types.ts`
- `codecs/locator/types.ts`
- `codecs/index.ts`
- `codecs/*/internal/*.ts` (update imports)
- ~30+ files importing from old type locations