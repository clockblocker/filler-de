# Filename Invariant

**Rule:** Every `.md` in Library roots encodes its tree path in the basename.

Example: `Library/parent/child/NOTE-child-parent.md` ↔ `["parent","child","NOTE"]`

## Authority Modes

| User action | Authority | Behavior |
|-------------|-----------|----------|
| Rename basename only | basename | File moves to path encoded in basename |
| Move to different folder | folder | Basename recomputed to match folder |
| Both change | folder | Folder wins |

**Move via rename:** User can relocate files by editing basename.
- `Library/foo/note-foo.md` → rename to `note-bar-baz.md` → moves to `Library/baz/bar/note-bar-baz.md`

## Policies

- **Quarantine:** Undecodable → `Library/Untracked/` (excluded from tree/codex)
- **Auto-heal:** Rename/move silently; no prompt; content untouched
- **Case-insensitive:** `isCanonical` compares lowercase (macOS compat)
- **Codex:** User renames reverted immediately (auto-generated)
- **Page files:** Basename rename converts to scroll (page number stripped)
- **Conflicts:** Target exists → unique suffix (`_1`, `_2`)
