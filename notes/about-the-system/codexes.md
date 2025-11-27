# Codexes

System-managed navigation + TODO files for the Library.

## Purpose
1. Navigate hierarchical text structure
2. Track reading progress via checkboxes
3. Auto-sync with actual file states

## Codex Structure

```
[[ParentCodex|← ParentName]]        ← back navigation

- [ ] [[ChildCodex|DisplayName]]    ← checkbox list (recursive)
	- [ ] [[GrandchildCodex|Name]]
```

## Example

```md
*__Library.md*

[[Root|← Root]]
- [ ] [[__Avatar|Avatar]]
	- [ ] [[__Season_1-Avatar|Season 1]]
		- [ ] [[__Episode_1-Season_1-Avatar|Episode 1]]
		- [ ] [[__Episode_2-Season_1-Avatar|Episode 2]]
- [ ] [[__Songs|Songs]]
	- [ ] [[__Rammstein-Songs|Rammstein]]
		- [ ] [[Sonne-Rammstein-Songs|Sonne]]

*__Episode_1-Season_1-Avatar.md* (Book Codex)

[[__Season_1-Avatar|← Season 1]]
- [ ] [[000-Page-Episode_1-Season_1-Avatar|Page 1]]
- [ ] [[001-Page-Episode_1-Season_1-Avatar|Page 2]]
```

## Codex Types

| Context | Lists | Example |
|---------|-------|---------|
| Section Codex | Children (Sections + Texts) nested | `__Library.md` shows Avatar, Songs... |
| Book Codex | Page flat | `__Episode_1-Season_1-Avatar.md` shows 000, 001... |

## Naming Convention

| Type | Format | Example |
|------|--------|---------|
| Codex | `__<reversed-path>.md` | `__Rammstein-Songs.md` |

TreePath → Filename:
```
['Songs', 'Rammstein'] → __Rammstein-Songs.md
```

## Checkbox ↔ Status Mapping

| Status | Checkbox |
|--------|----------|
| `Done` | `[x]` |
| `NotStarted` | `[ ]` |
| `InProgress` | `[ ]` |

## Sync Behavior

1. **Tree → Codex**: Status change propagates to Codex checkbox
2. **User → Tree**: Manual checkbox edit updates tree status
3. **Structure**: Always regenerated from tree (tree is source of truth)

## Codex Lifecycle

| Event | Action |
|-------|--------|
| Create Section/Book | Create Codex file |
| Delete Section/Book | Delete Codex file |
| Rename Section/Book | Rename Codex + update parent |
| Add/Remove Page | Update Book's Codex |
| Move Text | Update old + new parent Codexes |
| Status change | Update affected Codex checkboxes |

## Notes

- Scrolls (single-page texts) don't get Codex files
- Root Library Codex has no back link (or links to vault root)
- Codex content is auto-generated, manual structure edits get overwritten

