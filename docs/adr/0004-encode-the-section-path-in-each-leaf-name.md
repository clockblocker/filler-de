---
status: accepted
---

# Encode the Section path in each leaf name

The Librarian appends the reverse-ordered Section chain to every leaf Core Name. This gives each leaf a vault-wide basename and preserves its intended Library position after a move, at the cost of renaming descendant leaves when a Section changes.

## Consequences

- The Library root is not part of the suffix.
- Sections do not have suffixes.
- Section rename and move operations can cause many leaf renames.
