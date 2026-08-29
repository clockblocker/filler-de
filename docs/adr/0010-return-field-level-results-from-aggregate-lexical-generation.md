---
status: accepted
---

# Return field-level results from aggregate lexical generation

Aggregate lexical generation returns a status for each generated part instead of failing when one part fails. Complete failure is reserved for setup, routing, or bootstrap failures that prevent a meaningful aggregate result.

## Consequences

- Each field reports `ready`, `disabled`, `not_applicable`, or `error`.
- Applicable parts can run in parallel.
- Callers can keep successful fields and report partial failure.
- Callers must handle mixed field states.
