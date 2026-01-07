# Librarian Architecture

## Business Purpose

The Librarian maintains a **Library** folder in an Obsidian vault with two invariants:

1. **Filename ⇄ Path Invariant (bidirectional)**
   - Path → canonical filename: files include parent folder names as suffix chain
   - Filename suffix → canonical path: suffix chain determines folder hierarchy

2. **Codex files** (out of scope for now)

### Canonical Format

- **Sections (folders)**: basename = single NodeName (no delimiter)
- **Leaves (files)**: basename = `coreName-suffix1-suffix2-...` where suffixes are parent folder names (deepest first)

Example:
```
Library/recipe/pie/Note.md → Library/recipe/pie/Note-pie-recipe.md
Library/Note-pie-recipe.md → Library/recipe/pie/Note-pie-recipe.md
```

## Pipeline

```
Obsidian API
    ↓
VaultActionManager (BulkVaultEvent)
    ↓
buildTreeActions() → TreeAction[]
    ↓
LibraryTree.apply() → HealingAction[]
    ↓
healingActionsToVaultActions() → VaultAction[]
    ↓
VaultActionManager.dispatch()
    ↓
Obsidian API
```

## Key Components

### VaultActionManager
- Groups low-level filesystem callbacks into **BulkVaultEvent** windows
- Filters out system-triggered events (prevents feedback loops)
- Normalizes/collapses redundant events
- Extracts semantic root events (folder rename covers descendants)

### buildTreeActions (Adapter Layer)
Converts `BulkVaultEvent` → `TreeAction[]` through layers:

1. **Library Scope**: filters events inside Library, classifies boundary crossings
2. **Materialization**: expands root events into per-node events
3. **Translation**: converts to semantic TreeActions with policy/intent inference

### Policy & Intent Inference

**Policy** (how to canonicalize):
- **NameKing**: basename suffix defines path (flat files at Library root)
- **PathKing**: folder path defines suffix (nested files)

**Intent** (what user meant):
- **Rename**: basename changed, suffix matches path → in-place rename
- **Move**: path changed OR suffix differs from path → relocate node

### LibraryTree
- Mutable tree structure: root → sections → leaves
- `apply(action)` mutates tree, returns `HealingAction[]`
- Sections auto-created on leaf creation, auto-pruned on delete
- Computes healing for mismatches between observed and canonical paths

### HealingAction → VaultAction
Library-scoped healing actions converted to vault-scoped actions for dispatch.

## Runtime Flow

1. **Init**: read Library filesystem, create tree, dispatch initial healing
2. **Steady-state**: listen to events → build actions → apply to tree → dispatch healing
3. **Queue**: events processed sequentially to maintain consistency

## Conventions

- `pathParts` and `segmentIdChainToParent`: include Library root (e.g., `["Library", "A", "B"]`)
- `suffixParts`: exclude Library root, reversed (e.g., `["B", "A"]`)
- Suffix delimiter: configurable (default `-`)

