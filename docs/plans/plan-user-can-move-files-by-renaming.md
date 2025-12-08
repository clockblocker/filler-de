# Implementation Plan: Move Files by Renaming

## Summary

Split `canonicalizePrettyPath` into primitives. Add basename-authoritative mode to `onFileRenamed`.

---

## Phase 1: Extract primitives from `path-canonicalizer.ts`

### 1.1 Export `decodeBasename`

Currently private. Make it public:

```typescript
// Already exists, just export
export function decodeBasename(basename: string): DecodedBasename | null
```

**File:** `invariants/path-canonicalizer.ts`
**Tests:** Add unit tests for decode edge cases

### 1.2 Create `computeCanonicalPath` with authority param

New function that takes decoded basename + folder path + authority mode:

```typescript
export type Authority = "folder" | "basename";

export function computeCanonicalPath({
  decoded,
  folderPath,
  rootName,
  authority,
}: {
  decoded: DecodedBasename;
  folderPath: string[];  // pathParts without root
  rootName: RootName;
  authority: Authority;
}): CanonicalizedFile
```

**Logic:**
- `authority === "folder"`: current behavior (folder wins)
- `authority === "basename"`: decoded treePath wins, compute target folder from it

**File:** `invariants/path-canonicalizer.ts`
**Tests:** Unit tests for both authority modes

### 1.3 Refactor existing `canonicalizePrettyPath`

Rewrite to use new primitives internally:

```typescript
export function canonicalizePrettyPath({ rootName, prettyPath }) {
  const decoded = decodeBasename(prettyPath.basename);
  if (!decoded) return quarantineResult;
  
  const folderPath = sanitizeSegments(prettyPath.pathParts.slice(1));
  return computeCanonicalPath({
    decoded,
    folderPath,
    rootName,
    authority: "folder",  // existing behavior preserved
  });
}
```

**Tests:** Existing tests should pass unchanged

---

## Phase 2: Handle codex renames specially

### 2.1 Add codex detection in `onFileRenamed`

Before processing, check if file is codex → revert immediately:

```typescript
if (decoded?.kind === "codex") {
  // Revert: rename back to old path
  const revertAction = { type: RenameFile, from: newPath, to: oldPath };
  this.actionQueue.push(revertAction);
  return;
}
```

**File:** `librarian.ts`

---

## Phase 3: Basename-authoritative path in `onFileRenamed`

### 3.1 Detect basename-only change

```typescript
const oldParts = splitSystemPath(oldPath);
const newParts = splitSystemPath(file.path);

const pathPartsChanged = !arraysEqual(
  oldParts.pathParts, 
  newParts.pathParts
);
const basenameChanged = oldParts.basename !== newParts.basename;

const isSelfEvent = this.selfEventTracker.pop(oldPath) || 
                    this.selfEventTracker.pop(file.path);
if (isSelfEvent) return;

if (!basenameChanged) return; // nothing to do

if (pathPartsChanged) {
  // Folder move → existing behavior (folder authoritative)
} else {
  // Basename-only → NEW behavior (basename authoritative)
}
```

**File:** `librarian.ts`

### 3.2 Implement basename-authoritative branch

```typescript
// Basename-only change detected
const decoded = decodeBasename(newParts.basename);

if (!decoded) {
  // Undecodable → quarantine (existing logic)
  return;
}

if (decoded.kind === "codex") {
  // Revert codex rename (Phase 2)
  return;
}

if (decoded.kind === "page") {
  // Strip page number, treat as scroll
  // "000-book-bar-foo" → scroll "book" at path ["foo", "bar"]
  const scrollDecoded = {
    kind: "scroll",
    treePath: decoded.treePath.slice(0, -1), // drop page number
  };
  // ... continue with scrollDecoded
}

const canonical = computeCanonicalPath({
  decoded,
  folderPath: [], // ignored when basename-authoritative
  rootName,
  authority: "basename",
});

// Generate move action
const moveActions = [
  ...createFolderActionsForPathParts(canonical.canonicalPrettyPath.pathParts),
  { type: RenameFile, from: currentPrettyPath, to: canonical.canonicalPrettyPath },
];

this.selfEventTracker.register(moveActions);
this.actionQueue.pushMany(moveActions);
```

### 3.3 Add conflict resolution

Before move, check if target exists:

```typescript
const targetExists = await this.backgroundFileService.exists(
  canonical.canonicalPrettyPath
);

if (targetExists) {
  // Generate unique name: note_1, note_2, etc.
  canonical.canonicalPrettyPath.basename = generateUniqueName(
    canonical.canonicalPrettyPath.basename,
    existingNames
  );
}
```

**Helper function:**
```typescript
function generateUniqueName(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let i = 1;
  while (existing.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}
```

---

## Phase 4: Tree reconciliation + cleanup

### 4.1 Reconcile both old and new locations

After move completes:

```typescript
// Reconcile old parent (may now be empty)
await this.reconcileSubtree(rootName, oldParentPath);

// Reconcile new parent (has new note)
await this.reconcileSubtree(rootName, newParentPath);

// Regenerate codexes
await this.regenerateAllCodexes();
```

### 4.2 Cleanup handled by existing code

`cleanupOrphanFolders` in `healRootFilesystem` already handles empty folder cleanup.

---

## Phase 5: Tests

### 5.1 Unit tests for `path-canonicalizer.ts`

- `decodeBasename`: all file kinds, edge cases
- `computeCanonicalPath` with `authority: "folder"`: existing behavior
- `computeCanonicalPath` with `authority: "basename"`: new behavior

### 5.2 Unit tests for conflict resolution

- Target doesn't exist → no suffix
- Target exists → `_1` suffix
- Multiple conflicts → `_2`, `_3`, etc.

### 5.3 Integration tests (later)

- Full rename flow
- Codex revert
- Page → scroll conversion

---

## File Changes Summary

| File | Changes |
|------|---------|
| `invariants/path-canonicalizer.ts` | Export `decodeBasename`, add `computeCanonicalPath` |
| `librarian.ts` | New branch in `onFileRenamed` for basename-authoritative |
| `tests/.../path-canonicalizer.test.ts` | New tests for primitives |

---

## Order of Implementation

1. **Phase 1.1-1.2**: Extract/create primitives (no behavior change)
2. **Phase 1.3**: Refactor existing function (tests must pass)
3. **Phase 2**: Codex revert (simple, isolated)
4. **Phase 3.1-3.2**: Basename-authoritative detection + path
5. **Phase 3.3**: Conflict resolution
6. **Phase 4**: Reconciliation (should mostly work with existing code)
7. **Phase 5**: Tests throughout

---

## Risks / Mitigations

| Risk | Mitigation |
|------|------------|
| Break existing folder-move behavior | Phase 1.3 refactor must pass all existing tests |
| Infinite loop from self-triggered events | SelfEventTracker already handles; verify in tests |
| Performance with many files | Debounce already in place; single file ops are fast |
