# Lexical-generation cutover plan

Status: The replacement package works in isolation. Application cutover is pending.

Related decision:

- [ADR-0006: Separate linguistic truth, lexical generation, and note policy](../../../docs/adr/0006-separate-linguistic-truth-generation-and-note-policy.md)
- [ADR-0010: Return field-level results from aggregate lexical generation](../../../docs/adr/0010-return-field-level-results-from-aggregate-lexical-generation.md)

## Current state

| Package | Current role |
| --- | --- |
| `@textfresser/lexical-generation` | Deprecated package used by the application and root prompt scripts |
| `@textfresser/lexical-generation-next` | Replacement composed package used by package tests and provider acceptance |
| `@textfresser/linguistics` | Native linguistic schemas and operations |

The replacement package already provides:

- a client factory;
- Selection resolution and sense disambiguation;
- aggregate and part-level generation;
- per-part and per-POS routing;
- parallel part generation;
- field-level partial failure;
- provider acceptance coverage.

It does not yet own the live application import path.

## Target boundary

| Owner | Responsibility |
| --- | --- |
| Linguistics | Native schemas, types, IDs, and linguistic operations |
| Lexical generation | Model routing, prompt assets, generation workflows, and generation DTOs |
| Textfresser | Notes, paths, IDs, tags, labels, rendering, and vault orchestration |

The lexical-generation public API must not expose:

- `PromptKind`;
- generic prompt dispatch;
- Zod schemas;
- note paths or note IDs;
- serialized metadata tags;
- legacy linguistic vocabulary.

The client accepts raw selected text only in `resolveSelection`. Other methods accept a resolved Selection and attestation.

## Remaining work

1. Remove `src/deprecated-linguistic-enums.ts` from the replacement package.
2. Replace temporary legacy DTO fields with native `@textfresser/linguistics` types.
3. Build Textfresser adapters for the replacement client.
4. Compare generated note behavior through deterministic tests.
5. Run provider acceptance with an explicit budget.
6. Change the package names, TypeScript paths, dependencies, and root scripts in one patch.
7. Migrate all application imports.
8. Keep the old package under `@textfresser/deprecated-lexical-generation` until application acceptance passes.
9. Delete the old package only after no production source imports it.

The name swap must be atomic. The repository must not have two packages that claim `@textfresser/lexical-generation`.

## Cutover gates

Before the package-name swap:

- replacement package tests pass;
- prompt assets validate;
- provider preflight passes;
- non-German routes fail explicitly;
- unsupported Morpheme routes fail explicitly;
- aggregate generation preserves `ready`, `disabled`, `not_applicable`, and `error`;
- stored-sense matching uses canonical Lemma identity;
- no public replacement type imports deprecated linguistic enums.

After the swap:

```bash
rg '@textfresser/lexical-generation' src tests
bun run test:lexical-generation
bun run test:unit
bun run typecheck
bun run typecheck:changed
bun run build
```

The cutover does not require compatibility with old prompt DTOs or persisted lexical metadata.

## Out of scope

- a compatibility facade inside the replacement package;
- generic translation in the first cutover;
- full non-German runtime support;
- app policy inside lexical generation.
