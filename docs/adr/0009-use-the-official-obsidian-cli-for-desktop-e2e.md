---
status: accepted
---

# Use the official Obsidian CLI for desktop E2E

Desktop E2E tests use the official Obsidian CLI and a test-only plugin with a typed protocol against a dedicated vault. This adds host and harness cost, but it tests the real plugin lifecycle, Obsidian callbacks, and event timing without raw renderer evaluation.

## Consequences

- Desktop E2E requires a logged-in desktop session.
- Scenario code uses typed actions and snapshots only.
- The GUI executable is not a supported CLI substitute.
- Domain-only behavior stays in deterministic in-process tests.
