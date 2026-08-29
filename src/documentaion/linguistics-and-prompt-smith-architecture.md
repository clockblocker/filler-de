# Linguistics and lexical generation architecture

This document defines the boundary between linguistic data, model generation, and application policy.

Related decision:

- [ADR-0006: Separate linguistic truth, lexical generation, and note policy](../../docs/adr/0006-separate-linguistic-truth-generation-and-note-policy.md)

## Package ownership

| Package or layer | Owns | Must not own |
| --- | --- | --- |
| `@textfresser/linguistics` | Linguistic schemas, types, IDs, and language operations | Prompts, note paths, tags, or UI labels |
| `@textfresser/lexical-generation-next` | Selection resolution, sense matching, prompt routing, and generation DTOs | Note layout, vault I/O, or Textfresser routing |
| Textfresser | Notes, Entry IDs, target paths, labels, tags, and propagation | Private linguistic schemas or raw prompt dispatch |
| Deprecated lexical generation | Current application runtime during cutover | New feature design |

The boundary migration is incomplete. Some temporary application and `lexical-generation-next` types still import `src/deprecated-linguistic-enums.ts`. Remove these imports during the application cutover.

## Linguistics package

`@textfresser/linguistics` is the source of truth for native linguistic data.

The root exports:

| Export | Purpose |
| --- | --- |
| `lingSchemaFor` | Schema registry for Lemma, Selection, Surface, and resolved Surface data |
| `lingOperation` | Conversion, extraction, resolution, and language-specific operations |
| `LingIdCodec` | Encode and decode linguistic IDs |
| Public types | `Lemma`, `Selection`, `Surface`, `ResolvedSurface`, and relation types |

Consumers must import from the package root. They must not import language-specific internals.

The model uses discriminated data. Code must narrow with fields such as language, Lemma kind, POS, Phraseme kind, Morpheme kind, Surface kind, and orthographic status.

Do not copy linguistic enums into another package. If an adapter needs a flat prompt shape, map the flat shape back to a native linguistic type inside lexical generation.

## Replacement lexical-generation package

`createLexicalGenerationClient` binds target language, known language, settings, and the structured fetch function.

The client exposes:

```ts
resolveSelection
disambiguateSense
generateLexicalInfo
generateCore
generateFeatures
generateInflections
generateMorphemicBreakdown
generateRelations
```

`PromptKind`, prompt assets, and schemas are internal. Callers request a domain operation.

Low-level generators accept a resolved Selection and an attestation. They do not resolve the same text again.

`generateLexicalInfo` runs applicable parts in parallel. Each field reports one status:

- `ready`
- `disabled`
- `not_applicable`
- `error`

One part failure does not erase successful parts. Setup, unsupported routing, or missing prompt assets can fail the client or the complete request.

Phase 1 supports the German target workflow. Unsupported languages and unsupported Morpheme operations must fail explicitly.

## Prompt system

Prompt routing has two stable axes:

1. Generation part.
2. Native linguistic discriminator, such as POS.

Keep prompt input and output small. Flat prompt contracts are allowed when the provider cannot handle the native nested schema. The adapter must validate and convert the result before it crosses the package boundary.

Prompt assets must include:

- one system instruction;
- a structured input and output contract;
- examples that validate against that contract;
- an explicit route in the internal registry.

The code generator validates prompt assets before use. Generated files are build output. Do not edit them by hand.

The deprecated package still owns the live Prompt-Smith scripts and the active application prompt catalog. Do not retarget root scripts until the package-name cutover.

## Change rules

When you add a linguistic category:

1. Add it to `@textfresser/linguistics`.
2. Add language operations if the category needs them.
3. Add lexical-generation routes only for generated data.
4. Add Textfresser display and storage policy in the application.

When you add a generated part:

1. Add a private prompt route and contract.
2. Add the part-level client method only if callers need it.
3. Add the field to aggregate generation.
4. Keep note rendering out of the package.

Do not expose Zod schemas, provider request details, prompt names, note paths, or serialized metadata tags from the lexical-generation public API.

## Current migration state

| Item | State |
| --- | --- |
| Native `@textfresser/linguistics` package | Active |
| Frozen legacy lexical-generation folder | Active application dependency |
| Composed `lexical-generation-next` package | Built and tested in isolation |
| Provider acceptance through the new client | Active |
| Textfresser application cutover | Pending |
| Removal of deprecated linguistic enums | Pending |

See these plans:

- `book-of-work/lexical-generation-deprecation-and-rebuild-plan.md`
- `book-of-work/native-break-migration-old-linguistics-root-only-linguistics.md`

## Source map

| Area | Location |
| --- | --- |
| Linguistic root API | `src/packages/independent/linguistics/src/index.ts` |
| Native linguistic internals | `src/packages/independent/linguistics/src/` |
| New generation client | `src/packages/composed/lexical-generation/src/` |
| Deprecated runtime | `src/packages/independent/deprecated-lexical-generation/` |
| Temporary enum bridge | `src/deprecated-linguistic-enums.ts` |
| Provider acceptance | `tests/provider-acceptance/textfresser/` |
