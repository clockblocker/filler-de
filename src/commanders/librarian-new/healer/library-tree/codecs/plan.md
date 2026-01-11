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
    split-path-inside-library/ # (either {pathParts: [], basename: {LibraryRootBasename}}, or pathParts include {LibraryRootBasename})
      check-if-inside-library.ts   # split path -> bool 
      to-inside-library.ts   # split path -> split path inside library (Result<chop off LibraryRoot path parts for the files inside>)
      from-inside-library.ts # canonical -> split path path inside library 
      index.ts
    canonical-split-path/
      to-canonical.ts   # split path inside library -> canonical (with validation and suffix separated)
      from-canonical.ts # canonical -> split path path inside library (join separated suffix)
      index.ts
    suffix/
      parse.ts          # basename -> separated suffix
      serialize.ts      # separated suffix -> basename
      path-parts.ts     # path parts <-> suffix parts conversions
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
- **Consistent naming**: Use consistent verb set (`parse`/`serialize`, `toCanonical`/`fromCanonical`), encode scope in function names, avoid mixing "make/build/compute"
- **Grouped exports**: Organize by concept (segmentId, locator, splitPath, suffix), provide both flat and namespace exports for discoverability

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

Keep a smaller top-level set with detailed reasons inside, plus standard `cause` field for chaining:

```typescript
export type CodecError =
  | { kind: 'SegmentIdError'; reason: 'MissingParts' | 'UnknownType' | 'InvalidFormat' | 'InvalidNodeName' | 'InvalidExtension'; raw: string; message: string; context?: Record<string, unknown>; cause?: CodecError }
  | { kind: 'SuffixError'; reason: 'InvalidDelimiter' | 'EmptyParts' | 'InvalidNodeName'; raw: string; message: string; context?: Record<string, unknown>; cause?: CodecError }
  | { kind: 'SplitPathError'; reason: 'InvalidPathParts' | 'InvalidBasename' | 'MissingExtension' | 'CanonicalizationFailed'; message: string; context: Record<string, unknown>; cause?: CodecError }
  | { kind: 'LocatorError'; reason: 'NoParent' | 'InvalidChain' | 'InvalidSegmentId'; message: string; context: Record<string, unknown>; cause?: CodecError }
  | { kind: 'ZodError'; issues: ZodIssue[]; message: string; context?: Record<string, unknown>; cause?: CodecError };
```

**Benefits**:
- Smaller top-level set prevents busy-work and inconsistency
- Detailed `reason` field provides specificity when needed
- Standard `cause?: CodecError` field enables uniform error chaining
- Makes "bubble up with context" easy and consistent
- Pattern matching on `kind` still works for high-level error handling

- Use zod validation errors when parsing structured data (wrapped in `ZodError` variant)
- Preserve original error context when chaining codecs via `cause` field
- Enable pattern matching on `kind` for error handling strategies

### Naming Conventions

**Consistent verb set:**
- `parseX` / `serializeX` - bidirectional conversions (parse = validate/parse, serialize = construct)
- `toCanonicalX` / `fromCanonicalX` - canonical format conversions
- Avoid mixing "make/build/compute" in new API surface

**Scope encoding:**
- Function names encode scope when types don't make it obvious
- `SplitPathInsideLibrary` vs generic split path - use `splitPathInsideLibraryToCanonical` not `splitPathToCanonical`
- `CanonicalSplitPathInsideLibrary` - use `canonicalSplitPathInsideLibraryToLocator` not `canonicalSplitPathToLocator`

**Grouping by concept:**
- Exports grouped by concept (segmentId, locator, splitPath, suffix), not by usage site
- Provide both flat exports and namespace exports for discoverability

### Codec Rules/Configuration

**Keep codecs pure** by injecting rules instead of reaching for user settings internally.

**Rules type** (defined in `codecs/rules.ts`):

```typescript
export type CodecRules = {
  suffixDelimiter: string; // e.g., "-"
  libraryRootName: string; // Library root name (from splitPathToLibraryRoot.basename)
  // Add other naming conventions as needed
};
```

**Note**: `NodeSegmentIdSeparator` remains a constant (imported from `tree-node/types/node-segment-id`), not part of rules.

