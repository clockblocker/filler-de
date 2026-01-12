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

   - `healer.ts`: `extractNodeNameFromSegmentId`, `extractNodeNameFromLeafSegmentId`, `extractExtensionFromSegmentId` ✅ **RESOLVED** (Phase 4)
   - `tree.ts`: `extractNodeNameFromSegmentId` ✅ **RESOLVED** (Phase 4)
   - `codex-split-path.ts`: `extractNodeNameFromSegmentId` ✅ **RESOLVED** (Codex Migration)
   - `codex-impact-to-actions.ts`: `extractNodeNameFromSegmentId` ✅ **RESOLVED** (Codex Migration)
   - `generate-codex-content.ts`: `extractNodeNameFromSegmentId` ✅ **RESOLVED** (Codex Migration)
   - `locator-codec.ts`: `nodeNameFromSectionSegmentId`, `parseSegmentIdTrusted` ✅ **RESOLVED** (Phase 1 - moved to codecs/locator/)
   - `locator-utils.ts`: `getNodeName` (throws instead of returning Result) ⏳ **PENDING** (Phase 7 cleanup)
   - `librarian.ts`: `extractNodeNameFromScrollSegmentId` ✅ **RESOLVED** (Phase 5+6 - now uses `codecs.segmentId.parseScrollSegmentId`)

2. **Split path building logic** duplicated in orchestrators:

   - `healer.ts`: `buildCanonicalLeafSplitPath`, `buildObservedLeafSplitPath` ✅ **RESOLVED** (Phase 5+6 - now uses codec API)
   - `librarian.ts`: `computeScrollSplitPath` ✅ **RESOLVED** (Phase 5+6 - now uses `locatorToCanonicalSplitPathInsideLibrary` → `fromCanonicalSplitPathInsideLibrary`)
   - `codex-impact-to-actions.ts`: `computeScrollSplitPath` ✅ **RESOLVED** (Codex Migration - now uses codec API)

3. **Suffix utilities** used directly instead of through codec API

4. **Manual segment ID construction** in `librarian.ts` (line 410):
   - String concatenation: `` `${target.nodeName}${NodeSegmentIdSeparator}${TreeNodeKind.Scroll}${NodeSegmentIdSeparator}md` `` ✅ **RESOLVED** (Codex Migration - now uses `serializeSegmentIdUnchecked`)

5. **Locator utilities that throw** instead of returning Result:
   - `locator-utils.ts`: `getNodeName` (line 12) - throws on invalid NodeName
   - `locator-utils.ts`: `getParentLocator` (line 26) - throws when no parent exists
   - Should be replaced with Result-based codec API

## Proposed File Structure

