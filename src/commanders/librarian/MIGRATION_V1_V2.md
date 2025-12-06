# Librarian V1 → V2 Migration

## TL;DR
Flattened 3-tier tree (`Section→Text→Page`) to 2-tier (`Section→Note`). Replaced `TextDto.pageStatuses` with flat `NoteDto.status`.

## Data Model Changes

### V1 (Legacy)
```
TextDto = { path: TreePath, pageStatuses: Record<string, TextStatus> }
Tree: SectionNode → TextNode → PageNode
NodeType: TEXT | SECTION | PAGE
```

### V2 (Current)
```
NoteDto = { path: TreePath, status: TextStatus }
Tree: SectionNodeV2 → NoteNode
NodeTypeV2: SECTION | NOTE
```

## Key Insight: Books vs Scrolls

**V1:** Explicit distinction - `TextNode` with 1 child = scroll, >1 children = book.

**V2:** Implicit distinction via path structure:
- **Scroll:** `NoteNode` at `['Section', 'ScrollName']`
- **Book page:** `NoteNode` at `['Section', 'BookName', '000']` (numeric suffix)
- **Book:** `SectionNodeV2` containing multiple page `NoteNode`s

Detection helper: `isBookPage(path)` checks if last segment matches `/^\d{3}$/`

## File Mapping

| V1 File | V2 File | Purpose |
|---------|---------|---------|
| `librarian.ts` | `librarian-v2.ts` | Main orchestrator |
| `library-tree.ts` | `library-tree-v2.ts` | Tree structure |
| `diffing/tree-differ.ts` | `diffing/note-differ.ts` | Snapshot comparison |
| `diffing/diff-to-actions.ts` | `diffing/diff-to-actions-v2.ts` | Diff → VaultAction[] |
| `text-Dtos-From-Library-File-Dtos.ts` | `note-dtos-from-library-file-dtos.ts` | FileDTO → TreeDTO |

## Snapshots

**V1:** `TreeSnapshot = { texts: TextDto[], sectionPaths: TreePath[] }`
**V2:** `NoteSnapshot = { notes: NoteDto[], sectionPaths: TreePath[] }`

## Current Status

### ✅ Completed
- `LibraryTreeV2` - full tree operations
- `NoteDiffer` - snapshot diffing
- `DiffToActionsV2` - action generation (partial)
- `LibrarianV2` - main class integration
- `noteDtosFromLibraryFileDtos` - filesystem adapter

### ✅ COMPLETED
1. ~~**`DiffToActionsV2.generateCodexContent()`** - returns empty string!~~ ✅ Fixed - created `CodexGeneratorV2`
2. ~~Update `handle-checkbox-clicked.ts` type import~~ ✅ All imports updated to `LibrarianV2`
3. ~~Delete V1 files after full validation~~ ✅ V1 files removed
4. ~~Update integration tests~~ ✅ V1 tests removed, V2 tests retained

## Codex Generation (BLOCKING BUG)

V1 had `CodexGenerator` that understood `TextNode`/`PageNode`. V2 needs equivalent for `SectionNodeV2`/`NoteNode`.

Current behavior: Status toggle → diff detected → codex update action queued → **empty content written** → codex blanked.

Fix: Implement `generateCodexContent()` in `diff-to-actions-v2.ts` or create `codex-generator-v2.ts`.


---

Issue logs:

