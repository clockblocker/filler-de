---
status: accepted
---

# Use one Effect runtime inside VAM

The Vault Action Manager creates one managed Effect runtime and exposes environment-free Effects from its package root. This centralizes queues, fibers, listeners, timing, typed failures, and shutdown, while the plugin remains the only execution and lifecycle owner.

## Consequences

- VAM implementation modules return programs and do not create runtimes.
- Pure planning and codec functions remain ordinary TypeScript.
- Callers compose VAM Effects and the plugin runs them.
- VAM shutdown must close all owned resources and pending work.