**Factory pattern** - codecs are created with rules:

```typescript
// codecs/index.ts
export function makeCodecs(rules: CodecRules): {
  segmentId: SegmentIdCodecs;
  locator: LocatorCodecs;
  splitPath: SplitPathCodecs;
  suffix: SuffixCodecs;
} {
  return {
    segmentId: makeSegmentIdCodecs(rules),
    locator: makeLocatorCodecs(rules),
    splitPath: makeSplitPathCodecs(rules),
    suffix: makeSuffixCodecs(rules),
  };
}
```

**Benefits**:
- Codecs remain pure (no hidden coupling to global state)
- Tests are easier (inject test rules)
- Prevents "random orchestrator picked wrong delimiter" bugs
- Rules are explicit in function signatures
- Single source of truth for naming conventions

### Example API Structure

```typescript
// codecs/errors.ts
export type CodecError = /* ... discriminated union with cause field ... */

// codecs/rules.ts
export type CodecRules = {
  suffixDelimiter: string;
  libraryRootName: string; // Required: from splitPathToLibraryRoot.basename
};

// codecs/segment-id/types.ts
export type SegmentIdComponents = {
  coreName: NodeName;
  targetType: TreeNodeType;
  extension?: string; // Required for Scroll/File, absent for Section
}

// codecs/segment-id/index.ts
import type { CodecError } from '../errors';
import type { CodecRules } from '../rules';

export type SegmentIdCodecs = {
  // Parse segment ID to components
  parseSegmentId: (id: TreeNodeSegmentId) => Result<SegmentIdComponents, CodecError>;
  parseSectionSegmentId: (id: SectionNodeSegmentId) => Result<Omit<SegmentIdComponents, 'extension'>, CodecError>;
  parseScrollSegmentId: (id: ScrollNodeSegmentId) => Result<SegmentIdComponents & { extension: 'md' }, CodecError>;
  parseFileSegmentId: (id: FileNodeSegmentId) => Result<SegmentIdComponents & { extension: FileExtension }, CodecError>;
  
  // Serialize components to segment ID
  serializeSegmentId: (components: SegmentIdComponents) => TreeNodeSegmentId;
  
  // TreeNode <-> SegmentId codec pair
  makeNodeSegmentId: (node: TreeNode) => TreeNodeSegmentId; // Exposed API, uses serializeSegmentId internally
  makeTreeNode: (segmentId: TreeNodeSegmentId) => Result<TreeNode, CodecError>; // Parse segment ID to TreeNode
};

export function makeSegmentIdCodecs(rules: CodecRules): SegmentIdCodecs {
  // Implementation uses NodeSegmentIdSeparator constant (not from rules)
  return {
    parseSegmentId: (id) => { /* ... */ },
    parseSectionSegmentId: (id) => { /* ... */ },
    parseScrollSegmentId: (id) => { /* ... */ },
    parseFileSegmentId: (id) => { /* ... */ },
    serializeSegmentId: (components) => { /* ... */ },
    makeNodeSegmentId: (node) => { /* Uses serializeSegmentId internally */ },
    makeTreeNode: (segmentId) => { /* Uses parseSegmentId internally */ },
  };
}

// codecs/locator/index.ts
export type LocatorCodecs = {
  locatorToCanonicalSplitPathInsideLibrary: (loc: TreeNodeLocator) => Result<CanonicalSplitPathInsideLibrary, CodecError>;
  canonicalSplitPathInsideLibraryToLocator: (sp: CanonicalSplitPathInsideLibrary) => Result<TreeNodeLocator, CodecError>;
};

export function makeLocatorCodecs(rules: CodecRules): LocatorCodecs {
  // Implementation uses rules
  return {
    locatorToCanonicalSplitPathInsideLibrary: (loc) => { /* ... */ },
    canonicalSplitPathInsideLibraryToLocator: (sp) => { /* ... */ },
  };
}

// codecs/split-path-inside-library/index.ts
export type SplitPathInsideLibraryCodecs = {
  checkIfInsideLibrary: (sp: SplitPath) => boolean;
  toInsideLibrary: (sp: SplitPath) => Result<SplitPathInsideLibrary, CodecError>; // Chops off LibraryRoot path parts
  fromInsideLibrary: (sp: SplitPathInsideLibrary) => SplitPath; // Adds LibraryRoot path parts back
};

export function makeSplitPathInsideLibraryCodecs(rules: CodecRules): SplitPathInsideLibraryCodecs {
  return {
    checkIfInsideLibrary: (sp) => { /* ... */ },
    toInsideLibrary: (sp) => { /* ... */ },
    fromInsideLibrary: (sp) => { /* ... */ },
  };
}

// codecs/canonical-split-path/index.ts
export type CanonicalSplitPathCodecs = {
  splitPathInsideLibraryToCanonical: (sp: SplitPathInsideLibrary) => Result<CanonicalSplitPathInsideLibrary, CodecError>;
  fromCanonicalSplitPathInsideLibrary: (sp: CanonicalSplitPathInsideLibrary) => SplitPathInsideLibrary; // Lossy: joins separated suffix
};

export function makeCanonicalSplitPathCodecs(rules: CodecRules): CanonicalSplitPathCodecs {
  return {
    splitPathInsideLibraryToCanonical: (sp) => { /* ... */ },
    fromCanonicalSplitPathInsideLibrary: (sp) => { /* ... */ },
  };
}

// codecs/suffix/index.ts
export type SuffixCodecs = {
  parseSeparatedSuffix: (basename: string) => Result<SeparatedSuffixedBasename, CodecError>;
  serializeSeparatedSuffix: (suffix: SeparatedSuffixedBasename) => string;
  splitBySuffixDelimiter: (basename: string) => Result<NonEmptyArray<NodeName>, CodecError>;
  pathPartsWithRootToSuffixParts: (pathParts: string[]) => NodeName[];
  pathPartsToSuffixParts: (pathParts: string[]) => NodeName[];
  suffixPartsToPathParts: (suffixParts: NodeName[]) => string[];
};

export function makeSuffixCodecs(rules: CodecRules): SuffixCodecs {
  // Implementation uses rules.suffixDelimiter
  return {
    parseSeparatedSuffix: (basename) => { /* ... */ },
    serializeSeparatedSuffix: (suffix) => { /* ... */ },
    splitBySuffixDelimiter: (basename) => { /* ... */ },
    pathPartsWithRootToSuffixParts: (pathParts) => { /* ... */ },
    pathPartsToSuffixParts: (pathParts) => { /* ... */ },
    suffixPartsToPathParts: (suffixParts) => { /* ... */ },
  };
}

// codecs/index.ts - Factory
export function makeCodecs(rules: CodecRules) {
  return {
    segmentId: makeSegmentIdCodecs(rules),
    locator: makeLocatorCodecs(rules),
    splitPathInsideLibrary: makeSplitPathInsideLibraryCodecs(rules),
    canonicalSplitPath: makeCanonicalSplitPathCodecs(rules),
    suffix: makeSuffixCodecs(rules),
  };
}

// Usage in orchestrators:
// Librarian receives parsed settings from main.ts and injects them:
// const settings = getParsedUserSettings(); // Called in main.ts, passed to Librarian
// const rules = makeCodecRulesFromSettings(settings);
// const { segmentId, locator, splitPathInsideLibrary, canonicalSplitPath, suffix } = makeCodecs(rules);
// const result = segmentId.parseSegmentId(id);
```

