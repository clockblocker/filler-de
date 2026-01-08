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
| `CreateCodex` | New section created | `WriteMdFile` |
| `UpdateCodex` | Content changed | `WriteMdFile` |
| `RenameCodex` | Section renamed/moved | `RenameMdFile` |
| `DeleteCodex` | Section deleted | `DeleteMdFile` |
| `WriteScrollStatus` | Status propagation to leaves | `UpdateMetaInfo` |

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
