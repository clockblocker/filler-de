# Generic Type Prerequisites for Codec API

## Overview

Before implementing the codec API from `plan.md`, we need to:
1. **Rename first**: `TreeNodeType` → `TreeNodeKind` and `SplitPathType` → `SplitPathKind` (mappings will use new names from the start)
2. **Support generic interfaces**: Type-safe conversions (e.g., `NodeLocatorOf<NK>`, `SplitPathInsideLibrary<SK>`, `CanonicalSplitPathInsideLibrary<SK>`)
3. **Generic SegmentIdComponents**: `SegmentIdComponents<T extends TreeNodeKind>` that narrows based on kind
4. **Establish type mappings**: Between `TreeNodeKind` and `SplitPathKind` to support generic functions like `parseSegmentId<T extends TreeNodeKind>` and eliminate runtime if/switch statements

## Current State

### Type Definitions

**SplitPathKind** (in `src/managers/obsidian/vault-action-manager/types/split-path.ts`):
- `SplitPathKind.Folder` = `"Folder"`
- `SplitPathKind.File` = `"File"`
- `SplitPathKind.MdFile` = `"MdFile"`

**TreeNodeKind** (in `src/commanders/librarian-new/healer/library-tree/tree-node/types/atoms.ts`):
- `TreeNodeKind.Section` = `"Section"`
- `TreeNodeKind.Scroll` = `"Scroll"`
- `TreeNodeKind.File` = `"File"`

### Current Mapping (Manual, in switch statements)

Found in `locator-codec.ts`:
- `TreeNodeKind.Section` → `SplitPathKind.Folder`
- `TreeNodeKind.Scroll` → `SplitPathKind.MdFile`
- `TreeNodeKind.File` → `SplitPathKind.File`

### Generic Type Pattern

`SplitPath<T extends SplitPathKind>` already exists (line 56 of `split-path.ts`):
```typescript
export type SplitPath<T extends SplitPathKind> = AnySplitPath & { type: T };
```

## Requirements

### 1. Type-Level Mappings

Create bidirectional type mappings:
- `CorrespondingTreeNodeKind<SplitPathKind>` - maps SplitPathKind → TreeNodeKind
- `CorrespondingSplitPathKind<TreeNodeKind>` - maps TreeNodeKind → SplitPathKind

### 2. Generic Function Support

Enable generic functions like:
```typescript
parseSegmentId<T extends TreeNodeKind>(id: TreeNodeSegmentId): Result<SegmentIdComponents<T>, CodecError>
```

Where `SegmentIdComponents<T>` would narrow based on the TreeNodeKind.

### 3. Type Safety

Ensure type-safe conversions between:
- `SplitPath<CorrespondingSplitPathKind<T>>` ↔ TreeNode types
- Segment IDs ↔ SplitPath types
- Locators ↔ CanonicalSplitPath types

## Decisions

### Q1: Location of Mapping Types
**Decision**: `codecs/types/type-mappings.ts` - Codec-specific, avoids circular dependencies.

### Q2: Runtime vs Type-Only Mappings
**Decision**: **Type-only mappings** in this file. Runtime mappings will be handled in `plan-impl.md` as part of codec implementation.

### Q3: Generic Constraint Design
**Decision**: **Generic + overloads if needed** - Start with generic functions, add overloads for better type inference when needed.

### Q4: Mapping Completeness
**Decision**: **Exhaustiveness with `never`** - Enforce complete mappings, TypeScript will error if new types are added without mappings.

### Q5: Reverse Mapping Ambiguity
**Decision**: **No ambiguity** - `File` ↔ `File` is intentional and clear. Document the semantic relationship.

### Q6: Integration with Existing Generic Types
**Decision**: Create helper types that combine mappings with existing generic patterns in `codecs/types/type-mappings.ts`.

### Q7: Renaming Timing
**Decision**: **Rename BEFORE creating mappings** - Mappings will use new names (`TreeNodeKind`, `SplitPathKind`) from the start.

### Q8: Generic SegmentIdComponents
**Decision**: **Yes** - Make `SegmentIdComponents<T extends TreeNodeKind>` generic:
- `SegmentIdComponents<TreeNodeKind.Section>` → no `extension` field
- `SegmentIdComponents<TreeNodeKind.Scroll>` → `extension: 'md'`
- `SegmentIdComponents<TreeNodeKind.File>` → `extension: FileExtension`

### Q9: Generic CanonicalSplitPathInsideLibrary
**Decision**: **Same pattern as SplitPath** - Add `CanonicalSplitPathInsideLibrary<SK extends SplitPathKind>` to narrow the union.