```
library-tree/
  codecs/
    errors.ts           # CodecError discriminated union type
    rules.ts            # CodecRules type + makeCodecRulesFromSettings helper
    types/
      type-mappings.ts  # Type-level mappings: CorrespondingSplitPathKind, NodeLocatorOf, SegmentIdComponents<T>, etc.

    # PUBLIC MODULES (exposed to orchestrators)
    
    segment-id/         # Low level - no codec dependencies
      types.ts          # SegmentIdComponents, public types
      make.ts           # makeSegmentIdCodecs(rules: CodecRules)
      internal/
        parse.ts        # segment ID -> { nodeName, type, extension }
        serialize.ts    # { nodeName, type, extension } -> segment ID (validated + unchecked)
      index.ts          # Re-exports public API
    
    split-path-inside-library/  # Low-mid level - minimal dependencies
      types.ts          # SplitPathInsideLibraryCandidate, public types
      make.ts           # makeSplitPathInsideLibraryCodecs(rules: CodecRules)
      internal/
        predicate.ts    # check-if-inside-library.ts: split path -> bool (quick predicate)
                        # is-inside-library.ts: split path -> type guard
        to.ts           # to-inside-library.ts: split path -> split path inside library (Result, canonical API)
        from.ts         # from-inside-library.ts: split path inside library -> split path (adds LibraryRoot back)
      index.ts          # Re-exports public API
    
    canonical-split-path/  # Mid level - depends on suffix
      types.ts          # CanonicalSplitPathInsideLibrary, public types
      make.ts           # makeCanonicalSplitPathCodecs(rules: CodecRules, suffix: SuffixCodecs)
      internal/
        to.ts           # to-canonical.ts: split path inside library -> canonical (with validation and suffix separated)
        from.ts        # from-canonical.ts: canonical -> split path inside library (lossy: joins separated suffix)
      index.ts          # Re-exports public API
    
    locator/            # Highest level - depends on segment-id, canonical-split-path, suffix
      types.ts          # LocatorCodecs type, public types
      make.ts           # makeLocatorCodecs(rules, segmentId, canonicalSplitPath, suffix)
      internal/
        to.ts           # to-canonical-split-path.ts: locator -> canonical split path (Result)
        from.ts         # from-canonical-split-path.ts: canonical split path -> locator (Result)
      index.ts          # Re-exports public API
    
    # PRIVATE AREA (implementation details, not exposed to orchestrators)
    
    internal/           # PRIVATE - no public exports from this directory
      suffix/           # Lowest level - no codec dependencies
        types.ts        # SeparatedSuffixedBasename, internal types
        parse.ts        # basename -> separated suffix
        serialize.ts    # separated suffix -> basename (validated + unchecked)
        path-parts.ts   # path parts <-> suffix parts conversions
        split.ts        # splitBySuffixDelimiter
        zod.ts          # Zod schemas if needed
        errors.ts       # Suffix-specific errors if needed
        index.ts        # makeSuffixCodecs(rules: CodecRules) - only used internally
    
    index.ts            # Thin factory layer - creates codecs in dependency order, injects dependencies
                        # Only file that imports all modules (prevents circular imports)
                        # Returns public codec objects: { segmentId, splitPathInsideLibrary, canonicalSplitPath, locator }
                        # Does NOT export internal/suffix (private implementation detail)
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

### Dependency Hierarchy (Critical for Avoiding Circular Dependencies)

**Rule**: Each module imports "downwards" only (lower-level modules never import higher-level ones).

**Dependency order** (lowest to highest):

1. **`internal/suffix/`** (lowest level, PRIVATE)
   - No dependencies on other codec modules
   - Only depends on: `errors.ts`, `rules.ts`, external types (NodeName, etc.)
   - **Not exposed to orchestrators** - implementation detail only

2. **`segment-id/`** (low level, PUBLIC)
   - No dependencies on other codec modules
   - Only depends on: `errors.ts`, `rules.ts`, `types/type-mappings.ts`, external types (NodeName, TreeNodeKind, etc.)

3. **`split-path-inside-library/`** (low-mid level, PUBLIC)
   - Minimal dependencies: only uses `rules.ts`
   - Depends on: `errors.ts`, `rules.ts`

4. **`canonical-split-path/`** (mid level, PUBLIC)
   - Depends on: `errors.ts`, `rules.ts`, `internal/suffix/`
   - Uses internal suffix codecs for separated suffix handling

5. **`locator/`** (highest level, PUBLIC)
   - Depends on: `errors.ts`, `rules.ts`, `segment-id/`, `canonical-split-path/`, `internal/suffix/`
   - Combines canonical split path + segment ID + internal suffix codecs

**`codecs/index.ts`** (factory layer):
- **THE ONLY WIRING POINT** - thin factory layer only
- No business logic
- Imports all modules (public + internal) and creates factory function
- Creates codecs in dependency order, injects dependencies
- **Returns only public codec objects**: `{ segmentId, splitPathInsideLibrary, canonicalSplitPath, locator }`
- **Does NOT export `internal/suffix`** - private implementation detail
- Re-exports public types for convenience

**Enforcement**:
- Each module's `index.ts` should only import from lower-level modules (or same level if needed)
- Never import from higher-level modules
- `codecs/index.ts` is the only place that imports all modules (public + internal)
- Public modules should NOT import from `internal/` directly - dependencies injected via factory
- If a module needs functionality from a higher-level module, refactor to move shared logic to a lower level
- **Orchestrators should only import from `codecs/index.ts`** - never from individual module `index.ts` files

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
// Import from type-mappings.ts
import type { SegmentIdComponents } from '../types/type-mappings';

// codecs/segment-id/index.ts
import type { CodecError } from '../errors';
import type { CodecRules } from '../rules';

export type SegmentIdCodecs = {
  // Generic parser (primary API)
  parseSegmentId: <NK extends TreeNodeKind>(id: TreeNodeSegmentId) => Result<SegmentIdComponents<NK>, CodecError>;
  
  // Type-specific convenience parsers (better type inference)
  parseSectionSegmentId: (id: SectionNodeSegmentId) => Result<SegmentIdComponents<TreeNodeKind.Section>, CodecError>;
  parseScrollSegmentId: (id: ScrollNodeSegmentId) => Result<SegmentIdComponents<TreeNodeKind.Scroll>, CodecError>;
  parseFileSegmentId: (id: FileNodeSegmentId) => Result<SegmentIdComponents<TreeNodeKind.File>, CodecError>;
  
  // Serialize (validated inputs)
  serializeSegmentId: <NK extends TreeNodeKind>(components: SegmentIdComponents<NK>) => TreeNodeSegmentId;
  
  // Serialize (unchecked inputs)
  serializeSegmentIdUnchecked: (components: { coreName: string; targetKind: TreeNodeKind; extension?: string }) => Result<TreeNodeSegmentId, CodecError>;
};

export function makeSegmentIdCodecs(rules: CodecRules): SegmentIdCodecs {
  // Implementation uses NodeSegmentIdSeparator constant (not from rules)
  return {
    parseSegmentId: (id) => { /* ... */ },
    parseSectionSegmentId: (id) => { /* ... */ },
    parseScrollSegmentId: (id) => { /* ... */ },
    parseFileSegmentId: (id) => { /* ... */ },
    serializeSegmentId: (components) => { /* Assumes validated inputs */ },
    serializeSegmentIdUnchecked: (components) => { /* Validates inputs, returns Result */ },
  };
}

// codecs/locator/index.ts
import type { NodeLocatorOf, CanonicalSplitPathInsideLibraryOf, CorrespondingSplitPathKind, CorrespondingTreeNodeKind } from '../types/type-mappings';

export type LocatorCodecs = {
  // Overloads for type-safe conversions
  locatorToCanonicalSplitPathInsideLibrary: <NK extends TreeNodeKind>(
    loc: NodeLocatorOf<NK>
  ) => Result<CanonicalSplitPathInsideLibraryOf<CorrespondingSplitPathKind<NK>>, CodecError>;
  
  canonicalSplitPathInsideLibraryToLocator: <SK extends SplitPathKind>(
    sp: CanonicalSplitPathInsideLibraryOf<SK>
  ) => Result<NodeLocatorOf<CorrespondingTreeNodeKind<SK>>, CodecError>;
};

export function makeLocatorCodecs(
  rules: CodecRules,
  segmentId: SegmentIdCodecs, // Inject segment-id codecs (dependency)
  canonicalSplitPath: CanonicalSplitPathCodecs, // Inject canonical-split-path codecs (dependency)
  suffix: SuffixCodecs, // Inject suffix codecs (dependency)
): LocatorCodecs {
  // Implementation uses injected codecs
  return {
    locatorToCanonicalSplitPathInsideLibrary: (loc) => { /* Uses segmentId, canonicalSplitPath, suffix */ },
    canonicalSplitPathInsideLibraryToLocator: (sp) => { /* Uses segmentId, canonicalSplitPath, suffix */ },
  };
}

// codecs/split-path-inside-library/index.ts
export type SplitPathInsideLibraryCandidate = SplitPath & { /* type marker */ };

export type SplitPathInsideLibraryCodecs = {
  // Quick predicate (for early returns)
  checkIfInsideLibrary: (sp: SplitPath) => boolean;
  // Type guard for narrowing
  isInsideLibrary: (sp: SplitPath) => sp is SplitPathInsideLibraryCandidate;
  // Canonical API: returns proper CodecError with reason
  toInsideLibrary: (sp: SplitPath) => Result<SplitPathInsideLibrary, CodecError>; // Chops off LibraryRoot path parts
  fromInsideLibrary: (sp: SplitPathInsideLibrary) => SplitPath; // Adds LibraryRoot path parts back
};

export function makeSplitPathInsideLibraryCodecs(rules: CodecRules): SplitPathInsideLibraryCodecs {
  return {
    checkIfInsideLibrary: (sp) => { /* Quick boolean check */ },
    isInsideLibrary: (sp): sp is SplitPathInsideLibraryCandidate => { /* Type guard */ },
    toInsideLibrary: (sp) => { /* Returns CodecError with reason if not inside library */ },
    fromInsideLibrary: (sp) => { /* Adds LibraryRoot path parts back */ },
  };
}

// codecs/canonical-split-path/index.ts
export type CanonicalSplitPathCodecs = {
  splitPathInsideLibraryToCanonical: (sp: SplitPathInsideLibrary) => Result<CanonicalSplitPathInsideLibrary, CodecError>;
  fromCanonicalSplitPathInsideLibrary: (sp: CanonicalSplitPathInsideLibrary) => SplitPathInsideLibrary; // Lossy: joins separated suffix
};

export function makeCanonicalSplitPathCodecs(
  rules: CodecRules,
  suffix: SuffixCodecs, // Inject suffix codecs (dependency)
): CanonicalSplitPathCodecs {
  return {
    splitPathInsideLibraryToCanonical: (sp) => { /* Uses suffix codecs */ },
    fromCanonicalSplitPathInsideLibrary: (sp) => { /* Uses suffix codecs */ },
  };
}

// codecs/suffix/index.ts
export type SuffixCodecs = {
  parseSeparatedSuffix: (basename: string) => Result<SeparatedSuffixedBasename, CodecError>;
  // Validated: assumes NodeName[] are validated
  serializeSeparatedSuffix: (suffix: SeparatedSuffixedBasename) => string;
  // Unchecked: validates NodeName[] and returns Result
  serializeSeparatedSuffixUnchecked: (suffix: { coreName: string; suffixParts: string[] }) => Result<string, CodecError>;
  splitBySuffixDelimiter: (basename: string) => Result<NonEmptyArray<NodeName>, CodecError>;
  pathPartsWithRootToSuffixParts: (pathParts: string[]) => NodeName[];
  pathPartsToSuffixParts: (pathParts: string[]) => NodeName[];
  suffixPartsToPathParts: (suffixParts: NodeName[]) => string[];
};

export function makeSuffixCodecs(rules: CodecRules): SuffixCodecs {
  // Implementation uses rules.suffixDelimiter
  return {
    parseSeparatedSuffix: (basename) => { /* ... */ },
    serializeSeparatedSuffix: (suffix) => { /* Assumes validated NodeName[] */ },
    serializeSeparatedSuffixUnchecked: (suffix) => { /* Validates inputs, returns Result */ },
    splitBySuffixDelimiter: (basename) => { /* ... */ },
    pathPartsWithRootToSuffixParts: (pathParts) => { /* ... */ },
    pathPartsToSuffixParts: (pathParts) => { /* ... */ },
    suffixPartsToPathParts: (suffixParts) => { /* ... */ },
  };
}

// codecs/index.ts - THE ONLY WIRING POINT (thin layer, no business logic)
import { makeSegmentIdCodecs } from './segment-id';
import { makeSuffixCodecs } from './internal/suffix'; // Internal - not exported
import { makeSplitPathInsideLibraryCodecs } from './split-path-inside-library';
import { makeCanonicalSplitPathCodecs } from './canonical-split-path';
import { makeLocatorCodecs } from './locator';

export function makeCodecs(rules: CodecRules) {
  // Create in dependency order (lowest to highest)
  const suffix = makeSuffixCodecs(rules); // Internal - only used for injection
  const segmentId = makeSegmentIdCodecs(rules);
  const splitPathInsideLibrary = makeSplitPathInsideLibraryCodecs(rules);
  const canonicalSplitPath = makeCanonicalSplitPathCodecs(rules, suffix);
  const locator = makeLocatorCodecs(rules, segmentId, canonicalSplitPath, suffix);
  
  // Return only public codec objects (suffix is internal, not exposed)
  return {
    segmentId,
    splitPathInsideLibrary,
    canonicalSplitPath,
    locator,
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

**Generic design**: Use generic `parseSegmentId<T extends TreeNodeKind>` as primary API (from `plan-generic-prerequesits.md`). Type-specific parsers (`parseSectionSegmentId`, `parseScrollSegmentId`, `parseFileSegmentId`) provide convenience and better type inference at call sites. Both use `SegmentIdComponents<T>` generic type from `codecs/types/type-mappings.ts`.

**Rationale**: Segment IDs share the same format structure, only differ in required fields (extension). Unified parser reduces duplication while type-specific parsers provide better type safety.

**Layering**: `codecs/segment-id/` stays strictly SegmentId ↔ Components. TreeNode ↔ SegmentId conversions live in `tree-node/codecs/node-and-segment-id/` as a thin adapter that uses `segmentId.parseSegmentId` and `segmentId.serializeSegmentId` internally. This avoids circular dependencies and keeps codecs/ decoupled from domain models.

**Serialize safety**: `serializeSegmentId` assumes validated inputs (NodeName, FileExtension are zod-validated types). For unchecked inputs, use `serializeSegmentIdUnchecked` which validates and returns `Result<TreeNodeSegmentId, CodecError>`. This prevents silent failures from invalid inputs.

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

### Phase 1: Implement Core Codecs ✅ COMPLETED

**Status**: All core codec modules implemented and wired together. Ready for Phase 2 integration testing.

**Implementation Notes**:
- All modules follow factory pattern with dependency injection
- All parse functions return `Result<T, CodecError>` (neverthrow-pilled)
- No circular dependencies - strict dependency hierarchy enforced
- Suffix module is private (`internal/suffix/`) and not exported from main index
- Error handling uses structured `CodecError` discriminated union with `cause` chaining
- Type safety: Generic functions with type-specific overloads for better inference

1. **Create `codecs/errors.ts`**
   - Define `CodecError` discriminated union type with smaller top-level set
   - Include `cause?: CodecError` field for error chaining
   - Export error constructors/helpers for consistent error creation
   - Document error handling patterns

2. **Create `codecs/rules.ts`**
   - Define `CodecRules` kind: `{ suffixDelimiter, libraryRootName }` (nodeSegmentIdSeparator is constant, not in rules)
   - Document all required naming conventions
   - Export helper to create rules from parsed settings: `makeCodecRulesFromSettings(settings: ParsedUserSettings)`
   - Extract `suffixDelimiter` from `settings.suffixDelimiter`
   - Extract `libraryRootName` from `settings.splitPathToLibraryRoot.basename`

3. **Create `codecs/segment-id/` module**
   - Extract segment ID parsing logic from existing code
   - Import `SegmentIdComponents<T extends TreeNodeKind>` from `codecs/types/type-mappings.ts`
   - Create `makeSegmentIdCodecs(rules: CodecRules)` factory function
   - Factory returns codecs using `NodeSegmentIdSeparator` constant (not from rules)
   - Implement generic `parseSegmentId<T extends TreeNodeKind>` + type-specific convenience parsers (return `Result<SegmentIdComponents<T>, CodecError>`)
   - Implement generic `serializeSegmentId<T extends TreeNodeKind>` for validated inputs (assumes NodeName, FileExtension are validated)
   - Create `serializeSegmentIdUnchecked` for raw inputs (validates and returns `Result<TreeNodeSegmentId, CodecError>`)
   - **Do NOT include TreeNode conversions** - keep codecs/ decoupled from domain models
   - **Note**: TreeNode ↔ SegmentId conversions will live in `tree-node/codecs/node-and-segment-id/` as adapter

4. **Create `codecs/locator/` module**
   - Move existing `locator-codec.ts` functions from `tree-action/utils/locator/`
   - Import generic types from `codecs/types/type-mappings.ts`: `NodeLocatorOf<NK>`, `CanonicalSplitPathInsideLibraryOf<SK>`, `CorrespondingSplitPathKind<T>`, `CorrespondingTreeNodeKind<T>`
   - Create `makeLocatorCodecs(rules: CodecRules, segmentId: SegmentIdCodecs, canonicalSplitPath: CanonicalSplitPathCodecs, suffix: SuffixCodecs)` factory function
   - **Dependencies**: Injects `segmentId`, `canonicalSplitPath`, and `suffix` codecs (depends on all lower-level modules)
   - Use overloads pattern for `locatorToCanonicalSplitPathInsideLibrary` and `canonicalSplitPathInsideLibraryToLocator` (better type inference)
   - Ensure bidirectional Result-based API (return `Result<T, CodecError>`)
   - **Critical**: Fix `locatorToCanonicalSplitPathInsideLibrary` (renamed to `locatorToCanonicalSplitPathInsideLibrary`) to return `Result<CanonicalSplitPathInsideLibrary, CodecError>` instead of throwing
   - **All functions must be neverthrow-pilled**: No throwing allowed, all errors via Result
   - **Import rule**: Only imports from `segment-id/`, `canonical-split-path/`, `suffix/`, `types/type-mappings.ts`, `errors.ts`, `rules.ts` (never from higher-level modules)

5. **Create `codecs/split-path-inside-library/` module**
   - Move scoping codecs from `tree-action/bulk-vault-action-adapter/layers/library-scope/codecs/split-path-inside-the-library.ts`
   - Create `makeSplitPathInsideLibraryCodecs(rules: CodecRules)` factory function
   - **Dependencies**: Minimal - only uses `rules.libraryRootName` (no other codec modules needed)
   - Functions:
     - `checkIfInsideLibrary(sp): boolean` - quick predicate
     - `isInsideLibrary(sp): sp is SplitPathInsideLibraryCandidate` - type guard for narrowing
     - `toInsideLibrary(sp): Result<SplitPathInsideLibrary, CodecError>` - canonical API with proper errors
     - `fromInsideLibrary(sp): SplitPath` - adds LibraryRoot path parts back
   - All functions use `rules.libraryRootName` instead of `getParsedUserSettings()`
   - `toInsideLibrary` returns structured `CodecError` with reason (prevents orchestrators from inventing their own errors)
   - **Import rule**: Only imports from `errors.ts`, `rules.ts` (never from other codec modules)

6. **Create `codecs/canonical-split-path/` module**
   - Move canonical split path codecs from `tree-action/utils/canonical-naming/canonical-split-path-codec.ts`
   - Create `makeCanonicalSplitPathCodecs(rules: CodecRules, suffix: SuffixCodecs)` factory function
   - **Dependency**: Injects `suffix` codecs (depends on suffix module)
   - Use consistent naming: `splitPathInsideLibraryToCanonical`, `fromCanonicalSplitPathInsideLibrary` (lossy: joins separated suffix)
   - Parse functions return `Result<T, CodecError>`
   - **Import rule**: Only imports from `suffix/`, `errors.ts`, `rules.ts` (never from higher-level modules)

7. **Create `codecs/suffix/` module**
   - Move suffix utilities from `tree-action/utils/canonical-naming/suffix-utils/`
   - Create `makeSuffixCodecs(rules: CodecRules)` factory function
   - All functions use `rules.suffixDelimiter` instead of `getParsedUserSettings()`
   - Use consistent naming: `pathPartsToSuffixParts`, `pathPartsWithRootToSuffixParts`, `suffixPartsToPathParts`
   - Include `splitBySuffixDelimiter` and `serializeSeparatedSuffix` (validated) + `serializeSeparatedSuffixUnchecked` (validates inputs)
   - Parse functions return `Result<T, CodecError>`
   - Serialize functions: validated version assumes NodeName[] are validated, unchecked version validates and returns Result

8. **Create main `codecs/index.ts` factory**
   - **Thin factory/re-export layer only** - no business logic
   - Import all codec modules
   - Export `makeCodecs(rules: CodecRules)` factory function
   - Factory creates codecs in dependency order (lowest to highest):
     1. `suffix` (no dependencies)
     2. `segmentId` (no dependencies)
     3. `splitPathInsideLibrary` (may use suffix)
     4. `canonicalSplitPath` (depends on suffix)
     5. `locator` (depends on segmentId, canonicalSplitPath, suffix)
   - Factory returns `{ segmentId, splitPathInsideLibrary, canonicalSplitPath, suffix, locator }` codec objects
   - Re-export `CodecError` type and `CodecRules` type for convenience
   - Re-export `makeCodecRulesFromSettings` helper
   - **No circular imports**: This is the only file that imports all modules

### Phase 2: Create TreeNode Adapter in tree-node Layer ✅ COMPLETED

**Status**: ✅ COMPLETED - Adapter created and ready for integration testing

**Goal**: Create thin adapter in `tree-node/codecs/node-and-segment-id/` that uses centralized codecs

**Implementation Notes**:
- ✅ Created `tree-node-segment-id-codec.ts` with factory pattern `makeTreeNodeCodecs(segmentId: SegmentIdCodecs)`
- ✅ Adapter functions implemented:
  - `makeNodeSegmentId(node: TreeNode): TreeNodeSegmentId` - uses `segmentId.serializeSegmentId` internally with proper type narrowing
  - `makeTreeNode(segmentId: TreeNodeSegmentId): Result<TreeNode, CodecError>` - uses `segmentId.parseSegmentId` internally, returns Result (neverthrow-pilled)
- ✅ Updated `try-parse-tree-node.ts` to use adapter and return `Result<TreeNode, CodecError>` instead of `Result<TreeNode, string>`
- ✅ Created `index.ts` that exports adapter API and maintains backward compatibility (re-exports old functions)
- ✅ **Old functions kept for compatibility**: `make-node-segment-id.ts` and `optimistic-makers/make-tree-node.ts` still exported during migration

**Architecture**:
- Adapter uses centralized codecs (no circular dependencies - codecs/ doesn't import TreeNode)
- Factory pattern enables dependency injection from Librarian/Healer
- Type-safe with proper narrowing (switch statements for type safety)
- All functions return `Result<T, CodecError>` (neverthrow-pilled)

**Next Steps for Phase 3**:
- Librarian/Healer should create codecs via `makeCodecs(rules)` and pass `segmentId` to `makeTreeNodeCodecs(segmentId)`
- Tree layer (`tree.ts`) can use adapter instead of direct `makeNodeSegmentId` calls
- `codecs/locator` can continue using `makeNodeSegmentId` (which will use codecs internally after migration)
- Integration testing: verify adapter works in tree-node layer, update call sites incrementally

**Files Created**:
- `tree-node/codecs/node-and-segment-id/tree-node-segment-id-codec.ts` - Main adapter implementation
- `tree-node/codecs/node-and-segment-id/index.ts` - Public API exports

**Files Updated**:
- `tree-node/codecs/node-and-segment-id/try-parse-tree-node.ts` - Now uses adapter, returns `CodecError`

### Phase 3: Integration Testing - tree-node Layer (using adapter)

**Goal**: Verify tree-node layer works with adapter

**Status**: ⏳ PENDING - Ready to start (Phase 2 completed)

**Process**:
- Use adapter from Phase 2 in tree-node layer
- Replace direct codec access with adapter functions
- Verify no circular dependencies
- Test TreeNode ↔ SegmentId conversions

### Phase 4: Integration Testing - bulk-vault-action-adapter Layer

**Goal**: Try to use codecs in `src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/`

**Status**: ✅ COMPLETED - All adapter functions migrated to use centralized codecs

**Last Updated**: Phase 3 implementation session - All adapter layer functions migrated, tests updated

**Summary**: 
Phase 3 successfully migrated the entire bulk-vault-action-adapter layer to use centralized codecs. All adapter functions now receive `codecs` as a parameter, Librarian creates codecs once in `init()`, and all tests have been updated. The migration maintains backward compatibility using `adaptCodecResult()` for error conversion (temporary, will be removed in Phase 7). All old utility function imports have been replaced with codec API calls.

**Process**:
- ✅ Identify all codec usage points in adapter layer
- ✅ Create codec instance with rules from parsed settings (injected from Librarian)
- ✅ Attempt to replace imports from `utils/` with `codecs/` factory
- ✅ **Update `library-scope/codecs/`** to use codec rules instead of `getParsedUserSettings()` directly
- ✅ **Document missing methods** - functions needed for adapter layer
- ✅ **Raise problems** - scoping issues, conversion gaps, error handling needs
- ✅ **Add missing methods** to appropriate codec modules (suffix wrappers added to canonicalSplitPath)
- ✅ **Iterate** until adapter layer can fully use codec API

**Completed Work**:
- ✅ Added suffix wrapper functions to `canonicalSplitPath` codecs (exposes internal suffix via `parseSeparatedSuffix`, `serializeSeparatedSuffix`, `suffixPartsToPathParts`, `pathPartsWithRootToSuffixParts`, `pathPartsToSuffixParts`)
- ✅ Updated `CodecRules` to include `libraryRootPathParts` (needed for nested library roots)
- ✅ Updated all `library-scope/codecs/` functions to accept `CodecRules` parameter instead of calling `getParsedUserSettings()` directly
- ✅ Updated `buildTreeActions` to accept `Codecs` and `CodecRules` parameters
- ✅ Created temporary string adapters in `error-adapters.ts` for migration (converts `CodecError` → `string` for backward compatibility)
- ✅ Updated `healingActionToVaultAction` to accept `CodecRules` parameter

**Completed Work (Phase 3 Migration)**:
- ✅ Updated `translateMaterializedEvents` to accept `codecs` parameter and pass to translators
- ✅ Updated `locator.ts` to use new codec API (replaced all old utility functions with codec methods)
- ✅ Updated `infer-intent.ts` to use new codec API (replaced suffix utils with codec methods)
- ✅ Updated `translate-material-events.ts` to use new codec API (replaced `tryParseAsSeparatedSuffixedBasename`)
- ✅ Updated `tryCanonicalizeSplitPathToDestination` in `locator.ts` to use new codec API
- ✅ Updated Librarian to create codecs in `init()` and pass to `buildTreeActions` and `healingActionsToVaultActions`
- ✅ Updated all test files to create codecs in `beforeEach` and pass to functions
- ✅ Replaced old utility function calls in Librarian (`tryParseAsSeparatedSuffixedBasename`, `makeLocatorFromCanonicalSplitPathInsideLibrary`, etc.) with codec API

**Notes for Next Developer**:
- ✅ **Phase 3 COMPLETED**: All adapter layer functions now use centralized codecs
- All library-scope codecs require `CodecRules` as parameter - all call sites updated
- Suffix functions are exposed via `canonicalSplitPath` codecs (not directly from internal suffix module)
- Use `adaptCodecResult()` from `error-adapters.ts` to convert `Result<T, CodecError>` → `Result<T, string>` during migration (temporary, will be removed in Phase 7)
- `buildTreeActions` signature: `(bulk, codecs, rules)` - all call sites updated
- `healingActionsToVaultActions` requires `rules` parameter - all call sites updated
- **Librarian pattern**: Codecs created once in `init()` and stored as instance properties (`this.codecs`, `this.rules`)
- **Test pattern**: Create codecs in `beforeEach` using `makeCodecRulesFromSettings(defaultSettingsForUnitTests)` and `makeCodecs(rules)`
- **Non-null assertions**: Acceptable in Librarian since codecs are guaranteed to exist after `init()` - these are warnings, not errors

**Expected findings**:
- May need additional locator utilities
- May need split path conversion helpers
- May need suffix manipulation functions
- Integration with existing `library-scope/codecs/` may reveal gaps
- Verify no orchestrator uses wrong delimiter (rules ensure consistency)

**Key files migrated**:
- ✅ `translate-material-event/translators/helpers/locator.ts` - Fully migrated to codec API
- ✅ `translate-material-event/translate-material-events.ts` - Fully migrated to codec API
- ✅ `translate-material-event/policy-and-intent/intent/infer-intent.ts` - Fully migrated to codec API
- ✅ All translator functions (`translate-create-material-event.ts`, `translate-delete-material-event.ts`, `traslate-rename-materila-event.ts`) - All accept `codecs` parameter

**Migration Completed (Phase 3)**:

✅ **All files migrated** - See implementation for reference:

1. **`locator.ts`** - ✅ COMPLETED:
   - All old utility functions replaced with codec API
   - Functions now accept `codecs: Codecs` parameter
   - Uses `adaptCodecResult()` for error conversion during migration

2. **`infer-intent.ts`** - ✅ COMPLETED:
   - All suffix utilities replaced with codec API
   - Function now accepts `codecs: Codecs` parameter

3. **`translate-material-events.ts`** - ✅ COMPLETED:
   - `isCodexEvent` helper updated to use codec API
   - Function now accepts `codecs: Codecs` parameter

4. **Librarian** - ✅ COMPLETED:
   - Codecs created in `init()` and stored as instance properties
   - All call sites updated to use `this.codecs!` and `this.rules!`
   - Old utility function calls replaced with codec API

**Implementation Notes**:
- All functions that previously used `getParsedUserSettings()` now receive `codecs` or `rules` as parameters
- Error adapters (`adaptCodecResult`) used throughout for backward compatibility - will be removed in Phase 7
- Tests updated to create codecs in `beforeEach` - see test files for pattern
- Non-null assertions (`!`) used in Librarian - acceptable since codecs guaranteed after `init()`

**Note from Phase 1**: The existing `locator-codec.ts` functions have been moved to `codecs/locator/`. The adapter layer imports from `codecs/index.ts` and uses the factory pattern. Error handling uses temporary adapters (`adaptCodecResult`) to convert `CodecError` → `string` during migration - these will be removed in Phase 7 cleanup.

### Phase 4: Integration Testing - tree Layer ✅ COMPLETED

**Goal**: Try to use codecs in `src/commanders/librarian-new/healer/library-tree/tree.ts`

**Status**: ✅ COMPLETED - Tree and Healer layers migrated to use centralized codec API

**Last Updated**: Phase 4 implementation session - Tree and Healer constructors updated, all manual segment ID parsing replaced

**Summary**:
Phase 4 successfully migrated the tree layer (`tree.ts`) and healer layer (`healer.ts`) to use centralized codec API. All manual segment ID parsing has been replaced with codec API calls. Codecs are injected via constructors, ensuring type safety and consistent error handling.

**Completed Work**:
- ✅ **Tree class** (`tree.ts`):
  - Added `codecs: Codecs` parameter to constructor
  - Replaced `extractNodeNameFromSegmentId` with `codecs.segmentId.parseSectionSegmentId`
  - Replaced `getNodeName` call (line 90) with `codecs.segmentId.parseSegmentId`
  - Added error handling with descriptive messages (throws on invalid segment IDs during tree construction - indicates bugs)
  - Removed unused `NodeSegmentIdSeparator` import (no longer needed)

- ✅ **Healer class** (`healer.ts`):
  - Added `codecs: Codecs` parameter to constructor
  - Stored codecs as instance property
  - Replaced `extractNodeNameFromSegmentId` (line 509) with `codecs.segmentId.parseSectionSegmentId`
  - Error handling: throws on invalid segment IDs (indicates bugs in tree structure)

- ✅ **Librarian** (`librarian.ts`):
  - Updated Healer creation (line 101) to pass codecs: `new Healer(new Tree(libraryRoot, this.codecs!), this.codecs!)`
  - Codecs are guaranteed to exist after `init()`, so non-null assertions are acceptable

- ✅ **Test helpers** (`tree-test-helpers.ts`):
  - Updated `makeTree` function to create codecs using `makeCodecRulesFromSettings(defaultSettingsForUnitTests)` and `makeCodecs(rules)`
  - Passes codecs to both Tree and Healer constructors

- ✅ **Test files**:
  - Updated `codex-init-nested.test.ts` to create codecs before creating Tree/Healer

**Implementation Notes**:
- **Error handling strategy**: In `tree.ts` and `healer.ts`, segment ID parsing failures during tree construction indicate bugs (invalid data structure). Using `unwrapOrThrow` pattern with descriptive error messages that include the original segment ID and error context.
- **Type safety**: `parseSectionSegmentId` returns `Result<SegmentIdComponents<TreeNodeKind.Section>, CodecError>`. Extract `coreName` field from parsed components (type-safe, validated NodeName).
- **Backward compatibility**: All changes are internal to tree/healer layers. No public API changes (Tree and Healer constructors are internal). Tests needed updates but that's expected for migration.
- **Codec injection pattern**: Codecs are created once in Librarian's `init()` and passed down through constructors. This ensures consistency and makes testing easier (test helpers create codecs with test settings).

**Files Modified**:
- `src/commanders/librarian-new/healer/library-tree/tree.ts` - Added codecs parameter, replaced manual parsing
- `src/commanders/librarian-new/healer/healer.ts` - Added codecs parameter, replaced manual parsing
- `src/commanders/librarian-new/librarian.ts` - Updated Healer creation to pass codecs
- `tests/unit/librarian/library-tree/tree-test-helpers.ts` - Updated to create and pass codecs
- `tests/unit/librarian/library-tree/codex/codex-init-nested.test.ts` - Updated to create codecs

**Notes for Next Developer**:
- ✅ **Phase 4 COMPLETED**: Tree and Healer layers now use centralized codec API
- All manual segment ID parsing has been replaced with codec API calls
- Error handling uses `Result<T, CodecError>` with appropriate error messages
- Codecs are injected via constructors (dependency injection pattern)
- Test helpers create codecs using `defaultSettingsForUnitTests` - follow this pattern for new tests
- **Remaining work**: Healer still has other manual parsing methods (`extractNodeNameFromLeafSegmentId`, `extractExtensionFromSegmentId`) - these can be migrated in future phases if needed, but they're not critical since they're only used in healing computation logic

**Note from Phase 1**: The `segmentId.parseSegmentId` function can extract `coreName` from segment IDs. The tree layer now handles `Result<T, CodecError>` returns with appropriate error handling.

### Phase 6: Integration Testing - librarian Layer

**Goal**: Try to use codecs in `src/commanders/librarian-new/librarian.ts`

**Status**: ⏳ PENDING - Can start after Phase 5

**Process**:
- **Update Librarian constructor** to accept `ParsedUserSettings` (or create codec instance in `init()`)
- Replace `extractNodeNameFromScrollSegmentId` with segment ID codec
- Replace `computeScrollSplitPath` with codec API
- Replace manual segment ID construction (line 383) with `segmentId.serializeSegmentId(components)` or `segmentId.serializeSegmentIdUnchecked` if inputs are unchecked
- **Document missing methods** - librarian-specific needs
- **Raise problems** - API ergonomics, error handling
- **Add missing methods** if needed
- **Iterate** until librarian works with codec API

**Expected findings**:
- May need convenience wrappers for common patterns
- May need error recovery strategies

**Note from Phase 1**: Use `segmentId.parseScrollSegmentId` for type-specific parsing. Use `segmentId.serializeSegmentId` for validated inputs, or `serializeSegmentIdUnchecked` for raw inputs. All functions return `Result<T, CodecError>` - update error handling accordingly.

### Phase 7: Final Migration

**Status**: ⏳ PENDING - Depends on all previous phases

Once all layers are tested and codec API is complete:

1. **Remove old implementations**
   - Delete duplicated parsing functions from orchestrators
   - Remove `buildCanonicalLeafSplitPath`, `buildObservedLeafSplitPath`, etc. from `healer.ts`
   - Remove `extractNodeNameFromSegmentId` variants from all files
   - Remove `getNodeName` and `getParentLocator` from `locator-utils.ts` (or replace with codec wrappers)
   - **Replace/remove** `tree-node/codecs/node-and-segment-id/make-node-segment-id.ts` and `make-tree-node.ts` (replaced by centralized codecs)
   - Remove old `locator-codec.ts` from `tree-action/utils/locator/` (moved to `codecs/locator/`)
   - Remove old `canonical-split-path-codec.ts` (moved to `codecs/canonical-split-path/`)
   - Remove old `suffix-utils/` directory (moved to `codecs/internal/suffix/`)

2. **Update all call sites**
   - Replace all old function calls with codec API
   - Add appropriate error handling for `Result<T, CodecError>` returns
   - Use pattern matching on `CodecError.kind` where appropriate
   - Update error handling from string errors to `CodecError` discriminated union

3. **Clean up**
   - Remove unused imports
   - Update tests to use codec API
   - Document any remaining edge cases

**Note from Phase 1**: All old implementations are still in place. They should be removed only after all integration testing is complete and the new API is proven to work. The old code serves as a reference during migration.

## Key Files to Modify

### New Structure
- [src/commanders/librarian-new/healer/library-tree/codecs/](src/commanders/librarian-new/healer/library-tree/codecs/) - New centralized codec structure

### Source Files (to be refactored)
- [src/commanders/librarian-new/healer/healer.ts](src/commanders/librarian-new/healer/healer.ts) - Remove private helpers, use codec API
- [src/commanders/librarian-new/healer/library-tree/tree.ts](src/commanders/librarian-new/healer/library-tree/tree.ts) - Use segment ID codecs
- [src/commanders/librarian-new/healer/library-tree/tree-action/utils/locator/locator-codec.ts](src/commanders/librarian-new/healer/library-tree/tree-action/utils/locator/locator-codec.ts) - Move functions to `codecs/locator/`
- [src/commanders/librarian-new/healer/library-tree/tree-action/utils/canonical-naming/canonical-split-path-codec.ts](src/commanders/librarian-new/healer/library-tree/tree-action/utils/canonical-naming/canonical-split-path-codec.ts) - Move to `codecs/canonical-split-path/`
- [src/commanders/librarian-new/healer/library-tree/tree-action/utils/canonical-naming/suffix-utils/core-suffix-utils.ts](src/commanders/librarian-new/healer/library-tree/tree-action/utils/canonical-naming/suffix-utils/core-suffix-utils.ts) - Move to `codecs/suffix/`
- [src/commanders/librarian-new/healer/library-tree/codex/codex-split-path.ts](src/commanders/librarian-new/healer/library-tree/codex/codex-split-path.ts) ✅ **COMPLETED** - Uses `codecs.segmentId.parseSectionSegmentId`
- [src/commanders/librarian-new/healer/library-tree/codex/codex-impact-to-actions.ts](src/commanders/librarian-new/healer/library-tree/codex/codex-impact-to-actions.ts) ✅ **COMPLETED** - Uses codec API for parsing and segment ID construction
- [src/commanders/librarian-new/healer/library-tree/codex/generate-codex-content.ts](src/commanders/librarian-new/healer/library-tree/codex/generate-codex-content.ts) ✅ **COMPLETED** - Uses `codecs.segmentId.parseSectionSegmentId`
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

5. **Serialize safety**:
   - `serializeSegmentId` and `serializeSeparatedSuffix` assume validated inputs (NodeName, FileExtension are zod-validated types)
   - For unchecked inputs, use `serializeSegmentIdUnchecked` and `serializeSeparatedSuffixUnchecked` which validate and return `Result<T, CodecError>`
   - This prevents silent failures from invalid inputs

6. **Layering**:
   - `codecs/segment-id/` does NOT include TreeNode conversions (avoids circular dependencies)
   - TreeNode ↔ SegmentId conversions live in `tree-node/codecs/node-and-segment-id/tree-node-segment-id-codec.ts` as adapter
   - Adapter uses `segmentId.parseSegmentId` and `segmentId.serializeSegmentId` internally

7. **split-path-inside-library API**:
   - Use `toInsideLibrary(sp)` as canonical API (returns proper `CodecError` with reason)
   - `checkIfInsideLibrary(sp)` is quick predicate for early returns
   - `isInsideLibrary(sp)` is type guard for narrowing
   - Prevents orchestrators from inventing their own error variants

## Todos

### Phase 1: Core Codecs Implementation ✅ COMPLETED
- [x] Create `codecs/errors.ts` with `CodecError` discriminated union type
  - [x] Use smaller top-level set: `SegmentIdError | SuffixError | SplitPathError | LocatorError | ZodError`
  - [x] Include detailed `reason` field inside each variant
  - [x] Add standard `cause?: CodecError` field for error chaining
  - [x] Export error constructors/helpers for consistent error creation
  - **Note**: Error constructors exported: `makeSegmentIdError`, `makeSuffixError`, `makeSplitPathError`, `makeLocatorError`, `makeZodError`
- [x] Create `codecs/rules.ts` with `CodecRules` type
  - [x] Define rules: `{ suffixDelimiter, libraryRootName }` (nodeSegmentIdSeparator is constant, not in rules)
  - [x] Export helper: `makeCodecRulesFromSettings(settings: ParsedUserSettings)` for orchestrators
  - [x] Extract `libraryRootName` from `settings.splitPathToLibraryRoot.basename`
- [x] Create `codecs/types/type-mappings.ts` with type-level mappings (from `plan-generic-prerequesits.md`)
  - [x] Implement `TreeNodeKindToSplitPathKind` mapping object
  - [x] Implement `CorrespondingSplitPathKind<NK>` and `CorrespondingTreeNodeKind<SK>` types
  - [x] Implement helper types: `NodeLocatorOf<NK>`, `SplitPathInsideLibraryOf<SK>`, `CanonicalSplitPathInsideLibraryOf<SK>`
  - [x] Implement generic `SegmentIdComponents<T extends TreeNodeKind>` with mapped shapes
  - [x] Export all types for use in codec modules
  - **Note**: File already existed, verified all required types are present
- [x] Create `codecs/segment-id/` module with factory pattern
  - [x] Import `SegmentIdComponents<T extends TreeNodeKind>` from `codecs/types/type-mappings.ts`
  - [x] Create `makeSegmentIdCodecs(rules: CodecRules)` factory
  - [x] Factory returns codecs using `NodeSegmentIdSeparator` constant (not from rules)
  - [x] Implement generic `parseSegmentId<T extends TreeNodeKind>` + type-specific convenience parsers (return `Result<SegmentIdComponents<T>, CodecError>`)
  - [x] Implement generic `serializeSegmentId<T extends TreeNodeKind>` for validated inputs
  - [x] Implement `serializeSegmentIdUnchecked` (validates inputs, returns `Result<TreeNodeSegmentId, CodecError>`)
  - [x] **Do NOT include TreeNode conversions** - keep codecs/ decoupled
  - **Note**: Created from scratch (new implementation). Structure: `internal/parse.ts`, `internal/serialize.ts`, `make.ts`, `index.ts`, `types.ts`
- [x] Move locator-codec.ts to codecs/locator/ with factory pattern
  - [x] Import generic types from `codecs/types/type-mappings.ts`: `NodeLocatorOf<NK>`, `CanonicalSplitPathInsideLibraryOf<SK>`, `CorrespondingSplitPathKind<T>`, `CorrespondingTreeNodeKind<T>`
  - [x] Create `makeLocatorCodecs(rules: CodecRules)` factory (actually takes `segmentId`, `canonicalSplitPath`, `suffix` as dependencies)
  - [x] Use overloads pattern for `locatorToCanonicalSplitPathInsideLibrary` and `canonicalSplitPathInsideLibraryToLocator` (better type inference)
  - [x] Ensure all parse functions return `Result<T, CodecError>`
  - [x] **Fix**: `locatorToCanonicalSplitPathInsideLibrary` to return `Result<CanonicalSplitPathInsideLibrary, CodecError>` (currently throws)
  - [x] Ensure all functions are neverthrow-pilled (no throwing)
  - **Note**: Refactored from existing `locator-codec.ts`. Structure: `internal/to.ts`, `internal/from.ts`, `make.ts`, `index.ts`, `types.ts`. Uses `makeNodeSegmentId` from tree-node layer (acceptable dependency).
- [x] Create `codecs/split-path-inside-library/` module with factory pattern
  - [x] Create `makeSplitPathInsideLibraryCodecs(rules: CodecRules)` factory
  - [x] Implement `checkIfInsideLibrary(sp): boolean` - quick predicate
  - [x] Implement `isInsideLibrary(sp): sp is SplitPathInsideLibraryCandidate` - type guard
  - [x] Implement `toInsideLibrary(sp): Result<SplitPathInsideLibrary, CodecError>` - canonical API with proper errors
  - [x] Implement `fromInsideLibrary(sp): SplitPath` - adds LibraryRoot back
  - [x] Use `rules.libraryRootName` instead of `getParsedUserSettings()`
  - [x] `toInsideLibrary` returns structured `CodecError` with reason
  - **Note**: Structure: `internal/predicate.ts`, `internal/to.ts`, `internal/from.ts`, `make.ts`, `index.ts`, `types.ts`. Validates pathParts as NodeNames.
- [x] Create `codecs/canonical-split-path/` module with factory pattern
  - [x] Create `makeCanonicalSplitPathCodecs(rules: CodecRules, suffix: SuffixCodecs)` factory
  - [x] Use `fromCanonicalSplitPathInsideLibrary` name (consistent with toCanonical pattern) - document that it's lossy
  - [x] Use `splitPathInsideLibraryToCanonical` for parse direction
  - [x] Parse functions return `Result<T, CodecError>`
  - **Note**: Structure: `internal/to.ts`, `internal/from.ts`, `make.ts`, `index.ts`, `types.ts`. Includes duplicate marker extraction logic from `build-canonical-separated-suffixed-basename-path-king-way.ts`. Validates canonical format matches expected.
- [x] Move suffix utilities to codecs/internal/suffix/ with factory pattern
  - [x] Create `makeSuffixCodecs(rules: CodecRules)` factory
  - [x] Use consistent naming: `pathPartsToSuffixParts`, `pathPartsWithRootToSuffixParts`, `suffixPartsToPathParts`
  - [x] Include `splitBySuffixDelimiter` and `serializeSeparatedSuffix` (validated) + `serializeSeparatedSuffixUnchecked` (validates inputs)
  - [x] All functions use `rules.suffixDelimiter` instead of `getParsedUserSettings()`
  - [x] Ensure all parse functions return `Result<T, CodecError>` (neverthrow-pilled)
  - [x] Serialize functions: validated version assumes NodeName[] are validated, unchecked version validates and returns Result
  - [x] Document library root handling requirements
  - [x] Parse functions return `Result<T, CodecError>`
  - **Note**: Created as `codecs/internal/suffix/` (private, not exported from main index). Structure: `split.ts`, `parse.ts`, `serialize.ts`, `path-parts.ts`, `index.ts`, `types.ts`. All functions take `rules` as first parameter in internal implementations, wrapped by factory.
- [x] Create codecs/index.ts factory
  - [x] Import all codec modules
  - [x] Export `makeCodecs(rules: CodecRules)` factory function
  - [x] Factory creates codecs in dependency order (suffix → segmentId → splitPathInsideLibrary → canonicalSplitPath → locator)
  - [x] Inject dependencies: `canonicalSplitPath` gets `suffix`, `locator` gets `segmentId`, `canonicalSplitPath`, `suffix`
  - [x] Re-export `CodecError` type and `CodecRules` type
  - [x] Re-export `makeCodecRulesFromSettings` helper
  - [x] Verify no circular imports (this is the only file importing all modules)
  - **Note**: Factory returns `{ segmentId, splitPathInsideLibrary, canonicalSplitPath, locator }` - suffix is internal and not exposed. Re-exports all public types for convenience.

### Phase 2: Create TreeNode Adapter in tree-node Layer ✅ COMPLETED
- [x] Create `tree-node/codecs/node-and-segment-id/tree-node-segment-id-codec.ts` adapter
  - ✅ Factory pattern: `makeTreeNodeCodecs(segmentId: SegmentIdCodecs)`
  - ✅ Returns `TreeNodeCodecs` type with `makeNodeSegmentId` and `makeTreeNode` methods
- [x] Implement `makeNodeSegmentId(node: TreeNode)` - uses `segmentId.serializeSegmentId` internally
  - ✅ Proper type narrowing with switch statements
  - ✅ Handles Section, Scroll, and File nodes correctly
- [x] Implement `makeTreeNode(segmentId: TreeNodeSegmentId)` - uses `segmentId.parseSegmentId` internally
  - ✅ Returns `Result<TreeNode, CodecError>` (neverthrow-pilled)
  - ✅ Constructs TreeNode from parsed components with proper status initialization
- [x] Adapter receives codec instance via dependency injection
  - ✅ Factory pattern enables clean dependency injection
  - ✅ No circular dependencies (codecs/ doesn't import TreeNode)
- [x] Update `try-parse-tree-node.ts` to use adapter
  - ✅ Now accepts `TreeNodeCodecs` as first parameter
  - ✅ Returns `Result<TreeNode, CodecError>` instead of `Result<TreeNode, string>`
  - ✅ Uses `makeZodError` helper for error construction
- [x] Create `index.ts` for public API exports
  - ✅ Exports `TreeNodeCodecs` type and `makeTreeNodeCodecs` factory
  - ✅ Re-exports old functions for backward compatibility during migration
- [ ] Replace call sites to use adapter (Phase 3 - integration testing)
- [ ] Document any missing utilities for TreeNode construction (if needed during Phase 3)

### Phase 3: Integration Testing - bulk-vault-action-adapter Layer ✅ COMPLETED
- [x] Identify codec usage points in `bulk-vault-action-adapter/` layer
- [x] Attempt to replace imports from `utils/` with `codecs/` (all imports replaced)
- [x] **Document missing methods** - adapter-specific needs (suffix wrappers added)
- [x] **Raise problems** - scoping issues, conversion gaps, error handling needs (resolved: suffix exposed via canonicalSplitPath, rules threaded through)
- [x] Add missing methods to appropriate codec modules (suffix wrappers added to canonicalSplitPath)
- [x] Test integration with existing `library-scope/codecs/` (updated to use CodecRules)
- [x] Iterate until adapter layer can fully use codec API (all adapter functions migrated)

**Migration Status**:
- ✅ Foundation: Codec injection points established, rules threaded through library-scope layer
- ✅ Error adapters: Temporary string adapters created for backward compatibility
- ✅ Adapter functions: All updated - `locator.ts`, `infer-intent.ts`, `translate-material-events.ts` use new API
- ✅ Librarian integration: Codecs created in `init()`, passed to all adapter functions
- ✅ Tests: All test files updated with codec setup and function calls

**Completion Date**: Phase 3 implementation session
**Files Migrated**: 
- `librarian.ts` - Codec creation and injection
- `translate-material-events.ts` - Codec parameter added
- `locator.ts` - Full migration to codec API
- `infer-intent.ts` - Full migration to codec API
- All translator functions - Codec parameter added
- All test files - Codec setup and function calls updated

### Phase 4: Integration Testing - tree Layer ✅ COMPLETED
- [x] Replace `extractNodeNameFromSegmentId` with segment ID codec in `tree.ts`
- [x] Replace `getNodeName` call with codec API
- [x] **Document missing methods** - tree-specific needs (none found - codec API sufficient)
- [x] **Raise problems** - error handling patterns, type conversions (resolved: using Result with descriptive errors)
- [x] Add missing methods if needed (none needed)
- [x] Iterate until tree layer works with codec API

**Completion Date**: Phase 4 implementation session
**Files Migrated**: 
- `tree.ts` - Codec injection, replaced `extractNodeNameFromSegmentId` and `getNodeName`
- `healer.ts` - Codec injection, replaced `extractNodeNameFromSegmentId`
- `librarian.ts` - Updated to pass codecs to Healer/Tree constructors
- Test helpers and test files - Updated to create codecs

**Key Changes**:
- Tree and Healer constructors now require `codecs: Codecs` parameter
- All manual segment ID parsing replaced with `codecs.segmentId.parseSectionSegmentId` and `codecs.segmentId.parseSegmentId`
- Error handling: throws on invalid segment IDs (indicates bugs during tree construction)
- Test pattern: Create codecs in test helpers using `makeCodecRulesFromSettings(defaultSettingsForUnitTests)`

### Phase 5: Integration Testing - librarian Layer (Codex Migration) ✅ COMPLETED

**Status**: ✅ **COMPLETED** - Codex files migrated to use centralized codec API

**Last Updated**: Codex migration session - All codex functions now use centralized codecs

**Summary**:
Phase 5 successfully migrated all codex-related functions to use the centralized codec API. All manual segment ID parsing and construction in codex files has been replaced with codec API calls. Codecs are passed as parameters to maintain function purity.

**Completed Work**:
- [x] Update Librarian to receive parsed settings and create codec instance (✅ Completed in Phase 3)
- [x] **Codex files migration**:
  - ✅ `codex-split-path.ts`: Replaced `extractNodeNameFromSegmentId` with `codecs.segmentId.parseSectionSegmentId`
  - ✅ `generate-codex-content.ts`: Replaced manual parsing with `codecs.segmentId.parseSectionSegmentId`
  - ✅ `codex-impact-to-actions.ts`: 
    - Replaced `extractNodeNameFromSegmentId` with `codecs.segmentId.parseSectionSegmentId`
    - Replaced `makeNodeSegmentId` with `codecs.segmentId.serializeSegmentId` (for TreeNode inputs)
    - Updated `computeScrollSplitPath` to use codec API for parsing parent chain
    - Updated `buildMovedCodexPath` to use codec API
- [x] **Librarian updates**:
  - ✅ Updated all `codexImpactToActions` calls to pass `this.codecs!`
  - ✅ Updated `computeCodexSplitPath` call to pass `this.codecs!`
  - ✅ Replaced manual segment ID construction (line 410) with `codecs.segmentId.serializeSegmentIdUnchecked` for unsafe user input (validates and returns Result)
- [x] **Test files updated**:
  - ✅ `codex-split-path.test.ts` - Creates codecs in `beforeEach`, passes to all function calls
  - ✅ `codex-impact-to-actions.test.ts` - Creates codecs, passes to `codexImpactToActions`
  - ✅ `codex-init-nested.test.ts` - Passes codecs to `codexImpactToActions`
  - ✅ `generate-codex-content.test.ts` - Creates codecs, passes to all `generateCodexContent` calls

**Implementation Notes**:
- **Function signatures updated**: All codex functions now accept `codecs: Codecs` parameter:
  - `computeCodexSplitPath(sectionChain, codecs)`
  - `generateCodexContent(section, sectionChain, codecs)`
  - `codexImpactToActions(impact, tree, codecs)`
- **Error handling strategy**:
  - `computeCodexSplitPath`: Throws on parse failure (should never happen with valid tree state)
  - `generateCodexContent`: Throws on parse failure (should never happen with valid tree state)
  - `codexImpactToActions`: Skips sections/scrolls silently if parsing fails (logs would require side effects in pure functions)
  - `librarian.ts` line 410: Logs error and returns early if `serializeSegmentIdUnchecked` fails (user input validation)
- **Codec usage patterns**:
  - Section segment IDs: Use `codecs.segmentId.parseSectionSegmentId(segId)` → `Result<SegmentIdComponents<TreeNodeKind.Section>, CodecError>`
  - Scroll segment IDs: Use `codecs.segmentId.parseScrollSegmentId(segId)` → `Result<SegmentIdComponents<TreeNodeKind.Scroll>, CodecError>`
  - Building segment IDs from TreeNode: Use `codecs.segmentId.serializeSegmentId(components)` (validated inputs)
  - Building segment IDs from unsafe input: Use `codecs.segmentId.serializeSegmentIdUnchecked(components)` (validates and returns Result)
- **Test pattern**: Create codecs in `beforeEach` using `makeCodecRulesFromSettings(defaultSettingsForUnitTests)` and `makeCodecs(rules)`

**Files Modified**:
- `src/commanders/librarian-new/healer/library-tree/codex/codex-split-path.ts` - Added codecs parameter, replaced manual parsing
- `src/commanders/librarian-new/healer/library-tree/codex/generate-codex-content.ts` - Added codecs parameter, replaced manual parsing
- `src/commanders/librarian-new/healer/library-tree/codex/codex-impact-to-actions.ts` - Added codecs parameter, replaced all manual parsing/construction
- `src/commanders/librarian-new/librarian.ts` - Updated call sites, replaced manual segment ID construction
- All codex test files - Updated to create and pass codecs

**Notes for Future Maintainers**:
- ✅ **Codex migration COMPLETED**: All codex functions now use centralized codec API
- All codex functions are pure (no side effects) - adding `codecs` parameter maintains purity
- When adding new codex functionality, always accept `codecs: Codecs` as a parameter
- Use `parseSectionSegmentId` for section segment IDs, `parseScrollSegmentId` for scroll segment IDs
- For TreeNode → SegmentId: Use `codecs.segmentId.serializeSegmentId` (validated) or TreeNode adapter
- For unsafe input → SegmentId: Use `codecs.segmentId.serializeSegmentIdUnchecked` (validates and returns Result)
- Error handling: Parse failures in codex functions indicate bugs (invalid tree state) - throw with descriptive messages
- Test pattern: Always create codecs in test setup using `makeCodecRulesFromSettings(defaultSettingsForUnitTests)`

**Remaining Work (Phase 5 continuation)**:
- [x] Replace `extractNodeNameFromScrollSegmentId` with segment ID codec in `librarian.ts` (non-codex usage) ✅ **COMPLETED** (Phase 5+6)
- [x] Replace `computeScrollSplitPath` in `librarian.ts` with codec API (non-codex usage) ✅ **COMPLETED** (Phase 5+6)
- [x] **Document missing methods** - librarian-specific needs ✅ **COMPLETED** (no missing methods found)
- [x] **Raise problems** - API ergonomics, error handling ✅ **COMPLETED** (error handling uses Result with graceful degradation)
- [x] Add missing methods if needed ✅ **COMPLETED** (no missing methods needed)
- [x] Iterate until all librarian helper functions use codec API ✅ **COMPLETED** (Phase 5+6)

### Phase 5+6: Integration Testing - librarian and healer Layers ✅ COMPLETED

**Status**: ✅ **COMPLETED** - All manual segment ID parsing and split path construction replaced with codec API

**Last Updated**: Phase 5+6 implementation session - librarian.ts and healer.ts fully migrated

**Summary**:
Phase 5+6 successfully completed the migration of `librarian.ts` and `healer.ts` to use the centralized codec API. All manual segment ID parsing and split path construction has been replaced with codec API calls. Error handling follows Result-based patterns with appropriate strategies for each layer.

**Completed Work - librarian.ts**:
- [x] **Replaced `extractNodeNameFromScrollSegmentId`** (line 634):
  - ✅ Now uses `codecs.segmentId.parseScrollSegmentId(segmentId)` → returns `Result<string, CodecError>`
  - ✅ Returns `Result` with error handling in call site (skips action on error - graceful degradation)
  - ✅ Call site updated: `extractScrollStatusActions` handles Result, skips invalid actions

- [x] **Replaced `computeScrollSplitPath`** (line 644):
  - ✅ Now uses codec API to build `ScrollNodeLocator` from `nodeName` + `parentChain`
  - ✅ Uses `codecs.locator.locatorToCanonicalSplitPathInsideLibrary(locator)` → `Result<CanonicalSplitPathToMdFileInsideLibrary, CodecError>`
  - ✅ Uses `codecs.canonicalSplitPath.fromCanonicalSplitPathInsideLibrary(canonical)` → `SplitPathToMdFileInsideLibrary`
  - ✅ Returns `Result<SplitPathToMdFileInsideLibrary, CodecError>` with error handling
  - ✅ Call site updated: `extractScrollStatusActions` handles Result, skips invalid actions
  - ✅ Implementation details:
    - Parses each segment ID in `parentChain` using `codecs.segmentId.parseSectionSegmentId` (validates chain)
    - Creates `ScrollNodeSegmentId` using `codecs.segmentId.serializeSegmentIdUnchecked({ coreName: nodeName, targetKind: TreeNodeKind.Scroll, extension: "md" })`
    - Constructs `ScrollNodeLocator` with `{ segmentId, segmentIdChainToParent, targetKind: TreeNodeKind.Scroll }`
    - Chains operations using `andThen` for proper type inference

**Completed Work - healer.ts**:
- [x] **Replaced `buildCanonicalLeafSplitPath`** (line 452):
  - ✅ Now uses `codecs.locator.locatorToCanonicalSplitPathInsideLibrary(locator)` → `Result<CanonicalSplitPathInsideLibrary, CodecError>`
  - ✅ Uses `codecs.canonicalSplitPath.fromCanonicalSplitPathInsideLibrary(canonical)` → `SplitPathInsideLibrary`
  - ✅ Returns `Result<SplitPathToMdFileInsideLibrary | SplitPathToFileInsideLibrary, CodecError>`
  - ✅ Call sites updated: `computeLeafHealing` and `buildCanonicalLeafSplitPathFromOldLocator` handle Result (throw on error - indicates bug in tree structure)
  - ✅ Uses `andThen` for proper type chaining

- [x] **Replaced `buildObservedLeafSplitPath`** (line 420):
  - ✅ Now uses `codecs.canonicalSplitPath.pathPartsWithRootToSuffixParts(oldSuffixPathParts)` → get suffixParts
  - ✅ Uses `codecs.canonicalSplitPath.serializeSeparatedSuffix({ coreName: leaf.nodeName, suffixParts })` → get basename
  - ✅ Builds split path object directly (no Result needed - all inputs validated)
  - ✅ Return type unchanged: `SplitPathToMdFileInsideLibrary | SplitPathToFileInsideLibrary`

- [x] **Removed unused helper methods**:
  - ✅ Removed `extractNodeNameFromLeafSegmentId` (line 524) - no longer used
  - ✅ Removed `extractExtensionFromSegmentId` (line 532) - no longer used
  - ✅ Removed unused imports: `NodeSegmentIdSeparator`, `makeJoinedSuffixedBasename`, `makeSuffixPartsFromPathPartsWithRoot`

**Error Handling Strategy**:
- **librarian.ts**: Graceful degradation - returns `Result`, skips action if error (logs error, continues processing)
  - `extractNodeNameFromScrollSegmentId`: Returns `Result`, call site skips on error
  - `computeScrollSplitPath`: Returns `Result`, call site skips on error
- **healer.ts**: Error propagation - returns `Result`, throws on error (indicates bug in tree structure)
  - `buildCanonicalLeafSplitPath`: Returns `Result`, call sites throw on error with descriptive messages
  - `buildObservedLeafSplitPath`: Direct return (no Result) - inputs already validated

**Implementation Notes**:
- **Type safety**: Used `andThen` for Result chaining to maintain proper TypeScript type inference
- **Locator construction**: When building locators from components, parse each segment ID in parent chain to validate, then construct locator with validated segment IDs
- **Codec API patterns**:
  - Segment ID parsing: `codecs.segmentId.parseScrollSegmentId` / `parseSectionSegmentId` → `Result<SegmentIdComponents<T>, CodecError>`
  - Segment ID construction: `codecs.segmentId.serializeSegmentIdUnchecked({ coreName, targetKind, extension })` → `Result<TreeNodeSegmentId, CodecError>`
  - Locator → Split Path: `codecs.locator.locatorToCanonicalSplitPathInsideLibrary(locator)` → `codecs.canonicalSplitPath.fromCanonicalSplitPathInsideLibrary(canonical)`
  - Suffix operations: `codecs.canonicalSplitPath.pathPartsWithRootToSuffixParts(pathParts)` and `serializeSeparatedSuffix({ coreName, suffixParts })`

**Files Modified**:
- `src/commanders/librarian-new/librarian.ts`:
  - Replaced `extractNodeNameFromScrollSegmentId` with codec API
  - Replaced `computeScrollSplitPath` with codec API
  - Updated `extractScrollStatusActions` to handle Results
  - Added imports: `Result`, `ok` from neverthrow, `ScrollNodeLocator`, `CanonicalSplitPathToMdFileInsideLibrary`
  - Removed unused import: `NodeSegmentIdSeparator`

- `src/commanders/librarian-new/healer/healer.ts`:
  - Replaced `buildCanonicalLeafSplitPath` with codec API
  - Replaced `buildObservedLeafSplitPath` with codec API
  - Updated call sites to handle Results
  - Removed unused helpers: `extractNodeNameFromLeafSegmentId`, `extractExtensionFromSegmentId`
  - Removed unused imports: `NodeSegmentIdSeparator`, `makeJoinedSuffixedBasename`, `makeSuffixPartsFromPathPartsWithRoot`
  - Added imports: `Result`, `ok` from neverthrow, `CodecError`

**Notes for Future Maintainers**:
- ✅ **Phase 5+6 COMPLETED**: All manual segment ID parsing and split path construction replaced with codec API
- **Error handling patterns**:
  - Librarian: Use graceful degradation (skip on error, log) - user-facing actions should be resilient
  - Healer: Use error propagation (throw on error) - indicates bugs in tree structure that should be fixed
- **When building locators from components**:
  1. Parse each segment ID in parent chain to validate: `codecs.segmentId.parseSectionSegmentId(segId)`
  2. Create target segment ID: `codecs.segmentId.serializeSegmentIdUnchecked({ coreName, targetKind, extension })`
  3. Construct locator: `{ segmentId, segmentIdChainToParent, targetKind }`
  4. Convert to split path: `locatorToCanonicalSplitPathInsideLibrary` → `fromCanonicalSplitPathInsideLibrary`
- **Result chaining**: Use `andThen` for proper type inference when chaining Result operations
- **Type assertions**: May be needed when TypeScript can't narrow generic Result types (e.g., `as CanonicalSplitPathToMdFileInsideLibrary` when you know the locator is a Scroll)
- **Test pattern**: All tests should create codecs using `makeCodecRulesFromSettings(defaultSettingsForUnitTests)` and `makeCodecs(rules)`

**Remaining Work**:
- `locator-utils.ts`: `getNodeName` and `getParentLocator` still throw - should be replaced with Result-based codec API in Phase 7 cleanup
- Old utility functions in `tree-action/utils/` can be removed in Phase 7 cleanup (already migrated to codec API)

### Phase 7: Final Migration ⏳ PENDING
- [ ] Remove old implementations from orchestrators
  - [ ] Delete duplicated parsing functions
  - [ ] Remove `buildCanonicalLeafSplitPath`, `buildObservedLeafSplitPath`, etc. from `healer.ts`
  - [ ] Remove `extractNodeNameFromSegmentId` variants from all files (codex files ✅ completed, healer/tree ✅ completed, librarian ⏳ pending)
  - [ ] Remove or replace `getNodeName` and `getParentLocator` from `locator-utils.ts`
  - [ ] Replace/remove `tree-node/codecs/node-and-segment-id/make-node-segment-id.ts` and `make-tree-node.ts`
  - [ ] Remove old `locator-codec.ts` from `tree-action/utils/locator/` (moved to `codecs/locator/`)
  - [ ] Remove old `canonical-split-path-codec.ts` (moved to `codecs/canonical-split-path/`)
  - [ ] Remove old `suffix-utils/` directory (moved to `codecs/internal/suffix/`)
- [ ] Update all call sites with appropriate error handling
- [ ] Clean up unused imports
- [ ] Add unit tests for all codec modules
  - [ ] Test error cases return appropriate `CodecError` variants
  - [ ] Test error context preservation
  - [ ] Test pattern matching on error kinds
- [ ] Update integration tests to verify orchestrators work with new API