# Librarian Architecture

3-layer pipeline for file events. Layers execute sequentially; each layer is pure/testable.

```
User-triggered Obsidian Event → Vault Action Manager -> Layer 1 (Heal) → Layer 2 (Tree Reconciliation) → Layer 3 (Codex regeneration)
```

The goal of the Librarian is to watch over the "Library" folder and:
1) keep filenames in sync with their paths. For example:
- Library/parent/child/NoteBaseName-child-parent.md
- Library/doc/paper/Pekar/2025/The recency and geographical origins of the bat viruses ancestral to SARS_CoV and SARS_CoV_2-2025-Pekar-paper-doc.pdf
2) assist in navigation via genetaring and updating:
- metadata on md notes
- the codexes of the filesystem

## Layer 1: Filesystem Healing

**Purpose:** Enforce filename invariant. Fix basename/folder mismatches.
Litens to the user triggered events from Vault Action Manager.
Only cares about naming. Does not know or care about metadata / codexes.

1) If user creates a NEW file (Library/parent/filename.md), returns an Rename event to Library/parent/filename-parent.md
2) If user creates a NEW file (Library/parent/filename.md), returns an Rename event to Library/parent/filename-parent.md

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
