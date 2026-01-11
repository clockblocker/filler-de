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

1. **Segment ID parsing duplicated** in 8+ places:

   - `healer.ts`: `extractNodeNameFromSegmentId`, `extractNodeNameFromLeafSegmentId`, `extractExtensionFromSegmentId`
   - `tree.ts`: `extractNodeNameFromSegmentId`
   - `codex-split-path.ts`: `extractNodeNameFromSegmentId`
   - `codex-impact-to-actions.ts`: `extractNodeNameFromSegmentId`
   - `generate-codex-content.ts`: `extractNodeNameFromSegmentId`
   - `locator-codec.ts`: `nodeNameFromSectionSegmentId`, `parseSegmentIdTrusted`
   - `locator-utils.ts`: `getNodeName` (throws instead of returning Result)
   - `librarian.ts`: `extractNodeNameFromScrollSegmentId` (line 583)

2. **Split path building logic** duplicated in orchestrators:

   - `healer.ts`: `buildCanonicalLeafSplitPath`, `buildObservedLeafSplitPath`, `buildSectionPath`
   - `librarian.ts`: `computeScrollSplitPath` (line 593) - manually builds split path from node name + parent chain
   - `codex-impact-to-actions.ts`: `computeScrollSplitPath` - duplicate implementation

3. **Suffix utilities** used directly instead of through codec API

4. **Manual segment ID construction** in `librarian.ts` (line 381):
   - String concatenation: `` `${target.nodeName}${NodeSegmentIdSeparator}${TreeNodeType.Scroll}${NodeSegmentIdSeparator}md` ``
   - Should use `serializeSegmentId` codec

5. **Locator utilities that throw** instead of returning Result:
   - `locator-utils.ts`: `getNodeName` (line 12) - throws on invalid NodeName
   - `locator-utils.ts`: `getParentLocator` (line 26) - throws when no parent exists
   - Should be replaced with Result-based codec API

## Proposed File Structure

```
library-tree/
  codecs/
    errors.ts           # CodecError discriminated union type
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

### General Principles

- **Bidirectional**: `parse*` (validate/parse) and `serialize*` (construct)
- **Pure functions**: No side effects
- **neverthrow**: Parse functions return `Result<T, CodecError>`, serialize functions return direct values (no validation needed)
- **zod validation**: Where applicable for parsing
- **Type-safe**: Full TypeScript inference

### Result Return Type Strategy

- **Parse functions** (`parse*`, `tryParse*`): Return `Result<T, CodecError>` - validation may fail with structured errors
- **Serialize functions** (`serialize*`, `make*`): Return direct values - construction cannot fail
- **Pure transformations** (e.g., `pathPartsToSuffixParts`): Return direct values - no validation needed

### Error Handling

**Structured error types**: All parse functions return `Result<T, CodecError>` where `CodecError` is a discriminated union enabling:
- Actionable error messages with context
- Stable error classification for telemetry, intent inference, policy decisions
- Distinction between recoverable vs fatal parsing failures
- Programmatic routing (e.g., extension invalid vs nodeName invalid)

**CodecError discriminated union** (defined in `codecs/errors.ts`):

```typescript
export type CodecError =
  | { kind: 'InvalidNodeName'; message: string; context: { raw: string } }
  | { kind: 'InvalidSegmentId'; reason: 'MissingParts' | 'UnknownType' | 'InvalidFormat'; raw: string; context?: Record<string, unknown> }
  | { kind: 'InvalidExtension'; message: string; raw: string; expected?: string[] }
  | { kind: 'InvalidSplitPath'; reason: 'InvalidPathParts' | 'InvalidBasename' | 'MissingExtension'; context: Record<string, unknown> }
  | { kind: 'InvalidSuffix'; reason: 'InvalidDelimiter' | 'EmptyParts'; raw: string; context?: Record<string, unknown> }
  | { kind: 'ZodError'; issues: ZodIssue[]; context?: Record<string, unknown> }
  | { kind: 'LocatorError'; reason: 'NoParent' | 'InvalidChain'; context: Record<string, unknown> }
  | { kind: 'CanonicalizationError'; reason: string; context: Record<string, unknown> };
```

- Use zod validation errors when parsing structured data (wrapped in `ZodError` variant)
- Preserve original error context when chaining codecs
- Enable pattern matching on `kind` for error handling strategies

### Example API Structure

```typescript
// codecs/errors.ts
export type CodecError = /* ... discriminated union ... */

// codecs/segment-id/types.ts
export type SegmentIdComponents = {
  coreName: NodeName;
  targetType: TreeNodeType;
  extension?: string; // Required for Scroll/File, absent for Section
}

