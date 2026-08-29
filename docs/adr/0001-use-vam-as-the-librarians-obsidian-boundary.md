---
status: accepted
---

# Use VAM as the Librarian's Obsidian boundary

The Librarian reads vault state, subscribes to vault changes, and requests filesystem changes through the Vault Action Manager rather than depending directly on Obsidian's `App`, `Vault`, `FileManager`, or `DataAdapter`. VAM owns typed paths, dispatch coordination, active-file handling, and event attribution; the Librarian owns Library meaning and Healing.

## Considered Options

- Call Obsidian APIs directly throughout the Librarian.
- Replace or wrap Obsidian's low-level `DataAdapter` for bulk operations.
- Use the project-level VAM facade as the Librarian's port to Obsidian.

## Consequences

- Librarian and Library Core contracts use `SplitPath`, `VaultAction`, and `VaultEvent` instead of live `TFile` or `TFolder` references.
- System paths cross the package seam through the single public `splitPathCodec`. Conversions involving live Obsidian file and folder references remain inside VAM's implementation.
- Obsidian-specific coordination is centralized while VAM remains unaware of Sections, Scrolls, Codexes, and Healing.
- A VAM Dispatch Batch is ordered and executed sequentially, not committed
  atomically. Planning failures happen before execution; action failures are
  returned as typed `VamDispatchError` values after all planned actions have
  been attempted.
- The Librarian's reconciliation boundary treats action failure as execution
  uncertain. It records a partial outcome and completes a VAM-backed Tree
  resynchronization before serialized work may continue. It never claims that
  VAM or Tree work was rolled back when it was not.
