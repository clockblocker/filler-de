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
- Obsidian-specific coordination is centralized while VAM remains unaware of Sections, Scrolls, Codexes, and Healing.
- A VAM Dispatch Batch is ordered and executed sequentially, not committed atomically. If a later action fails, already completed actions are not rolled back, and the returned `DispatchResult` reports accumulated errors.
