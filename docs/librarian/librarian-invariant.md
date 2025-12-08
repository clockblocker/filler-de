# Filename Invariant

**Rule:** Every `.md` in Library roots encodes its tree path in the basename.

Example: `Library/parent/child/NOTE-child-parent.md` ↔ `["parent","child","NOTE"]`

## Policies

- **Quarantine:** Undecodable → `Library/Untracked/` (excluded from tree/codex)
- **Auto-heal:** Rename/move silently; no prompt; content untouched
- **Case-insensitive:** `isCanonical` compares lowercase (macOS compat)