### Segment ID Handling Strategy

**Design decision deferred**: Generic `parseSegmentId<TreeNodeType>` design to be decided separately. Current plan includes type-specific parsers for convenience and type narrowing.

**Rationale**: Segment IDs share the same format structure, only differ in required fields (extension). Unified parser reduces duplication while type-specific parsers provide better type safety.

**TreeNode codec pair**: `makeNodeSegmentId` and `makeTreeNode` form a bidirectional codec pair for TreeNode ↔ SegmentId conversions. `makeNodeSegmentId` is exposed in API and uses `serializeSegmentId` internally. `makeTreeNode` uses `parseSegmentId` internally.

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
  - These should also use codec rules instead of `getParsedUserSettings()` directly
- `codecs/` (new centralized) - core DTO transformations (segment-id, locator, split-path, suffix)
  - **All codecs must be neverthrow-pilled**: All parse functions return `Result<T, CodecError>`, no throwing allowed

## Migration Strategy (Iterative)

**Approach**: Implement codecs incrementally, test integration at each layer, identify gaps, and fill them before proceeding. This ensures the API is complete and usable before full migration.

### Phase 1: Implement Core Codecs

1. **Create `codecs/errors.ts`**
   - Define `CodecError` discriminated union type with smaller top-level set
   - Include `cause?: CodecError` field for error chaining
   - Export error constructors/helpers for consistent error creation
   - Document error handling patterns

