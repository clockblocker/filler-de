# Error Contract Book of Work

Track error-shape debt where APIs currently return unstable string messages and callers must infer semantics from text.

## Cases

| ID | Area | Current Contract | Current Workaround | Desired Contract | Priority | Status |
|---|---|---|---|---|---|---|
| EC-001 | VAM markdown read APIs (`readContent`) | `Result<string, string>` with free-form message text | Propagation v2 adapter classifies missing files by matching `"file not found"` in error text | Replace string errors with typed/discriminated error kinds (for example `FileNotFound`, `PermissionDenied`, `Unknown`) and return `Result<string, ReadContentError>` | P1 | Planned (post-v1) |

## EC-001 Notes

Affected call sites currently requiring message inspection:

- `src/commanders/textfresser/commands/generate/steps/propagation-v2-ports-adapter.ts`

Rationale:

- String-message matching is fragile (localization/wording drift), but currently unavoidable with the existing VAM error contract.
- Propagation v2 intentionally keeps race-safe behavior (`exists` true, then vanished file) by mapping file-not-found reads to `Missing`.

Migration sketch:

1. Add a typed `ReadContentError` union in VAM boundary types.
2. Update VAM read paths to emit typed kinds instead of raw strings.
3. Update propagation adapter classification to switch on error kind, remove substring matching.
4. Backfill/update unit tests to assert enum/discriminant handling.
