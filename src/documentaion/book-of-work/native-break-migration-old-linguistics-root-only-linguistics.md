# Root-only linguistics migration

Status: The package cutover is complete. Consumer cleanup is pending.

Related decision:

- [ADR-0006: Separate linguistic truth, lexical generation, and note policy](../../../docs/adr/0006-separate-linguistic-truth-generation-and-note-policy.md)

## Completed

- `src/packages/independent/old-linguistics` is gone.
- `@textfresser/linguistics` has one root entry point.
- Production source has no `@textfresser/linguistics/*` deep imports.
- The root exposes schema registries, operations, ID codecs, and public entity types.
- Old package-name and path mappings are gone.

## Boundary

Consumers must import only:

```ts
import {
	LingIdCodec,
	lingOperation,
	lingSchemaFor,
	type Lemma,
	type Selection,
} from "@textfresser/linguistics";
```

Do not add:

- language subpath entry points;
- app note, tag, path, or label policy;
- targeted schema helpers for one generator;
- legacy aliases;
- UI formatting helpers.

Lexical generation may select exact schemas through the public registries. Textfresser must use broad native types and narrow them with discriminators.

## Remaining consumer cleanup

1. Remove `src/deprecated-linguistic-enums.ts`.
2. Convert `lexical-generation-next` public DTOs to native discriminators.
3. Convert Textfresser formatting and routing adapters.
4. Remove legacy `Lexem`, `Inflected`, and title-case POS vocabulary from live contracts.
5. Keep display maps and serialized tag policy in Textfresser.

Track this work in `lexical-generation-deprecation-and-rebuild-plan.md`.

## Verification

```bash
rg 'old-linguistics|@textfresser/linguistics/' src tests
bun run test:unit
bun run typecheck
bun run typecheck:changed
```

The search can find prose references in migration documents. It must not find production imports.