2. **Create `codecs/rules.ts`**
   - Define `CodecRules` type: `{ suffixDelimiter, libraryRootName }` (nodeSegmentIdSeparator is constant, not in rules)
   - Document all required naming conventions
   - Export helper to create rules from parsed settings: `makeCodecRulesFromSettings(settings: ParsedUserSettings)`
   - Extract `suffixDelimiter` from `settings.suffixDelimiter`
   - Extract `libraryRootName` from `settings.splitPathToLibraryRoot.basename`

3. **Create `codecs/segment-id/` module**
   - Extract segment ID parsing logic from existing code
   - Define `SegmentIdComponents` type: `{ coreName: NodeName; targetType: TreeNodeType; extension?: string }`
   - Create `makeSegmentIdCodecs(rules: CodecRules)` factory function
   - Factory returns codecs using `NodeSegmentIdSeparator` constant (not from rules)
   - Create unified `parseSegmentId` + type-specific convenience parsers (return `Result<T, CodecError>`)
   - Create `serializeSegmentId` for construction
   - **Expose `makeNodeSegmentId(node: TreeNode)`** in API - uses `serializeSegmentId` internally
   - **Expose `makeTreeNode(segmentId: TreeNodeSegmentId)`** - uses `parseSegmentId` internally, returns `Result<TreeNode, CodecError>`
   - **Replace** existing `tree-node/codecs/node-and-segment-id/make-node-segment-id.ts` and `make-tree-node.ts` with these codecs

4. **Create `codecs/locator/` module**
   - Move existing `locator-codec.ts` functions from `tree-action/utils/locator/`
   - Create `makeLocatorCodecs(rules: CodecRules)` factory function
   - Ensure bidirectional Result-based API (return `Result<T, CodecError>`)
   - **Critical**: Fix `locatorToCanonicalSplitPathInsideLibrary` (renamed to `locatorToCanonicalSplitPathInsideLibrary`) to return `Result<CanonicalSplitPathInsideLibrary, CodecError>` instead of throwing
   - **All functions must be neverthrow-pilled**: No throwing allowed, all errors via Result

5. **Create `codecs/split-path-inside-library/` module**
   - Move scoping codecs from `tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library.ts`
   - Create `makeSplitPathInsideLibraryCodecs(rules: CodecRules)` factory function
   - Functions: `checkIfInsideLibrary`, `toInsideLibrary` (chops LibraryRoot), `fromInsideLibrary` (adds LibraryRoot back)
   - All functions use `rules.libraryRootName` instead of `getParsedUserSettings()`
   - Parse functions return `Result<T, CodecError>`

6. **Create `codecs/canonical-split-path/` module**
   - Move canonical split path codecs from `tree-action/utils/canonical-naming/canonical-split-path-codec.ts`
   - Create `makeCanonicalSplitPathCodecs(rules: CodecRules)` factory function
   - Use consistent naming: `splitPathInsideLibraryToCanonical`, `fromCanonicalSplitPathInsideLibrary` (lossy: joins separated suffix)
   - Parse functions return `Result<T, CodecError>`

7. **Create `codecs/suffix/` module**
   - Move suffix utilities from `tree-action/utils/canonical-naming/suffix-utils/`
   - Create `makeSuffixCodecs(rules: CodecRules)` factory function
   - All functions use `rules.suffixDelimiter` instead of `getParsedUserSettings()`
   - Use consistent naming: `pathPartsToSuffixParts`, `pathPartsWithRootToSuffixParts`, `suffixPartsToPathParts`
   - Include `splitBySuffixDelimiter` and `serializeSeparatedSuffix`
   - Parse functions return `Result<T, CodecError>`

