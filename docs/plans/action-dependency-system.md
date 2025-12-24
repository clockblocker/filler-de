# Action Dependency System - Systemic Solution

## Problem Statement

Current issues:
1. **Implicit dependencies**: Actions depend on each other (e.g., ProcessMdFile needs file to exist) but dependencies aren't explicit
2. **ensureAllDestinationsExist conflicts**: Adds empty UpsertMdFile actions that can overwrite user content
3. **Sorting limitations**: Weight-based sorting doesn't handle same-file dependencies within weight groups
4. **Collapse edge cases**: Empty content vs. user content conflicts

## Proposed Solution: Explicit Dependency Graph

### Phase 1: Dependency Detection

Add a dependency resolver that analyzes actions and builds a dependency graph:

```typescript
type ActionDependency = {
  action: VaultAction;
  dependsOn: VaultAction[]; // Actions that must execute before this one
  requiredBy: VaultAction[]; // Actions that require this one
};

function buildDependencyGraph(actions: VaultAction[]): ActionDependency[] {
  // Rules:
  // - ProcessMdFile/UpsertMdFile depends on UpsertMdFile for same file
  // - Rename actions depend on CreateFolder for destination parents
  // - Trash actions have no dependencies
}
```

### Phase 2: Smart ensureAllDestinationsExist

Instead of blindly adding UpsertMdFile(""), use dependency analysis:

```typescript
private ensureAllDestinationsExist(actions: VaultAction[]): VaultAction[] {
  // 1. Analyze what files/folders are needed
  // 2. Check if they're already created in the batch
  // 3. Only add missing ones
  // 4. Mark them as "system-generated" to avoid conflicts
}
```

### Phase 3: Dependency-Aware Sorting

Enhance sorting to respect dependencies:

```typescript
function sortActionsByDependencies(actions: VaultAction[]): VaultAction[] {
  // 1. Build dependency graph
  // 2. Topological sort (Kahn's algorithm)
  // 3. Within same level, use weight + path depth
}
```

### Phase 4: Collapse with Dependency Awareness

Make collapse respect dependencies:

```typescript
async function collapseActions(
  actions: VaultAction[],
  dependencies: ActionDependency[]
): Promise<VaultAction[]> {
  // When collapsing, preserve dependency relationships
  // E.g., if UpsertMdFile("initial") + ProcessMdFile collapse,
  // ensure UpsertMdFile executes first
}
```

## Implementation Strategy

### Option A: Incremental (Recommended)
1. ✅ Fix ensureAllDestinationsExist to check existing actions (DONE)
2. ✅ Enhance sorting for same-file dependencies (DONE)
3. Add dependency markers to actions (optional metadata)
4. Gradually migrate to explicit dependency system

### Option B: Full Refactor
1. Build complete dependency graph system
2. Replace weight-based sorting with topological sort
3. Make collapse dependency-aware
4. Add comprehensive tests

## Benefits

1. **Explicit dependencies**: Clear what depends on what
2. **No conflicts**: System-generated actions don't overwrite user actions
3. **Correct ordering**: Dependencies guaranteed by topological sort
4. **Easier debugging**: Can visualize dependency graph
5. **Future-proof**: Easy to add new action types with dependencies

## Migration Path

1. Keep current system working (fixes applied)
2. Add dependency detection as optional metadata
3. Gradually migrate critical paths to use dependencies
4. Eventually replace weight-based sorting entirely

## Questions

1. Should dependencies be explicit in action types, or computed?
2. Do we need to handle circular dependencies? (probably not for file ops)
3. Should system-generated actions be marked differently?
4. Performance: Is topological sort fast enough for typical batch sizes?

