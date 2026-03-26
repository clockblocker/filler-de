# SelfEventTracker Review: Problems & Simplifications

## Task
Save this analysis to `src/managers/obsidian/vault-action-manager/refactor-proposal.md`

## Problems Found

### 1. Stale Comment (Line 241-243)
```typescript
// extractPaths returns: [...fromParents, fromTarget, ...toParents, toTarget]
// So the last path is the "to" target
```
**Wrong.** For file renames, `extractPaths` returns only `[from, to]` (no parents). Comment is from old implementation.

### 2. Duplicate Path in `extractPathsWithParents`
For folders, the loop generates `a`, `a/b`, `a/b/c` from pathParts `["a","b","c"]`. Then adds target path which for a folder IS `a/b/c`. Result: duplicate entry.

### 3. Parallel Tracking Structures
Three overlapping structures:
- `trackedPaths` (Map) - for filtering, has timeouts
- `registeredPaths` (Set) - for waiting
- `registeredFilePaths` (Set) - subset for verification

Same paths tracked in multiple places with different lifecycles. Confusing and error-prone.

### 4. RenameFolder Tracks Destination Parents
`extractPaths` for RenameFolder:
```typescript
return [
  ...this.extractPathsWithParents(action.payload.from),
  ...this.extractPathsWithParents(action.payload.to),  // includes parents!
];
```
But we just fixed `extractFolderPrefixes` to NOT track destination prefix. Inconsistent - exact path tracking still registers all destination parent folders.

## Simplification Opportunities

### A. Consolidate Tracking Structures
Merge `trackedPaths`, `registeredPaths`, `registeredFilePaths` into single structure:
```typescript
private readonly tracked = new Map<string, {
  timeout: ReturnType<typeof setTimeout>;
  isFilePath: boolean;  // for verification
}>();
```

### B. Fix `extractPathsWithParents` Duplication
Change loop to `i < pathParts.length` (exclusive) to avoid duplicate when target is folder.

### C. Remove Parent Tracking for RenameFolder Destination
Match the fix we did for prefixes - only track source parents, not destination parents.

### D. Simplify Waiter Pattern
Replace array of callbacks with single deferred promise that resets on new registration.

## Recommended Changes

| Issue | Priority | Fix |
|-------|----------|-----|
| Stale comment | Low | Update comment |
| Duplicate path | Medium | Fix loop bounds |
| Parallel structures | Low | Could consolidate but working fine |
| RenameFolder parents | Medium | Only track source parents |

## Files to Modify
- `src/managers/obsidian/vault-action-manager/impl/event-processing/self-event-tracker.ts`

## Verification
- Run `bun run test` - all 404 unit + e2e tests pass
