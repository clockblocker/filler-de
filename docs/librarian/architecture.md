# Librarian Architecture

3-layer pipeline for file events. Layers execute sequentially; each layer is pure/testable.

```
Obsidian Event → Layer 1 (Heal) → Layer 2 (Tree) → Layer 3 (Codex)
```

## Layer 1: Filesystem Healing

- Single root invariant: root name is fixed to `Library` (one root only).

**Purpose:** Enforce filename invariant. Fix basename/folder mismatches.

**Functions:** `healFile()`, `healFiles()` in `filesystem/healing.ts`

**Input:** `CoreSplitPath` + `RootName`  
**Output:** `HealResult { actions, targetPath, quarantine }`

Pure, sync, no tree access. Returns `VaultAction[]` — caller executes.

## Layer 2: Tree Reconciliation

**Purpose:** In-memory state reflecting filesystem.

**State:** `LibraryTree` (single root; nodes = notes/sections with status)

**Functions:**
- `readNoteDtos()` — filesystem → `NoteDto[]`
- `tree.reconcile()` — apply notes to tree
- `tree.snapshot()` → before/after for diffing

## Layer 3: Diff → Codex Actions

**Purpose:** Generate codex updates from tree changes.

**Functions:** `mapDiffToActions()`, `regenerateCodexActions()` in `diffing/tree-diff-applier.ts`

**Input:** `NoteDiff` + `RootName`  
**Output:** `VaultAction[]` (create/update/trash codex files)

## Orchestrator: Librarian

Holds state, routes events through layers.

`Librarian` holds the tree, a `SelfEventTracker`, and an `ActionDispatcher`/queue.

### Event Flow: `onFileRenamed`

**Authority selection:** depends on what user changed.

| User changes | Authority | Result |
|--------------|-----------|--------|
| basename only | basename | Move file to decoded path |
| folder (pathParts) | folder | Rename basename to match |
| both | folder | Folder wins |

**Special cases:**
- Codex rename → revert immediately (auto-generated)
- Page rename → convert to scroll (strip page number)
- Conflict at target → unique suffix (`_1`, `_2`)

```
1. Detect: basename-only vs folder move
2. If codex → revert
3. If basename-only:
   - decodeBasename() → treePath
   - computeCanonicalPath(authority: "basename") → target
   - Create folders + move file
4. If folder move:
   - healFile() → fix basename (folder authoritative)
5. Debounce (100ms): collect affected roots
6. Flush:
   - healRootFilesystem() for each root
   - reconcileSubtree(root, [])
   - regenerateAllCodexes()
```

Debounce handles folder moves (N events → one pipeline run).

## Stateful vs Pure

| Component | State | Type |
|-----------|-------|------|
| `Librarian` | trees, tracker, queue | class |
| `LibraryTree` | nodes, parent refs | class |
| `SelfEventTracker` | pending keys | class |
| `VaultActionQueue` | pending actions | class |
| `healFile` | none | pure fn |
| `readNoteDtos` | none | pure fn |
| `mapDiffToActions` | none | pure fn |

## Key Utilities

| File | Purpose |
|------|---------|
| `utils/self-event-tracker.ts` | Prevent reacting to own events |
| `utils/folder-actions.ts` | Generate mkdir actions for path |
| `utils/path-conversions.ts` | `CoreSplitPath` ↔ `TreePath` ↔ `FullPath` |
| `invariants/path-canonicalizer.ts` | Canonical path computation |
| `indexing/codecs/` | Basename ↔ TreePath encoding |
