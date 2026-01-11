# DTO Codec API Architecture

## Overview

Create a clean, expandable API for orchestrators to work with DTOs, backed by pure neverthrow/zod codecs organized in a clear structure. Centralize all segment ID parsing and split path transformations.

## Core DTOs Identified

1. **Segment IDs**: `SectionNodeSegmentId`, `ScrollNodeSegmentId`, `FileNodeSegmentId`, `TreeNodeSegmentId`
2. **Locators**: `SectionNodeLocator`, `ScrollNodeLocator`, `FileNodeLocator`, `TreeNodeLocator`
3. **Split Paths**: `SplitPathInsideLibrary` variants
4. **Canonical Split Paths**: `CanonicalSplitPathInsideLibrary` variants
5. **Separated Suffixed Basename**: `{ coreName: NodeName, suffixParts: NodeName[] }`
6. **Path Components**: `pathParts: string[]`, `nodeName: NodeName`, `extension: string`

## Leaky Abstractions Found

1. **Segment ID parsing duplicated** in 7+ places:

   - `healer.ts`: `extractNodeNameFromSegmentId`, `extractNodeNameFromLeafSegmentId`, `extractExtensionFromSegmentId`
   - `tree.ts`: `extractNodeNameFromSegmentId`
   - `codex-split-path.ts`: `extractNodeNameFromSegmentId`
   - `generate-codex-content.ts`: `extractNodeNameFromSegmentId`
   - `locator-codec.ts`: `nodeNameFromSectionSegmentId`, `parseSegmentIdTrusted`
   - `locator-utils.ts`: `getNodeName`
   - `librarian.ts`: `extractNodeNameFromScrollSegmentId` (line 583)

2. **Split path building logic** duplicated in orchestrators:

   - `healer.ts`: `buildCanonicalLeafSplitPath`, `buildObservedLeafSplitPath`, `buildSectionPath`
   - `librarian.ts`: `computeScrollSplitPath` (line 593) - manually builds split path from node name + parent chain

3. **Suffix utilities** used directly instead of through codec API

4. **Manual segment ID construction** in `librarian.ts` (line 381):
   - String concatenation: `` `${target.nodeName}${NodeSegmentIdSeparator}${TreeNodeType.Scroll}${NodeSegmentIdSeparator}md` ``
   - Should use `serializeSegmentId` codec

## Proposed File Structure

```
library-tree/
  codecs/
    segment-id/
      parse.ts          # segment ID -> { nodeName, type, extension }
      serialize.ts      # { nodeName, type, extension } -> segment ID
      index.ts
    locator/
      to-canonical-split-path.ts  # locator -> canonical split path
      from-canonical-split-path.ts # canonical split path -> locator
      index.ts
    split-path/
      to-canonical.ts   # split path -> canonical (with validation)
      from-canonical.ts # canonical -> split path (drop separated suffix)
      index.ts
    suffix/
      parse.ts          # basename -> separated suffix
      serialize.ts     # separated suffix -> basename
      path-parts.ts    # path parts <-> suffix parts conversions
      index.ts
    index.ts            # Main API exports
```

## Codec API Design

All codecs follow this pattern:

- **Bidirectional**: `parse*` (validate/parse) and `serialize*` (construct)
- **Pure functions**: No side effects
- **neverthrow**: All return `Result<T, string>`
- **zod validation**: Where applicable
- **Type-safe**: Full TypeScript inference

### Example API Structure

```typescript
// codecs/segment-id/index.ts
export const parseSegmentId = (id: TreeNodeSegmentId): Result<SegmentIdComponents, string>
export const serializeSegmentId = (components: SegmentIdComponents): TreeNodeSegmentId

// codecs/locator/index.ts
export const locatorToCanonicalSplitPath = (loc: TreeNodeLocator): Result<CanonicalSplitPathInsideLibrary, string>
export const canonicalSplitPathToLocator = (sp: CanonicalSplitPathInsideLibrary): Result<TreeNodeLocator, string>

// codecs/split-path/index.ts
export const splitPathToCanonical = (sp: SplitPathInsideLibrary): Result<CanonicalSplitPathInsideLibrary, string>
export const canonicalSplitPathToRegular = (sp: CanonicalSplitPathInsideLibrary): SplitPathInsideLibrary

// codecs/suffix/index.ts
export const parseSeparatedSuffix = (basename: string): Result<SeparatedSuffixedBasename, string>
export const serializeSeparatedSuffix = (suffix: SeparatedSuffixedBasename): string
export const pathPartsToSuffixParts = (pathParts: string[]): NodeName[]
export const suffixPartsToPathParts = (suffixParts: NodeName[]): string[]
```

## Integration with bulk-vault-action-adapter

The `bulk-vault-action-adapter` layer has two types of codecs:

1. **Domain-specific scoping codecs** (stay in `layers/library-scope/codecs/`):
   - `split-path-inside-the-library.ts` - vault scoped ↔ library scoped conversions
   - `events/make-event-libray-scoped.ts` - event scoping transformations
   - These are adapter-specific and remain in their current location

