# Librarian Architecture

3-layer pipeline for file events. Layers execute sequentially; each layer is pure/testable.

```
Obsidian Event → Layer 1 (Heal) → Layer 2 (Tree) → Layer 3 (Codex)
```

## Layer 1: Filesystem Healing

**Purpose:** Enforce filename invariant. Fix basename/folder mismatches.

**Functions:** `healFile()`, `healFiles()` in `filesystem/healing.ts`

**Input:** `PrettyPath` + `RootName`  
**Output:** `HealResult { actions, targetPath, quarantine }`

Pure, sync, no tree access. Returns `VaultAction[]` — caller executes.

## Layer 2: Tree Reconciliation

**Purpose:** In-memory state reflecting filesystem.

**State:** `LibraryTree` per root (nodes = notes/sections with status)

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

```typescript
class Librarian {
  trees: Record<RootName, LibraryTree>
  selfEventTracker: SelfEventTracker
  actionQueue: VaultActionQueue
}
```

### Event Flow: `onFileRenamed`

```
1. Immediate heal: healFile(path) → fix basename
2. Debounce (100ms): collect affected roots
3. Flush:
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
| `utils/path-conversions.ts` | `PrettyPath` ↔ `TreePath` ↔ `FullPath` |
| `invariants/path-canonicalizer.ts` | Canonical path computation |
| `indexing/codecs/` | Basename ↔ TreePath encoding |
