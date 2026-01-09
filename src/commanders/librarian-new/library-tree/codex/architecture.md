# Codex Architecture

## Purpose

Codex files are auto-generated markdown files that list section contents with status tracking.
Each section folder has a codex file `__SectionName.md` that:
- Shows all children (scrolls, files, subsections) with links
- Displays aggregated status (checkboxes)
- Provides parent backlink for navigation

## Pipeline

```
TreeAction (Create/Delete/Rename/Move/ChangeStatus)
    ↓
computeCodexImpact() → CodexImpact
    ↓
codexImpactToActions() → CodexAction[]
    ↓
codexActionsToVaultActions() → VaultAction[]
    ↓
VaultActionManager.dispatch()
```

## Regeneration Strategy

`codexImpactToActions` uses a **full regeneration approach** (similar to init):
1. Collects ALL section chains from current tree state
2. Generates `UpsertCodex` for all sections (ensures all codexes are up-to-date)
3. Deletes old codexes:
   - Sections explicitly deleted (`impact.deleted`)
   - Moved codexes with old suffix at new location (`impact.renamed` - when Obsidian moves folders, codex files move with them but keep old suffix)

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

## CodexAction Types

| Action | Trigger | VaultAction |
|--------|---------|-------------|
| `UpsertCodex` | Section exists (create or update) | `UpsertMdFile` |
| `DeleteCodex` | Section deleted or moved (old codex with wrong suffix) | `TrashMdFile` |
| `WriteScrollStatus` | Status propagation to leaves | `ProcessMdFile` |

**Note:** `UpsertCodex` replaces the old `CreateCodex`/`UpdateCodex` distinction - upsert handles both cases. `RenameCodex` is no longer used; renames are handled as delete old + upsert new.

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
| `codexImpactToActions` | CodexImpact → CodexAction[] |
| `codexActionsToVaultActions` | CodexAction[] → VaultAction[] |

## Status Aggregation

Section status computed from descendants:
- **Done**: all descendant scrolls are Done
- **NotStarted**: otherwise

Status flows:
- **Up**: leaf change → ancestors recalculate
- **Down**: section status change → all descendant leaves update

## Naming Convention

Codex files use `__` prefix:
- `Library/__Library.md` - root codex
- `Library/Section/__Section.md` - section codex

The `__` prefix ensures codex sorts first and is visually distinct.
