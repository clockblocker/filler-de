# Error Contract Book of Work

Track error-shape debt where APIs currently return unstable string messages and callers must infer semantics from text.

## Cases

| ID | Area | Current Contract | Current Workaround | Desired Contract | Priority | Status |
|---|---|---|---|---|---|---|
| EC-001 | VAM markdown read APIs (`readContent`) | `Result<string, ReadContentError>` discriminated by `kind` | None (callers switch on typed kinds) | Keep typed/discriminated error kinds (`FileNotFound`, `PermissionDenied`, `Unknown`) and avoid message-substring logic in callers | P1 | Completed (February 18, 2026) |

## EC-001 Notes

Primary landing points:

- `src/commanders/textfresser/commands/generate/steps/propagation-ports-adapter.ts`
- `src/managers/obsidian/vault-action-manager/impl/vault-reader.ts`

Rationale:

- String-message matching was fragile (localization/wording drift).
- Propagation keeps race-safe behavior (`exists` true, then vanished file) by mapping typed `FileNotFound` reads to `Missing`.

Landed shape:

1. `ReadContentError` union added in VAM boundary types.
2. VAM read paths emit typed kinds instead of raw strings.
3. Propagation adapter classifies missing files via error kind, not substring matching.
4. Unit tests assert discriminant handling in propagation adapter paths.