### Q10: Mapping Implementation Approach
**Decision**: **Use mapping objects** instead of conditional type chains:
- More maintainable (single source of truth)
- Exhaustiveness checked automatically via `satisfies Record<...>`
- Cleaner syntax
- Types derived from mapping objects using indexed access

### Q11: Total TypeScript Patterns Integration
**Decision**: **Integrate 4 high-ROI patterns**:
1. **SegmentIdComponents mapped shapes** - Makes invalid states impossible (`extension?: never` for Section)
2. **Derive reverse mapping** - Reduces drift risk (one source of truth, reverse derived type-level)
3. **Name collision fixes** - Use `Of` suffix for generic selectors (avoids self-reference bugs)
4. **Overloads instead of casts** - Eliminate `as` casts in builder functions (better type safety)

## Proposed Implementation

### File Structure

```
codecs/
  types/
    type-mappings.ts    # NEW: Type-level mappings only
```

### Type Mappings (Type-Level Only)

**Using mapping objects for better maintainability and exhaustiveness checking:**

```typescript
// Single source of truth: TreeNodeKind → SplitPathKind mapping
export const TreeNodeKindToSplitPathKind = {
  [TreeNodeKind.Section]: SplitPathKind.Folder,
  [TreeNodeKind.Scroll]: SplitPathKind.MdFile,
  [TreeNodeKind.File]: SplitPathKind.File,
} as const satisfies Record<TreeNodeKind, SplitPathKind>;

// Derive reverse mapping type-level (reduces drift risk) 
// in src/types/helpers.ts
type InvertRecord<R extends Record<PropertyKey, PropertyKey>> = {
  [K in keyof R as R[K]]: K
};

type SplitPathKindToTreeNodeKind = InvertRecord<typeof TreeNodeKindToSplitPathKind>;

// Type-level mappings derived from mapping objects
export type CorrespondingSplitPathKind<NK extends TreeNodeKind> =
  (typeof TreeNodeKindToSplitPathKind)[NK];

export type CorrespondingTreeNodeKind<SK extends SplitPathKind> =
  SplitPathKindToTreeNodeKind[SK];
```

**Benefits**:
- Single source of truth (one mapping object)
- Reverse mapping derived type-level (reduces drift risk)
- Exhaustiveness checked automatically via `satisfies Record<...>`
- TypeScript errors if mappings are incomplete
- More maintainable than conditional type chains

### Helper Types

```typescript
// Helper types combining mappings with existing generics
export type SplitPathForTreeNodeKind<T extends TreeNodeKind> =
  SplitPath<CorrespondingSplitPathKind<T>>;

export type TreeNodeKindForSplitPath<T extends SplitPathKind> =
  CorrespondingTreeNodeKind<T>;

// Generic locator type (narrows TreeNodeLocator union)
export type NodeLocatorOf<NK extends TreeNodeKind> = Extract<
  TreeNodeLocator,
  { targetType: NK }
>;

// Generic split path inside library (narrows union)
// Using "Of" suffix to avoid name collision with union type SplitPathInsideLibrary
export type SplitPathInsideLibraryOf<SK extends SplitPathKind> = Extract<
  SplitPathInsideLibrary,
  { type: SK }
>;

// Generic canonical split path inside library (narrows union, same pattern as SplitPath)
// Using "Of" suffix to avoid name collision with union type CanonicalSplitPathInsideLibrary
export type CanonicalSplitPathInsideLibraryOf<SK extends SplitPathKind> = Extract<
  CanonicalSplitPathInsideLibrary,
  { type: SK }
>;

// Segment ID components mapped to full shapes (makes invalid states impossible)
type SegmentIdComponentsMap = {
  [TreeNodeKind.Section]: {
    coreName: NodeName;
    targetType: TreeNodeKind.Section;
    extension?: never; // <-- forbidden, prevents extension from sneaking in
  };
  [TreeNodeKind.Scroll]: {
    coreName: NodeName;
    targetType: TreeNodeKind.Scroll;
    extension: 'md';
  };
  [TreeNodeKind.File]: {
    coreName: NodeName;
    targetType: TreeNodeKind.File;
    extension: FileExtension;
  };
};

// Generic segment ID components (narrows based on TreeNodeKind)
export type SegmentIdComponents<NK extends TreeNodeKind> = SegmentIdComponentsMap[NK];
```

