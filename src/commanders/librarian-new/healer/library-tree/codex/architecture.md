# Codex Architecture

## Purpose

Codex files are auto-generated markdown files that list section contents with status tracking.
Each section folder has a codex file `__SectionName.md` that:
- Shows all children (scrolls, files, subsections) with links
- Displays aggregated status (checkboxes)
- Provides parent backlink for navigation

## Pipeline

```
TreeAction[] (Create/Delete/Rename/Move/ChangeStatus)
    ↓
computeCodexImpact() → CodexImpact
    ↓
codexImpactToDeletions() → HealingAction[] (DeleteMdFile)
    +
codexImpactToRecreations() → CodexAction[] (UpsertCodex + WriteScrollStatus)
    +
extractScrollStatusActions() → WriteScrollStatusAction[] (from direct scroll changes)
    ↓
Merge: HealingAction[] + CodexAction[] + WriteScrollStatusAction[]
    ↓
healingActionsToVaultActions() + codexActionsToVaultActions() → VaultAction[]
    ↓
VaultActionManager.dispatch() (single dispatch with topological sort)
```

## Regeneration Strategy

Codex processing uses a **two-phase approach**:

**Phase 1: Deletions** (`codexImpactToDeletions`)
- Converts codex deletions to `DeleteMdFile` HealingActions
- Handles:
  - Sections explicitly deleted (`impact.deleted`)
  - Moved codexes with old suffix at new location (`impact.renamed` - when Obsidian moves folders, codex files move with them but keep old suffix)
  - Descendants of renamed sections (with old suffix at new location)

**Phase 2: Recreations** (`codexImpactToRecreations`)
- Uses **full regeneration approach** (similar to init):
  1. Collects ALL section chains from current tree state
  2. Generates `UpsertCodex` for all sections (ensures all codexes are up-to-date)
  3. Generates `WriteScrollStatus` for descendant scrolls when status propagates

Both phases are combined with healing actions and dispatched in a single batch. The `VaultActionManager`'s topological sort ensures correct ordering (deletes before creates when needed).

This approach is simpler and more reliable than tracking incremental changes, ensuring no orphaned codexes remain.

## CodexImpact

Computed from `TreeAction`, captures what changed:

| Field | When Populated |
|-------|----------------|
| `contentChanged` | Children added/removed/renamed, status changed |
| `renamed` | Section renamed/moved |
| `deleted` | Section deleted |
| `descendantsChanged` | Status change on section (propagates down) |

Impact always includes ancestors (status aggregates upward).

**Note**: Direct scroll status changes (from checkbox clicks) are not tracked in `CodexImpact`. Instead, `Librarian.processActions()` extracts them directly from `TreeAction[]` and generates `WriteScrollStatusAction` separately before merging with codex actions.

## CodexAction Types

| Action | Trigger | VaultAction |
|--------|---------|-------------|
| `UpsertCodex` | Section exists (create or update) | `UpsertMdFile` |
| `WriteScrollStatus` | Status propagation to leaves OR direct scroll status change | `ProcessMdFile` |

**Note:** 
- `UpsertCodex` replaces the old `CreateCodex`/`UpdateCodex` distinction - upsert handles both cases.
- Codex deletions are now handled as `DeleteMdFile` HealingActions (via `codexImpactToDeletions`), not as `DeleteCodex` CodexActions. This ensures proper ordering with healing actions in a single dispatch.

## Codex File Format

```markdown
 
⬆️ [[__ParentSection|ParentSection]] 

- [x] [[Scroll-Parent|Scroll]] 
- [[File-Parent|File]] 
- [x] [[__ChildSection|ChildSection]] 
  - [x] [[NestedScroll-ChildSection-Parent|NestedScroll]] 
```

### Structure
1. Parent backlink (if not root)
2. Children list with:
   - Scrolls: checkbox + link
   - Files: link only
   - Sections: checkbox (aggregated) + link + nested children

### Depth Control
- `maxSectionDepth`: how deep to show nested sections
- `showScrollsInCodexesForDepth`: at what depth scrolls appear

## Key Functions

| Function | Purpose |
|----------|---------|
| `computeCodexImpact` | TreeAction → CodexImpact |
| `collectImpactedSections` | Expand chains to include ancestors |
| `computeSectionStatus` | Aggregate status from descendants |
| `generateCodexContent` | SectionNode → markdown content |
| `computeCodexSplitPath` | Section chain → codex file path |
| `codexImpactToDeletions` | CodexImpact → HealingAction[] (DeleteMdFile) |
| `codexImpactToRecreations` | CodexImpact → CodexAction[] (UpsertCodex + WriteScrollStatus) |
| `codexActionsToVaultActions` | CodexAction[] → VaultAction[] |
| `codexImpactToActions` | (deprecated) CodexImpact → CodexAction[] |

## Status Aggregation

Section status computed from descendants:
- **Done**: all descendant scrolls are Done
- **NotStarted**: otherwise

Status flows:
- **Up**: leaf change → ancestors recalculate
- **Down**: section status change → all descendant leaves update
- **Direct**: scroll checkbox click → scroll metadata updated (via `extractScrollStatusActions` in `Librarian.processActions`)

## Naming Convention

Codex files use `__` prefix:
- `Library/__Library.md` - root codex
- `Library/Section/__Section.md` - section codex

The `__` prefix ensures codex sorts first and is visually distinct.
