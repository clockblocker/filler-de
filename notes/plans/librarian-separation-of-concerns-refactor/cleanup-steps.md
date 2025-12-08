# Housekeeping Steps (Pre-refactor)

## 1. Extract `SelfEventTracker` utility

**Current:** Mixed into `Librarian` class
```
selfEventKeys: Set<string>
toSystemKey(prettyPath)
registerSelfActions(actions)
popSelfKey(path)
```

**Target:** `src/commanders/librarian/utils/self-event-tracker.ts`
```typescript
export class SelfEventTracker {
  private keys = new Set<string>();
  
  register(actions: VaultAction[]): void
  pop(path: string): boolean  // returns true if was self-event
}
```

**Why:** Isolates the "ignore our own events" logic. Reusable, testable.

**Pitfalls:**
- **Decision:** Keys are vault-relative path strings (`Library/parent/note.md`) - matches Obsidian `file.path`
- **Decision:** Only track file actions (RenameFile, TrashFile, UpdateOrCreateFile, ProcessFile) - Obsidian doesn't emit folder events
- **Decision:** Just pop per-event (no batch clear, no timeout cleanup)
- Obsidian rename may emit both delete+create → `pop()` must handle consuming once
- Thread safety if overlapping ops (unlikely in JS but async ordering matters)
- **Tests needed:** register → pop → returns true; double-pop → returns false; batch scenarios

---

## 2. Rename/clarify `DiffToActions`

**Current:** Does two things:
- `mapDiffToActions(diff)` → vault actions for notes
- `regenerateAllCodexes(...)` → codex generation

**Option A:** Rename to `TreeDiffApplier` (clearer intent)
**Option B:** Split into `NoteDiffApplier` + `CodexDiffApplier`

**Recommendation:** Option A for now, split later if needed.

**Pitfalls:**
- Ensure ALL imports updated (grep for `DiffToActions` across codebase)
- If later split, keep codex regen isolated so existing action tests stay stable
- Current tests in `tests/librarian/diffing/` must pass unchanged

---

## 3. Extract filesystem reading to `LibraryReader`

**Current:** In `Librarian`
```
readLibraryFilesInFolder(...)
readNotesFromFilesystem(...)
```

**Target:** `src/commanders/librarian/filesystem/library-reader.ts`
```typescript
export class LibraryReader {
  constructor(backgroundFileService)
  
  readFilesInFolder(folder: PrettyPath): Promise<LibraryFile[]>
  readNoteDtos(rootName, subtreePath?): Promise<NoteDto[]>
}
```

**Why:** Pure reading logic, no side effects. Useful for both healing and reconciliation.

**Pitfalls:**
- Specify types for `backgroundFileService` (fs read/exists) → avoid `any`
- Ensure it doesn't mutate anything (pure reader)
- Handle ignored files (`.dotfiles`) and `Untracked/` folder consistently with current logic
- **Decision:** Return only notes + codexes (no other file types)
- **Decision:** No max depth/size guard
- **Decision:** On error, return `[]` (fail silent)

---

## 4. Move `createFolderActionsForPathParts` to shared utils

**Current:** Private method in `Librarian`
**Target:** `src/commanders/librarian/utils/folder-actions.ts`

```typescript
export function createFolderActionsForPathParts(
  pathParts: string[],
  seen: Set<string>
): VaultAction[]
```

**Why:** Used by both healing and business operations. Pure function.

**Pitfalls:**
- **Decision:** Exclude root. JSDoc: "Assumes pathParts[0] exists; creates mkdir actions starting at depth 1"
- **Decision:** Keep original casing in `seen` keys (trust upstream, duplicate mkdir is harmless)
- **Test:** empty pathParts, single element, already-seen paths

---

## 5. Group business operations

**Current:** Mixed in `Librarian`
```
createNewNoteInCurrentFolder()
makeNoteAText()
setStatus()
addNotes()
deleteNotes()
```

**Target:** Keep in `Librarian` but mark clearly with comment section, OR extract to `LibrarianCommands` class that wraps `Librarian`.

**Recommendation:** Comment section for now, extract later.

**Pitfalls:**
- Watch for circular deps when utilities move (business ops → utils → types → ?)
- Keep side-effect boundaries clear: no fs ops in pure utils
- `makeNoteAText` is complex (text splitting + multiple file creation) → may need its own module later

---

## 6. Consolidate path type conversions

**Observation:** Multiple places convert between:
- `PrettyPath` (basename + pathParts)
- `TreePath` (array of node names)
- `FullPath` (system path info)

**Target:** `src/commanders/librarian/utils/path-conversions.ts`
```typescript
export function treePathToPrettyPath(treePath: TreePath, rootName: RootName): PrettyPath
export function prettyPathToTreePath(prettyPath: PrettyPath): TreePath
export function fullPathToTreePath(fullPath: FullPath): TreePath
```

**Why:** Currently scattered. Centralize for consistency.

**Pitfalls:**
- **Decision:** Use `toNodeName` from codecs as single slugger source
- **Decision:** Preserve casing/diacritics, only normalize spaces → `_` (already in `toNodeName`)
- **Decision:** Root-only `treePathToPrettyPath([])` returns codex path: `{ basename: "__Library", pathParts: ["Library"] }`
- **Tests:** round-trip conversions must be identity (tree→pretty→tree = original)
- Edge cases: empty paths, root-only paths, paths with special chars

---

## Execution Order

1. **SelfEventTracker** - minimal risk, clear boundary
   - Add unit tests: register/pop/batch scenarios
2. **folder-actions util** - pure function extraction
   - Add unit tests: edge cases for seen set, empty paths
3. **path-conversions util** - consolidate scattered logic
   - Add round-trip tests before touching code
4. **LibraryReader** - reading logic extraction
   - Verify existing tests still pass
5. **Rename DiffToActions** - optional, cosmetic
   - grep + update all imports
6. **Comment sections in Librarian** - organize before bigger split

**Principle:** Add small unit tests as you extract to confirm behavior parity before moving on.

---

## Files to Create

```
src/commanders/librarian/
├── utils/
│   ├── self-event-tracker.ts      [NEW]
│   ├── folder-actions.ts          [NEW]
│   └── path-conversions.ts        [NEW]
├── filesystem/
│   └── library-reader.ts          [NEW]
├── diffing/
│   ├── diff-to-actions.ts         [RENAME → tree-diff-applier.ts]
│   └── ...
└── librarian.ts                   [SLIM DOWN]
```

---

## What NOT to do yet

- Don't create `FilesystemHealer` yet - that's the main refactor
- Don't split event handlers yet - they'll change significantly
- Don't touch `LibraryTree` - it's already clean
- Don't touch codecs/indexing - orthogonal concern