**Benefits**:
- Exact shape per kind (no optional extension on Section)
- `extension?: never` prevents extension from being added to Section
- Great autocomplete
- Makes invalid states unrepresentable
```

**Note**: Runtime mappings will be implemented in `plan-impl.md` as part of codec factory functions.

## Code Simplification Examples

### Example 1: Simplifying `buildCanonicalLeafSplitPath` in `healer.ts`

**Before** (lines 449-487):
```typescript
private buildCanonicalLeafSplitPath(
  locator: ScrollNodeLocator | FileNodeLocator,
): SplitPathToMdFileInsideLibrary | SplitPathToFileInsideLibrary {
  // ... manual extraction logic ...
  
  if (locator.targetType === TreeNodeKind.Scroll) {
    return {
      basename,
      extension: "md",
      pathParts,
      type: SplitPathKind.MdFile,
    };
  }
  
  // Extract extension from segmentId
  const extension = this.extractExtensionFromSegmentId(locator.segmentId);
  return {
    basename,
    extension,
    pathParts,
    type: SplitPathKind.File,
  };
}
```

**After** (with overloads - Total TypeScript pattern):
```typescript
// Overloads Eliminate type casts like as SplitPathInsideLibraryOf<...> while keeping implementation simple
// Allow lightweight as const to preserve literal types.
function buildCanonicalSplitPath(
  locator: NodeLocatorOf<TreeNodeKind.Scroll>,
): SplitPathInsideLibraryOf<SplitPathKind.MdFile>;
function buildCanonicalSplitPath(
  locator: NodeLocatorOf<TreeNodeKind.File>,
): SplitPathInsideLibraryOf<SplitPathKind.File>;
function buildCanonicalSplitPath(
  locator: NodeLocatorOf<TreeNodeKind.Scroll | TreeNodeKind.File>,
): SplitPathInsideLibraryOf<SplitPathKind.MdFile> | SplitPathInsideLibraryOf<SplitPathKind.File> {
  const pathParts = locator.segmentIdChainToParent.map((segId) =>
    this.extractNodeNameFromSegmentId(segId),
  );
  const suffixParts = makeSuffixPartsFromPathPartsWithRoot(pathParts);
  const nodeName = this.extractNodeNameFromLeafSegmentId(locator.segmentId);
  const basename = makeJoinedSuffixedBasename({ coreName: nodeName, suffixParts });
  
  if (locator.targetType === TreeNodeKind.Scroll) {
    return {
      basename,
      extension: "md",
      pathParts,
      type: SplitPathKind.MdFile,
    } as const;
  }
  
  const extension = this.extractExtensionFromSegmentId(locator.segmentId);
  return {
    basename,
    extension,
    pathParts,
    type: SplitPathKind.File,
  } as const;
}
```

**Benefits of overloads**:
- Call sites get perfect types (no generic parameter needed)
- Implementation stays readable (no complex generics)
- No unsafe `as` casts needed
- TypeScript narrows based on input type

**Benefits**:
- Type inference eliminates need for explicit union return types
- Compile-time guarantees that return type matches input locator kind
- Less runtime branching (type system handles narrowing)
- Better autocomplete and type checking

### Example 2: Generic Segment ID Parsing

**Before**:
```typescript
// Multiple separate functions or manual type narrowing
extractNodeNameFromScrollSegmentId(id: ScrollNodeSegmentId): NodeName
extractNodeNameFromFileSegmentId(id: FileNodeSegmentId): NodeName
```

**After**:
```typescript
parseSegmentId<NK extends TreeNodeKind>(
  id: TreeNodeSegmentId
): Result<SegmentIdComponents<NK>, CodecError>