8. **Create main `codecs/index.ts` factory**
   - Export `makeCodecs(rules: CodecRules)` factory function
   - Factory returns `{ segmentId, locator, splitPathInsideLibrary, canonicalSplitPath, suffix }` codec objects
   - Export `CodecError` type and `CodecRules` type
   - Export `makeCodecRulesFromSettings` helper

### Phase 2: Integration Testing - tree-node Layer

**Goal**: Try to use codecs in `src/commanders/librarian-new/healer/library-tree/tree-node/`

**Process**:
- Identify all codec usage points in tree-node layer
- Create codec instance: `const rules = makeCodecRulesFromSettings(parsedSettings); const { segmentId, ... } = makeCodecs(rules);`
  - Note: `parsedSettings` comes from main.ts, passed to Librarian, then to codecs
- Attempt to replace existing parsing/construction logic with codec API
- **Replace** `tree-node/codecs/node-and-segment-id/` codecs with new centralized codecs
- **Document missing methods** - functions needed but not yet implemented
- **Raise problems** - API design issues, type mismatches, error handling gaps
- **Add missing methods** to appropriate codec modules
- **Iterate** until tree-node layer can fully use codec API

**Expected findings**:
- May need additional segment ID utilities
- May need node construction helpers (covered by `makeTreeNode`)
- May need type-specific convenience functions
- Verify rules injection works correctly (no hidden `getParsedUserSettings()` calls in codecs/)
- Verify `tree-node/codecs/` can be fully replaced

### Phase 3: Integration Testing - bulk-vault-action-adapter Layer

**Goal**: Try to use codecs in `src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/`

**Process**:
- Identify all codec usage points in adapter layer
- Create codec instance with rules from parsed settings (injected from Librarian)
- Attempt to replace imports from `utils/` with `codecs/` factory
- **Update `library-scope/codecs/`** to use codec rules instead of `getParsedUserSettings()` directly
- **Document missing methods** - functions needed for adapter layer
- **Raise problems** - scoping issues, conversion gaps, error handling needs
- **Add missing methods** to appropriate codec modules
- **Iterate** until adapter layer can fully use codec API

**Expected findings**:
- May need additional locator utilities
- May need split path conversion helpers
- May need suffix manipulation functions
- Integration with existing `library-scope/codecs/` may reveal gaps
- Verify no orchestrator uses wrong delimiter (rules ensure consistency)

**Key files to test**:
- `translate-material-event/translators/helpers/locator.ts`
- `translate-material-event/translate-material-events.ts`
- `translate-material-event/policy-and-intent/intent/infer-intent.ts`

### Phase 4: Integration Testing - tree Layer

**Goal**: Try to use codecs in `src/commanders/librarian-new/healer/library-tree/tree.ts`

**Process**:
- Replace `extractNodeNameFromSegmentId` with segment ID codec
- Replace `getNodeName` call with codec API (returns `Result<T, CodecError>`)
- **Document missing methods** - tree-specific needs
- **Raise problems** - error handling patterns, type conversions
- **Add missing methods** if needed
- **Iterate** until tree layer works with codec API
- Codec instance created in Librarian and passed down (or accessed via dependency injection)

**Expected findings**:
- May need error handling utilities
- May need batch parsing functions

### Phase 5: Integration Testing - librarian Layer

**Goal**: Try to use codecs in `src/commanders/librarian-new/librarian.ts`

**Process**:
- **Update Librarian constructor** to accept `ParsedUserSettings` (or create codec instance in `init()`)
- Replace `extractNodeNameFromScrollSegmentId` with segment ID codec
- Replace `computeScrollSplitPath` with codec API
- Replace manual segment ID construction (line 383) with `segmentId.makeNodeSegmentId(node)` or `segmentId.serializeSegmentId(components)`
- **Document missing methods** - librarian-specific needs
- **Raise problems** - API ergonomics, error handling
- **Add missing methods** if needed
- **Iterate** until librarian works with codec API

**Expected findings**:
- May need convenience wrappers for common patterns
- May need error recovery strategies