// codecs/segment-id/index.ts
import type { CodecError } from '../errors';
// Unified parser handles all types, returns discriminated union
export const parseSegmentId = (id: TreeNodeSegmentId): Result<SegmentIdComponents, CodecError>
// Type-specific parsers for convenience
export const parseSectionSegmentId = (id: SectionNodeSegmentId): Result<Omit<SegmentIdComponents, 'extension'>, CodecError>
export const parseScrollSegmentId = (id: ScrollNodeSegmentId): Result<SegmentIdComponents & { extension: 'md' }, CodecError>
export const parseFileSegmentId = (id: FileNodeSegmentId): Result<SegmentIdComponents & { extension: FileExtension }, CodecError>

// Serialize returns direct value (construction cannot fail)
export const serializeSegmentId = (components: SegmentIdComponents): TreeNodeSegmentId

// codecs/locator/index.ts
export const locatorToCanonicalSplitPath = (loc: TreeNodeLocator): Result<CanonicalSplitPathInsideLibrary, CodecError>
export const canonicalSplitPathToLocator = (sp: CanonicalSplitPathInsideLibrary): Result<TreeNodeLocator, CodecError>

// codecs/split-path/index.ts
export const splitPathToCanonical = (sp: SplitPathInsideLibrary): Result<CanonicalSplitPathInsideLibrary, CodecError>
// Convert canonical split path back to regular format (for Obsidian API compatibility)
// Drops separatedSuffixedBasename field, reconstructs basename from it (lossy but required for vault operations)
export const makeRegularSplitPathInsideLibrary = (sp: CanonicalSplitPathInsideLibrary): SplitPathInsideLibrary

// codecs/suffix/index.ts
export const parseSeparatedSuffix = (basename: string): Result<SeparatedSuffixedBasename, CodecError>
export const splitBySuffixDelimiter = (basename: string): Result<NonEmptyArray<NodeName>, CodecError>
export const serializeSeparatedSuffix = (suffix: SeparatedSuffixedBasename): string
export const makeJoinedSuffixedBasename = (suffix: SeparatedSuffixedBasename): string

