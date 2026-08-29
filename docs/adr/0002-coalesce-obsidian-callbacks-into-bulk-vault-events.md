---
status: accepted
---

# Coalesce Obsidian callbacks into Bulk Vault Events

VAM groups related Obsidian create, rename, and delete callbacks into a `BulkVaultEvent` before notifying the Librarian. It filters expected Self Events, collapses duplicate events and rename chains, and identifies Semantic Roots so a folder operation is interpreted as one user intention rather than a cascade of independent descendant changes.

## Considered Options

- Let the Librarian consume each Obsidian callback immediately.
- Put event buffering and folder-cascade detection inside the Librarian.
- Make bulk-event normalization part of VAM's domain-neutral event boundary.

## Consequences

- The Librarian consumes `subscribeToBulk()` and does not reconstruct user operations from individual callbacks.
- `events` retains normalized evidence needed for creates and Library-boundary crossings, while `roots` identifies independent rename and delete intent.
- Time-windowed coalescing introduces a small delay and makes the bulk window part of event semantics, but keeps Obsidian's callback shape and timing out of the Library model.
