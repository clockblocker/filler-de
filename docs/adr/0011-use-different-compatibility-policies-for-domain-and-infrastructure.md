---
status: accepted
---

# Use different compatibility policies for domain and infrastructure

Textfresser note formats, prompt DTOs, and intermediate vocabulary contracts are green-field. They may change without compatibility during active design. Librarian and VAM contracts are stability-critical because they control persisted Library state and vault I/O, so changes require migration analysis and explicit regression coverage.

## Consequences

- Textfresser does not add compatibility layers without a current data requirement.
- Librarian and VAM persisted-contract changes need a migration plan.
- Librarian and VAM changes need deterministic and desktop regression coverage where applicable.