// Path parts <-> suffix parts conversions
// Note: Library root handling differs - use appropriate function for your context
// pathParts WITH library root -> suffixParts WITHOUT root (drops first element, then reverses)
export const makeSuffixPartsFromPathPartsWithRoot = (pathParts: string[]): NodeName[]
// pathParts WITHOUT library root -> suffixParts (just reverses)
export const makeSuffixPartsFromPathParts = (pathParts: string[]): NodeName[]
// Reverse: suffixParts -> pathParts (no library root, reversed)
export const makePathPartsFromSuffixParts = (suffixParts: NodeName[]): string[]
```

### Segment ID Handling Strategy

**Unified approach**: Single `parseSegmentId` function that handles all types via discriminated union return type. Type-specific parsers provided for convenience and type narrowing.

**Rationale**: Segment IDs share the same format structure, only differ in required fields (extension). Unified parser reduces duplication while type-specific parsers provide better type safety.

## Integration with bulk-vault-action-adapter

The `bulk-vault-action-adapter` layer has two types of codecs:

1. **Domain-specific scoping codecs** (stay in `layers/library-scope/codecs/`):
   - `split-path-inside-the-library.ts` - vault scoped ↔ library scoped conversions
   - `events/make-event-library-scoped.ts` - event scoping transformations
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

1. **Create `codecs/errors.ts`**

   - Define `CodecError` discriminated union type
   - Export error constructors/helpers for consistent error creation
   - Document error handling patterns

2. **Create `codecs/segment-id/` module**

   - Extract all segment ID parsing logic from: `healer.ts`, `tree.ts`, `codex-split-path.ts`, `codex-impact-to-actions.ts`, `generate-codex-content.ts`, `locator-codec.ts`, `locator-utils.ts`, `librarian.ts`
   - Define `SegmentIdComponents` type: `{ coreName: NodeName; targetType: TreeNodeType; extension?: string }`
   - Create unified `parseSegmentId` + type-specific convenience parsers (return `Result<T, CodecError>`)
   - Create `serializeSegmentId` for construction
   - Replace all duplicated parsing calls
   - **Replace `getNodeName` from `locator-utils.ts`** with segment ID codec (currently throws)

3. **Refactor `codecs/locator/`**

   - Move existing `locator-codec.ts` functions from `tree-action/utils/locator/`
   - Ensure bidirectional Result-based API for parse functions (return `Result<T, CodecError>`)
   - **Critical**: Fix `makeCanonicalSplitPathInsideLibraryFromLocator` (currently throws on line 127) to return `Result<CanonicalSplitPathInsideLibrary, CodecError>` instead
   - Update `makeLocatorFromCanonicalSplitPathInsideLibrary` to return `Result<TreeNodeLocator, CodecError>` if needed

4. **Refactor `codecs/split-path/`**

   - Move canonical split path codecs from `tree-action/utils/canonical-naming/`
   - Ensure clean API surface (parse functions return `Result<T, CodecError>`)
   - **Note**: `makeRegularSplitPathInsideLibrary` drops `separatedSuffixedBasename` field and reconstructs `basename` from it (lossy conversion) - required for Obsidian vault API compatibility

5. **Refactor `codecs/suffix/`**

   - Move suffix utilities from `tree-action/utils/canonical-naming/suffix-utils/`
   - Include all variants: `makeSuffixPartsFromPathParts`, `makeSuffixPartsFromPathPartsWithRoot`
   - Organize path parts conversions with clear library root handling
   - Ensure `splitBySuffixDelimiter` and `makeJoinedSuffixedBasename` are included
   - Parse functions return `Result<T, CodecError>`

6. **Create main `codecs/index.ts`**

   - Export all codec APIs including `CodecError` type
   - Single entry point for orchestrators

7. **Refactor `healer.ts`**

   - Replace private helpers with codec API calls
   - Remove `buildCanonicalLeafSplitPath`, `buildObservedLeafSplitPath`, etc.
   - Use `locatorToCanonicalSplitPath` instead
   - Handle `Result<T, CodecError>` returns with appropriate error handling

8. **Refactor other orchestrators**

   - `tree.ts`: Use segment ID codecs, replace `getNodeName` call with codec API, handle `CodecError`
   - `codex-split-path.ts`: Use segment ID + suffix codecs, handle `CodecError`
   - `codex-impact-to-actions.ts`: Replace `extractNodeNameFromSegmentId` and `computeScrollSplitPath` with codec API, handle `CodecError`
   - `generate-codex-content.ts`: Use segment ID codecs, handle `CodecError`
   - `librarian.ts`: Replace `extractNodeNameFromScrollSegmentId` and `computeScrollSplitPath` with codec API, use `serializeSegmentId` for manual construction, handle `CodecError`

9. **Refactor bulk-vault-action-adapter layer**

   - `translate-material-event/translators/helpers/locator.ts`: Replace imports from `utils/` with `codecs/`
   - `translate-material-event/translate-material-events.ts`: Use `codecs/suffix/` instead of direct utils
   - `translate-material-event/policy-and-intent/intent/infer-intent.ts`: Use `codecs/suffix/` instead of direct utils
   - Keep `library-scope/codecs/` as-is (domain-specific scoping codecs)

## Key Files to Modify

### New Structure
- [src/commanders/librarian-new/healer/library-tree/codecs/](src/commanders/librarian-new/healer/library-tree/codecs/) - New centralized codec structure

### Source Files (to be refactored)
- [src/commanders/librarian-new/healer/healer.ts](src/commanders/librarian-new/healer/healer.ts) - Remove private helpers, use codec API
- [src/commanders/librarian-new/healer/library-tree/tree.ts](src/commanders/librarian-new/healer/library-tree/tree.ts) - Use segment ID codecs
- [src/commanders/librarian-new/healer/library-tree/tree-action/utils/locator/locator-codec.ts](src/commanders/librarian-new/healer/library-tree/tree-action/utils/locator/locator-codec.ts) - Move functions to `codecs/locator/`
- [src/commanders/librarian-new/healer/library-tree/tree-action/utils/canonical-naming/canonical-split-path-codec.ts](src/commanders/librarian-new/healer/library-tree/tree-action/utils/canonical-naming/canonical-split-path-codec.ts) - Move to `codecs/split-path/`
- [src/commanders/librarian-new/healer/library-tree/tree-action/utils/canonical-naming/suffix-utils/core-suffix-utils.ts](src/commanders/librarian-new/healer/library-tree/tree-action/utils/canonical-naming/suffix-utils/core-suffix-utils.ts) - Move to `codecs/suffix/`
- [src/commanders/librarian-new/healer/library-tree/codex/codex-split-path.ts](src/commanders/librarian-new/healer/library-tree/codex/codex-split-path.ts) - Use codec API
- [src/commanders/librarian-new/healer/library-tree/codex/codex-impact-to-actions.ts](src/commanders/librarian-new/healer/library-tree/codex/codex-impact-to-actions.ts) - Use codec API
- [src/commanders/librarian-new/healer/library-tree/codex/generate-codex-content.ts](src/commanders/librarian-new/healer/library-tree/codex/generate-codex-content.ts) - Use codec API
- [src/commanders/librarian-new/healer/library-tree/tree-action/utils/locator/locator-utils.ts](src/commanders/librarian-new/healer/library-tree/tree-action/utils/locator/locator-utils.ts) - Replace `getNodeName` and `getParentLocator` with codec API
- [src/commanders/librarian-new/librarian.ts](src/commanders/librarian-new/librarian.ts) - Replace private helpers with codec API

### Adapter Layer
- [src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/locator.ts](src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/helpers/locator.ts) - Use centralized codec API
- [src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/traslate-rename-materila-event.ts](src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translators/traslate-rename-materila-event.ts) - Replace `getNodeName` with codec API
- [src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translate-material-events.ts](src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/translate-material-events.ts) - Use codec API
- [src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent/intent/infer-intent.ts](src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent/intent/infer-intent.ts) - Use codec API

## Testing Strategy

- Unit tests for each codec module in `tests/unit/librarian/library-tree/codecs/`
- Test bidirectional round-trips: `parse` then `serialize` should yield original value
- Test error cases: invalid segment IDs, malformed basenames, etc.
- Test edge cases: empty suffix parts, library root handling, folder vs file distinctions
- Integration tests: verify orchestrators work correctly with new codec API

## Migration Notes

### Critical Breaking Changes

1. **`makeCanonicalSplitPathInsideLibraryFromLocator`** (locator-codec.ts:127):
   - Currently throws `Error` on failure
   - **Must be changed** to return `Result<CanonicalSplitPathInsideLibrary, CodecError>`
   - All call sites need error handling updates with pattern matching on `CodecError.kind`

2. **Segment ID parsing**:
   - All `extractNodeNameFromSegmentId` variants must be replaced
   - Unified `parseSegmentId` returns `Result<T, CodecError>`, call sites need error handling
   - `getNodeName` from `locator-utils.ts` currently throws - must be replaced with Result-based codec
   - Error handling should pattern match on `CodecError.kind` for actionable responses

3. **Locator utilities**:
   - `getNodeName` (locator-utils.ts:12): Currently throws on invalid NodeName - replace with segment ID codec returning `Result<T, CodecError>`
   - `getParentLocator` (locator-utils.ts:26): Currently throws when no parent - replace with Result-based alternative returning `Result<TreeNodeLocator, CodecError>` with `kind: 'LocatorError', reason: 'NoParent'`

4. **Suffix utilities**:
   - Library root handling now explicit via separate functions (`makeSuffixPartsFromPathParts` vs `makeSuffixPartsFromPathPartsWithRoot`)
   - Call sites must use appropriate function based on whether pathParts includes library root

## Todos

- [ ] Create `codecs/errors.ts` with `CodecError` discriminated union type
  - [ ] Define all error variants with appropriate context fields
  - [ ] Export error constructors/helpers for consistent error creation
- [ ] Create `codecs/segment-id/` module with parse.ts, serialize.ts, and types.ts
  - [ ] Define `SegmentIdComponents` type
  - [ ] Implement unified `parseSegmentId` + type-specific parsers (return `Result<T, CodecError>`)
  - [ ] Implement `serializeSegmentId`
- [ ] Move locator-codec.ts to codecs/locator/ and ensure all parse functions return `Result<T, CodecError>`
  - [ ] **Fix**: `makeCanonicalSplitPathInsideLibraryFromLocator` to return `Result<CanonicalSplitPathInsideLibrary, CodecError>` (currently throws)
- [ ] Organize split path codecs in codecs/split-path/ with clean API
  - [ ] Use `makeRegularSplitPathInsideLibrary` name (matches existing code) - document that it's lossy (drops separated suffix, reconstructs basename)
  - [ ] Parse functions return `Result<T, CodecError>`
- [ ] Move suffix utilities to codecs/suffix/ with clear separation of concerns
  - [ ] Include all variants: `makeSuffixPartsFromPathParts`, `makeSuffixPartsFromPathPartsWithRoot`
  - [ ] Include `splitBySuffixDelimiter` and `makeJoinedSuffixedBasename`
  - [ ] Document library root handling requirements
  - [ ] Parse functions return `Result<T, CodecError>`
- [ ] Create codecs/index.ts as main entry point exporting all codec APIs including `CodecError`
- [ ] Replace private helpers in healer.ts with codec API calls, handle `CodecError` appropriately
- [ ] Update tree.ts to use segment ID codecs instead of private extractNodeNameFromSegmentId, replace `getNodeName` call, handle `CodecError`
- [ ] Update codex-split-path.ts, codex-impact-to-actions.ts, and generate-codex-content.ts to use codec API, handle `CodecError`
- [ ] Replace extractNodeNameFromScrollSegmentId, computeScrollSplitPath, and manual segment ID construction in librarian.ts with codec API, handle `CodecError`
- [ ] Replace `getNodeName` calls in tree.ts and translate-rename-material-event.ts with segment ID codec, handle `CodecError`
- [ ] Update bulk-vault-action-adapter translate-material-event layer to use centralized codec API instead of direct utils imports
- [ ] Add unit tests for all codec modules
  - [ ] Test error cases return appropriate `CodecError` variants
  - [ ] Test error context preservation
  - [ ] Test pattern matching on error kinds
- [ ] Update integration tests to verify orchestrators work with new API and handle `CodecError` appropriately