[handleCheckboxClicked] Setting status: {href: '001-Mann_gegen_mann-Rammstein-Songs', rootName: 'Library', treePath: Array(4), newStatus: 'NotStarted'}
[LibrarianV2] [setStatus] called: {path: Array(4), rootName: 'Library', status: 'NotStarted'}
[LibrarianV2] [setStatus] parentPath: (3) ['Songs', 'Rammstein', 'Mann_gegen_mann']
[LibrarianV2] [withDiffSync] BEFORE snapshot: {notes: Array(11), sectionPaths: Array(5)}
[LibrarianV2] [setStatus] calling tree.setStatus
[LibraryTreeV2] [setStatus] path: (4) ['Songs', 'Rammstein', 'Mann_gegen_mann', '001'] status: NotStarted
[LibraryTreeV2] [setStatus] found node: 001 current status: Done
[LibraryTreeV2] [setStatus] changing status from Done to NotStarted
[LibraryTreeV2] [setStatus] after recompute, node status: NotStarted
[LibrarianV2] [withDiffSync] AFTER snapshot: {notes: Array(11), sectionPaths: Array(5)}
[LibrarianV2] [withDiffSync] DIFF: {addedNotes: Array(0), addedSections: Array(0), removedNotes: Array(0), removedSections: Array(0), statusChanges: Array(1)}
[DiffToActionsV2] Processing diff: {addedNotes: 0, addedSections: 0, removedNotes: 0, removedSections: 0, statusChanges: 1}
[DiffToActionsV2] Processing status change: {newStatus: 'NotStarted', oldStatus: 'Done', path: Array(4)}
[DiffToActionsV2] Is book page, adding book path: (3) ['Songs', 'Rammstein', 'Mann_gegen_mann']
[DiffToActionsV2] Affected codex paths: (4) ['Songs/Rammstein/Mann_gegen_mann', '', 'Songs', 'Songs/Rammstein']
[DiffToActionsV2] Checking codex path: Songs/Rammstein/Mann_gegen_mann -> (3) ['Songs', 'Rammstein', 'Mann_gegen_mann']
[LibrarianV2] [getNode] found: (3) ['Songs', 'Rammstein', 'Mann_gegen_mann'] Section
[DiffToActionsV2] Node at path: (3) ['Songs', 'Rammstein', 'Mann_gegen_mann'] Section
[DiffToActionsV2] Adding codex update for: (3) ['Songs', 'Rammstein', 'Mann_gegen_mann']
[DiffToActionsV2] [generateCodexContent] path: (3) ['Songs', 'Rammstein', 'Mann_gegen_mann']
[DiffToActionsV2] [generateCodexContent] RETURNING EMPTY - CODEX WILL BE BLANK!
generateCodexContent updateCodexAction 
mapDiffToActions 
withDiffSync 
withDiff 
await in withDiff
setStatus 
handleCheckboxClicked eval 
[DiffToActionsV2] Checking codex path:  -> []
[LibrarianV2] [getNode] found: [] Section
[DiffToActionsV2] Node at path: [] Section
[DiffToActionsV2] Adding codex update for: []
[DiffToActionsV2] [generateCodexContent] path: []
[DiffToActionsV2] [generateCodexContent] RETURNING EMPTY - CODEX WILL BE BLANK!
generateCodexContent updateCodexAction 
mapDiffToActions 
withDiffSync 
withDiff 
await in withDiff
setStatus 
handleCheckboxClicked eval 
[DiffToActionsV2] Checking codex path: Songs -> ['Songs']
[LibrarianV2] [getNode] found: ['Songs'] Section
[DiffToActionsV2] Node at path: ['Songs'] Section
[DiffToActionsV2] Adding codex update for: ['Songs']
[DiffToActionsV2] [generateCodexContent] path: ['Songs']
[DiffToActionsV2] [generateCodexContent] RETURNING EMPTY - CODEX WILL BE BLANK!
generateCodexContent updateCodexAction 
mapDiffToActions 
withDiffSync 
withDiff 
await in withDiff
setStatus 
handleCheckboxClicked eval 
[DiffToActionsV2] Checking codex path: Songs/Rammstein -> (2) ['Songs', 'Rammstein']
[LibrarianV2] [getNode] found: (2) ['Songs', 'Rammstein'] Section
[DiffToActionsV2] Node at path: (2) ['Songs', 'Rammstein'] Section
[DiffToActionsV2] Adding codex update for: (2) ['Songs', 'Rammstein']
[DiffToActionsV2] [generateCodexContent] path: (2) ['Songs', 'Rammstein']
[DiffToActionsV2] [generateCodexContent] RETURNING EMPTY - CODEX WILL BE BLANK!
generateCodexContent updateCodexAction 
mapDiffToActions 
withDiffSync 
withDiff 
await in withDiff
setStatus 
handleCheckboxClicked eval 
[LibrarianV2] [withDiffSync] ACTIONS: 5 (5) [{…}, {…}, {…}, {…}, {…}]