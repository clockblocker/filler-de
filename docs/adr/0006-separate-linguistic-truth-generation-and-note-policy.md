---
status: accepted
---

# Separate linguistic truth, generation, and note policy

`@textfresser/linguistics` owns native linguistic schemas and operations through one root API. Lexical generation owns model workflows and generation DTOs, while Textfresser owns note format, paths, IDs, tags, labels, and vault coordination.

## Consequences

- Consumers must not use deep linguistics imports.
- Lexical generation can use flat provider contracts, but it must convert them to native linguistic data.
- Lexical generation must not expose prompt dispatch, Zod schemas, or app storage policy.
- The temporary deprecated enum bridge must be removed during application cutover.
