# Move Files by Renaming

## Goal

Allow users to relocate notes by editing the basename (which encodes tree path).

## Current Behavior

**PathParts always authoritative** — basename recomputed to match folder.

```
"Library/foo/test1-foo.md" → rename to "test1-bar-bas.md"
→ healed BACK to "test1-foo.md" (folder wins)
```

## Desired Behavior

| User changes | Authoritative | Result |
|--------------|---------------|--------|
| basename only | basename | Move file to decoded path |
| pathParts (folder move) | pathParts | Rename basename to match |
| both | pathParts | Folder move wins |

### Examples

1. **Basename change → move**
   ```
   "Library/foo/test1-foo.md" → "Library/foo/test1-bar-bas.md"
   → MOVE to "Library/bas/bar/test1-bar-bas.md"
   ```

2. **Nested note creation**
   ```
   "Library/foo/test1-foo.md" → "Library/foo/0-test1-foo.md"
   → MOVE to "Library/foo/test1/0-test1-foo.md"
   ```

3. **Folder move (unchanged)**
   ```
   "Library/foo/test1-foo.md" → "Library/bar/test1-foo.md"
   → RENAME to "Library/bar/test1-bar.md"
   ```

---

## Detection Logic

In `onFileRenamed(file, oldPath)`:

```typescript
const oldParts = split(oldPath);  // { pathParts, basename }
const newParts = split(file.path);

const pathPartsChanged = !arraysEqual(oldParts.pathParts, newParts.pathParts);
const basenameChanged = oldParts.basename !== newParts.basename;

if (pathPartsChanged) {
  // Folder move → pathParts authoritative (current behavior)
} else if (basenameChanged) {
  // Basename-only change → basename authoritative (NEW)
}
```

---

## Architecture Changes

### Option C: Split into primitives

```typescript
// Low-level: just decode
function decodeBasename(basename): DecodedBasename | null

// High-level: caller decides authority
function computeCanonicalPath(decoded, folderPath, authority: "folder" | "basename")
```

---

## Implementation Steps

1. **Add detection** in `onFileRenamed` — compare old/new pathParts
2. **Add BasenameAuthoritative path** — new function or mode
3. **Create missing folders** — extend `createFolderActionsForPathParts`
4. **Update tree** — reconcile old + new locations
5. **Cleanup empty sections** — existing `cleanupEmptySections` should handle

---

## Questions / Concerns

### 0. Authority selection
Q: How to detect "system-triggered" reliably?
A: We have a SelfEventTracker for this

### 1. Conflict policy
Target already exists — what to do?
- Generate unique name (e.g. `note_1`, `note_2`. mind that dashes "-" are reserved for splitting pathes)?

### 2. Undecodable basename
Q: User types gibberish or malformed name — still quarantine?
A: We have a toNodeName guard. All user renames must path through it. After this passes, it's no longer gibberish, but a valid "str-str".

### 3. Cross-root moves
Q: Basename encodes path in different root (e.g. `test1-Worter-foo` while in `Library/`)
A: Name does not include the current root. 
"test1-Worter-foo" is a valid name for "Library/foo/Worter/test1-Worter-foo.md"
what happent in "Worter" root -- is not a concearn

### 4. Page/book files
Basename carries page number (`000-book-foo.md`) — moving is tricky
Moving single pages does not make sence, but we shall not stricly disallow it 
- Ideally, move of one page shall trigger move of the whole book. Might be too hard to implementl though.
- Alternative is to strip "000" from a moved page and treat it as a scroll
so "000-book-foo.md" -> "000-book-bar-foo.md" results in "foo/bar/book-bar-foo.md"

### 5. Codex files
Codex (`__foo.md`) is auto-generated — user renames it
- Revert rename immediately
- Codexes have to be renameable to user bc Obsidian

### 6. Event handling
Current debounce (100ms) handles folder moves (N events)
- Option: Keep debounce for consistency. It's quick enough

### 7. Folder creation & cleanup
Move may require new folders and leave old ones empty
- Creating: `createFolderActionsForPathParts` should handle
- Cleanup: existing `cleanupEmptySections` + `cleanupOrphanFolders`
- Order matters: create target before move, cleanup after
Q: What if folder creation fails (permissions, name conflict)? 
A: Idk, what do we do currenly?

### 8. Self-event tracking
Our move triggers another `onFileRenamed` — must not loop
- Current `SelfEventTracker` should handle
- Need to register both old and new paths? Idk, how we do it currenly?
- Edge: rapid user rename during our move? Their problem if so

### 9. Testing/perf
Comprehensive testing needed: only test pure func though. E2E will come later.

### 10. Undo/Redo
Obsidian has no native undo for file operations
- User moves file via rename, wants to undo? Just let them rename again. Our job is to handle renames consistenly

### 11. Architecture choice
Pick approach to implement BasenameAuthoritative path:
- Option C: split primitives (decode + compute with authority)

---

## Testing Scenarios

- [ ] Basename change → file moves to new location
- [ ] Intermediate folders created
- [ ] Old empty sections cleaned up
- [ ] Codexes regenerated (old + new locations)
- [ ] Conflict: target exists
- [ ] Invalid/undecodable new basename → quarantine
- [ ] Page file move
- [ ] Codex file rename (should revert or ignore)
- [ ] Self-event tracking prevents loops