// Usage:
const result = parseSegmentId<TreeNodeKind.Scroll>(id);
// TypeScript knows result.value has Scroll-specific fields
```

### Example 3: Type-Safe Locator Conversions

**Before**:
```typescript
makeCanonicalSplitPathInsideLibraryFromLocator(
  loc: TreeNodeLocator,
): CanonicalSplitPathInsideLibrary {
  // Manual switch statement with type assertions
  switch (loc.targetType) {
    case TreeNodeKind.Section: return { /* ... */ } as CanonicalSplitPathToFolderInsideLibrary;
    // ...
  }
}
```

**After** (with overloads):
```typescript
function makeCanonicalSplitPathInsideLibraryFromLocator(
  loc: NodeLocatorOf<TreeNodeKind.Section>,
): Result<CanonicalSplitPathInsideLibraryOf<SplitPathKind.Folder>, CodecError>;
function makeCanonicalSplitPathInsideLibraryFromLocator(
  loc: NodeLocatorOf<TreeNodeKind.Scroll>,
): Result<CanonicalSplitPathInsideLibraryOf<SplitPathKind.MdFile>, CodecError>;
function makeCanonicalSplitPathInsideLibraryFromLocator(
  loc: NodeLocatorOf<TreeNodeKind.File>,
): Result<CanonicalSplitPathInsideLibraryOf<SplitPathKind.File>, CodecError>;
function makeCanonicalSplitPathInsideLibraryFromLocator(
  loc: NodeLocatorOf<TreeNodeKind>,
): Result<CanonicalSplitPathInsideLibrary, CodecError> {
  // Implementation with proper error handling
  // Type system ensures return type matches input kind via overloads
}
```

## Integration Points

### 1. Segment ID Codecs

Generic `parseSegmentId` will use mappings:
```typescript
parseSegmentId<NK extends TreeNodeKind>(
  id: TreeNodeSegmentId
): Result<SegmentIdComponents<NK>, CodecError>
```

### 2. Locator Codecs

Conversions between locators and split paths will use mappings:
```typescript
locatorToCanonicalSplitPath<NK extends TreeNodeKind>(
  loc: NodeLocatorOf<NK>
): Result<CanonicalSplitPathInsideLibraryOf<CorrespondingSplitPathKind<NK>>, CodecError>
```

**Note**: Using `CanonicalSplitPathInsideLibraryOf` (with `Of` suffix) to avoid name collision with union type.

### 3. Existing Code Simplification

Functions like `buildCanonicalLeafSplitPath` in `healer.ts` can be simplified:
- Replace union return types with generic return types
- Eliminate runtime mapping switches; keep minimal runtime branching only where data differs (e.g., extension extraction).
- Better type inference and compile-time guarantees

## Testing Strategy

1. **Type-level tests**: Verify exhaustiveness using `never` pattern
   - Test that all TreeNodeKind values map to SplitPathKind
   - Test that all SplitPathKind values map to TreeNodeKind
   - Verify `never` is returned for unmapped types

2. **Generic type tests**: Verify generic constraints work correctly
   - Test `NodeLocatorOf<NK>` narrows correctly for each TreeNodeKind
   - Test `SplitPathInsideLibrary<SK>` narrows correctly for each SplitPathKind
   - Test helper types like `SplitPathForTreeNodeKind` work correctly

3. **Round-trip tests**: Verify bidirectional mappings are consistent
   - `CorrespondingSplitPathKind<CorrespondingTreeNodeKind<T>>` should equal `T`
   - `CorrespondingTreeNodeKind<CorrespondingSplitPathKind<T>>` should equal `T`

4. **Integration tests**: Verify mappings work in actual codec functions
   - Test generic functions with different TreeNodeKind values
   - Verify type inference works correctly at call sites

## Migration Impact

### Files That Will Use Mappings

1. `codecs/segment-id/` - Generic `parseSegmentId<NK>`
2. `codecs/locator/` - Type-safe conversions with `NodeLocatorOf<NK>`
3. `healer.ts` - Simplify `buildCanonicalLeafSplitPath` and similar functions
4. `locator-codec.ts` - Use generic types for better inference
5. `codex-impact-to-actions.ts` - Type-safe split path building
6. Any code converting between TreeNode and SplitPath types

### Breaking Changes

None expected - this is additive. Existing code can continue using manual mappings until migrated. New generic types are optional and can be adopted incrementally.

### Migration Strategy

1. **Phase 0**: Rename `TreeNodeType` → `TreeNodeKind` and `SplitPathType` → `SplitPathKind` across codebase
2. **Phase 1**: Create type mappings in `codecs/types/type-mappings.ts` (using new names)
3. **Phase 2**: Update codec APIs to use generics (non-breaking)
4. **Phase 3**: Migrate existing code to use generic types (optional, incremental)
5. **Phase 4**: Remove old manual mappings once all code is migrated

## Implementation Checklist

### Phase 0: Renaming
- [ ] Rename `TreeNodeType` → `TreeNodeKind` in `tree-node/types/atoms.ts`
- [ ] Rename `SplitPathType` → `SplitPathKind` in `vault-action-manager/types/split-path.ts`
- [ ] Update all imports and usages across codebase
- [ ] Update variable / obj key names to be consistent. ie: "targetType:" -> "targetType:"
- [ ] Verify no breaking changes (types are structurally compatible)

### Phase 1: Type Mappings
- [ ] Create `codecs/types/type-mappings.ts` with type-level mappings
- [ ] Test conditional type syntax (`typeof EnumValue` vs `EnumValue`) - use better one
- [ ] Implement `CorrespondingTreeNodeKind<SplitPathKind>` and `CorrespondingSplitPathKind<TreeNodeKind>`
- [ ] Create helper types:
  - [ ] `SplitPathForTreeNodeKind<T>`
  - [ ] `TreeNodeKindForSplitPath<T>`
  - [ ] `NodeLocatorOf<NK>`
  - [ ] `SplitPathInsideLibrary<SK>`
  - [ ] `CanonicalSplitPathInsideLibrary<SK>`
  - [ ] `SegmentIdComponents<NK>`
- [ ] Add type-level tests for exhaustiveness
- [ ] Add round-trip tests for bidirectional mappings
- [ ] Document usage examples in JSDoc comments
- [ ] Update codec APIs in `plan-impl.md` to use generic types