### Phase 6: Final Migration

Once all layers are tested and codec API is complete:

1. **Remove old implementations**
   - Delete duplicated parsing functions from orchestrators
   - Remove `buildCanonicalLeafSplitPath`, `buildObservedLeafSplitPath`, etc. from `healer.ts`
   - Remove `extractNodeNameFromSegmentId` variants from all files
   - Remove `getNodeName` and `getParentLocator` from `locator-utils.ts` (or replace with codec wrappers)
   - **Replace/remove** `tree-node/codecs/node-and-segment-id/make-node-segment-id.ts` and `make-tree-node.ts` (replaced by centralized codecs)

2. **Update all call sites**
   - Replace all old function calls with codec API
   - Add appropriate error handling for `Result<T, CodecError>` returns
   - Use pattern matching on `CodecError.kind` where appropriate

3. **Clean up**
   - Remove unused imports
   - Update tests to use codec API
   - Document any remaining edge cases

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
   - Library root handling now explicit via separate functions (`pathPartsToSuffixParts` vs `pathPartsWithRootToSuffixParts`)
   - Call sites must use appropriate function based on whether pathParts includes library root
   - Consistent naming: `pathPartsToSuffixParts`, `pathPartsWithRootToSuffixParts`, `suffixPartsToPathParts`

## Todos

### Phase 1: Core Codecs Implementation
- [ ] Create `codecs/errors.ts` with `CodecError` discriminated union type
  - [ ] Use smaller top-level set: `SegmentIdError | SuffixError | SplitPathError | LocatorError | ZodError`
  - [ ] Include detailed `reason` field inside each variant
  - [ ] Add standard `cause?: CodecError` field for error chaining
  - [ ] Export error constructors/helpers for consistent error creation
- [ ] Create `codecs/rules.ts` with `CodecRules` type
  - [ ] Define rules: `{ suffixDelimiter, libraryRootName }` (nodeSegmentIdSeparator is constant, not in rules)
  - [ ] Export helper: `makeCodecRulesFromSettings(settings: ParsedUserSettings)` for orchestrators
  - [ ] Extract `libraryRootName` from `settings.splitPathToLibraryRoot.basename`
- [ ] Create `codecs/segment-id/` module with factory pattern
  - [ ] Define `SegmentIdComponents` type
  - [ ] Create `makeSegmentIdCodecs(rules: CodecRules)` factory
  - [ ] Factory returns codecs using `NodeSegmentIdSeparator` constant (not from rules)
  - [ ] Implement unified `parseSegmentId` + type-specific parsers (return `Result<T, CodecError>`)
  - [ ] Implement `serializeSegmentId`
  - [ ] Expose `makeNodeSegmentId(node: TreeNode)` - uses `serializeSegmentId` internally
  - [ ] Expose `makeTreeNode(segmentId: TreeNodeSegmentId)` - uses `parseSegmentId` internally
  - [ ] Replace `tree-node/codecs/node-and-segment-id/` codecs with these
- [ ] Move locator-codec.ts to codecs/locator/ with factory pattern
  - [ ] Create `makeLocatorCodecs(rules: CodecRules)` factory
  - [ ] Ensure all parse functions return `Result<T, CodecError>`
  - [ ] **Fix**: `locatorToCanonicalSplitPathInsideLibrary` to return `Result<CanonicalSplitPathInsideLibrary, CodecError>` (currently throws)
  - [ ] Ensure all functions are neverthrow-pilled (no throwing)
- [ ] Create `codecs/split-path-inside-library/` module with factory pattern
  - [ ] Create `makeSplitPathInsideLibraryCodecs(rules: CodecRules)` factory
  - [ ] Implement `checkIfInsideLibrary`, `toInsideLibrary`, `fromInsideLibrary`
  - [ ] Use `rules.libraryRootName` instead of `getParsedUserSettings()`
  - [ ] Parse functions return `Result<T, CodecError>`