2. **General DTO codecs** (move to centralized `codecs/`):
   - Currently imported from `tree-action/utils/` in `translate-material-event/translators/helpers/locator.ts`
   - Uses: locator codecs, canonical split path codecs, suffix codecs
   - These should use the new centralized API

**Integration points:**
- `translate-material-event/translators/helpers/locator.ts` imports from `utils/` → should import from `codecs/`
- `translate-material-event/translate-material-events.ts` uses suffix utils → should use `codecs/suffix/`
- `translate-material-event/policy-and-intent/intent/infer-intent.ts` uses suffix utils → should use `codecs/suffix/`

**What stays where:**
- `library-scope/codecs/` - scoping transformations (vault ↔ library boundary)
- `codecs/` (new centralized) - core DTO transformations (segment-id, locator, split-path, suffix)

## Implementation Steps

1. **Create `codecs/segment-id/` module**

   - Extract all segment ID parsing logic
   - Create bidirectional codecs
   - Replace all duplicated parsing calls

2. **Refactor `codecs/locator/`**

   - Move existing `locator-codec.ts` functions
   - Ensure bidirectional Result-based API
   - Fix `makeCanonicalSplitPathInsideLibraryFromLocator` to return Result

3. **Refactor `codecs/split-path/`**

   - Move canonical split path codecs
   - Ensure clean API surface

4. **Refactor `codecs/suffix/`**

   - Move suffix utilities
   - Organize path parts conversions

5. **Create main `codecs/index.ts`**

   - Export all codec APIs
   - Single entry point for orchestrators

6. **Refactor `healer.ts`**

   - Replace private helpers with codec API calls
   - Remove `buildCanonicalLeafSplitPath`, `buildObservedLeafSplitPath`, etc.
   - Use `locatorToCanonicalSplitPath` instead

7. **Refactor other orchestrators**

   - `tree.ts`: Use segment ID codecs
   - `codex-split-path.ts`: Use segment ID + suffix codecs
   - `generate-codex-content.ts`: Use segment ID codecs
   - `librarian.ts`: Replace `extractNodeNameFromScrollSegmentId` and `computeScrollSplitPath` with codec API, use `serializeSegmentId` for manual construction

8. **Refactor bulk-vault-action-adapter layer**

   - `translate-material-event/translators/helpers/locator.ts`: Replace imports from `utils/` with `codecs/`
   - `translate-material-event/translate-material-events.ts`: Use `codecs/suffix/` instead of direct utils
   - `translate-material-event/policy-and-intent/intent/infer-intent.ts`: Use `codecs/suffix/` instead of direct utils
   - Keep `library-scope/codecs/` as-is (domain-specific scoping codecs)

## Key Files to Modify

- [src/commanders/librarian-new/healer/library-tree/codecs/](src/commanders/librarian-new/healer/library-tree/codecs/) - New structure
- [src/commanders/librarian-new/healer/healer.ts](src/commanders/librarian-new/healer/healer.ts) - Remove private helpers, use codec API
- [src/commanders/librarian-new/healer/library-tree/tree.ts](src/commanders/librarian-new/healer/library-tree/tree.ts) - Use segment ID codecs
- [src/commanders/librarian-new/healer/library-tree/tree-action/utils/locator/locator-codec.ts](src/commanders/librarian-new/healer/library-tree/tree-action/utils/locator/locator-codec.ts) - Move to new structure
- [src/commanders/librarian-new/healer/library-tree/codex/codex-split-path.ts](src/commanders/librarian-new/healer/library-tree/codex/codex-split-path.ts) - Use codec API
- [src/commanders/librarian-new/healer/library-tree/codex/generate-codex-content.ts](src/commanders/librarian-new/healer/library-tree/codex/generate-codex-content.ts) - Use codec API
- [src/commanders/librarian-new/librarian.ts](src/commanders/librarian-new/librarian.ts) - Replace private helpers with codec API
- [src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/locator.ts](src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/locator.ts) - Use centralized codec API
- [src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translate-material-events.ts](src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translate-material-events.ts) - Use codec API

## Todos

- [ ] Create `codecs/segment-id/` module with parse.ts and serialize.ts for bidirectional segment ID transformations
- [ ] Move locator-codec.ts to codecs/locator/ and ensure all functions return Result types
- [ ] Organize split path codecs in codecs/split-path/ with clean API
- [ ] Move suffix utilities to codecs/suffix/ with clear separation of concerns
- [ ] Create codecs/index.ts as main entry point exporting all codec APIs
- [ ] Replace private helpers in healer.ts with codec API calls
- [ ] Update tree.ts to use segment ID codecs instead of private extractNodeNameFromSegmentId
- [ ] Update codex-split-path.ts and generate-codex-content.ts to use codec API
- [ ] Replace extractNodeNameFromScrollSegmentId, computeScrollSplitPath, and manual segment ID construction in librarian.ts with codec API
- [ ] Update bulk-vault-action-adapter translate-material-event layer to use centralized codec API instead of direct utils imports