- [ ] Create `codecs/canonical-split-path/` module with factory pattern
  - [ ] Create `makeCanonicalSplitPathCodecs(rules: CodecRules)` factory
  - [ ] Use `fromCanonicalSplitPathInsideLibrary` name (consistent with toCanonical pattern) - document that it's lossy
  - [ ] Use `splitPathInsideLibraryToCanonical` for parse direction
  - [ ] Parse functions return `Result<T, CodecError>`
- [ ] Move suffix utilities to codecs/suffix/ with factory pattern
  - [ ] Create `makeSuffixCodecs(rules: CodecRules)` factory
  - [ ] Use consistent naming: `pathPartsToSuffixParts`, `pathPartsWithRootToSuffixParts`, `suffixPartsToPathParts`
  - [ ] Include `splitBySuffixDelimiter` and `serializeSeparatedSuffix`
  - [ ] All functions use `rules.suffixDelimiter` instead of `getParsedUserSettings()`
  - [ ] Ensure all parse functions return `Result<T, CodecError>` (neverthrow-pilled)
  - [ ] Document library root handling requirements
  - [ ] Parse functions return `Result<T, CodecError>`
- [ ] Create codecs/index.ts factory
  - [ ] Export `makeCodecs(rules: CodecRules)` factory function
  - [ ] Export `CodecError` type and `CodecRules` type
  - [ ] Export `makeCodecRulesFromSettings` helper

### Phase 2: Integration Testing - tree-node Layer
- [ ] Identify codec usage points in `tree-node/` layer
- [ ] Attempt to replace existing logic with codec API
- [ ] **Document missing methods** - functions needed but not implemented
- [ ] **Raise problems** - API design issues, type mismatches, error handling gaps
- [ ] Add missing methods to appropriate codec modules
- [ ] Iterate until tree-node layer can fully use codec API

### Phase 3: Integration Testing - bulk-vault-action-adapter Layer
- [ ] Identify codec usage points in `bulk-vault-action-adapter/` layer
- [ ] Attempt to replace imports from `utils/` with `codecs/`
- [ ] **Document missing methods** - adapter-specific needs
- [ ] **Raise problems** - scoping issues, conversion gaps, error handling needs
- [ ] Add missing methods to appropriate codec modules
- [ ] Test integration with existing `library-scope/codecs/`
- [ ] Iterate until adapter layer can fully use codec API

### Phase 4: Integration Testing - tree Layer
- [ ] Replace `extractNodeNameFromSegmentId` with segment ID codec in `tree.ts`
- [ ] Replace `getNodeName` call with codec API
- [ ] **Document missing methods** - tree-specific needs
- [ ] **Raise problems** - error handling patterns, type conversions
- [ ] Add missing methods if needed
- [ ] Iterate until tree layer works with codec API

### Phase 5: Integration Testing - librarian Layer
- [ ] Update Librarian to receive parsed settings and create codec instance
- [ ] Replace `extractNodeNameFromScrollSegmentId` with segment ID codec in `librarian.ts`
- [ ] Replace `computeScrollSplitPath` with codec API
- [ ] Replace manual segment ID construction (line 383) with `segmentId.makeNodeSegmentId(node)` or `segmentId.serializeSegmentId(components)`
- [ ] **Document missing methods** - librarian-specific needs
- [ ] **Raise problems** - API ergonomics, error handling
- [ ] Add missing methods if needed
- [ ] Iterate until librarian works with codec API

### Phase 6: Final Migration
- [ ] Remove old implementations from orchestrators
  - [ ] Delete duplicated parsing functions
  - [ ] Remove `buildCanonicalLeafSplitPath`, `buildObservedLeafSplitPath`, etc. from `healer.ts`
  - [ ] Remove `extractNodeNameFromSegmentId` variants from all files
  - [ ] Remove or replace `getNodeName` and `getParentLocator` from `locator-utils.ts`
  - [ ] Replace/remove `tree-node/codecs/node-and-segment-id/make-node-segment-id.ts` and `make-tree-node.ts`
- [ ] Update all call sites with appropriate error handling
- [ ] Clean up unused imports
- [ ] Add unit tests for all codec modules
  - [ ] Test error cases return appropriate `CodecError` variants
  - [ ] Test error context preservation
  - [ ] Test pattern matching on error kinds
- [ ] Update integration tests to verify orchestrators work with new API