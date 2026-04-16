# Knip Findings For `@textfresser/linguistics`

This document captures the remaining package-local `knip` findings after excluding tests and explicitly ignoring `src/lu/test.ts`.

Command used:

```bash
bun run knip --reporter compact
```

Scope:

- Local package config in `knip.json`
- Project files limited to `src/**/*.ts`
- Test files excluded from analysis

## Remaining Issues

### Unused files

`knip` still reports one unused file:

- `src/lu/universal/canonical-lemma-form-metadata.ts`

Interpretation:

- No reachable import path from `src/index.ts` currently pulls this file into the package graph.
- This is either genuinely dead code or an internal module that should be imported from a public or internal entrypoint.

### Unused exports

`knip` reports a large cluster of exported runtime values that are not referenced from the analyzed package graph.

Files involved:

- `src/lu/universal/enums/core/language.ts`
- `src/lu/universal/enums/core/meta.ts`
- `src/lu/universal/enums/core/selection.ts`
- `src/lu/universal/enums/feature/custom/discourse-formula-role.ts`
- `src/lu/universal/enums/feature/custom/governed-case.ts`
- `src/lu/universal/enums/feature/custom/lexically-reflexive.ts`
- `src/lu/universal/enums/feature/custom/phrasal.ts`
- `src/lu/universal/enums/feature/custom/separable.ts`
- `src/lu/universal/enums/feature/ud/abbr.ts`
- `src/lu/universal/enums/feature/ud/animacy.ts`
- `src/lu/universal/enums/feature/ud/aspect.ts`
- `src/lu/universal/enums/feature/ud/case.ts`
- `src/lu/universal/enums/feature/ud/clusivity.ts`
- `src/lu/universal/enums/feature/ud/definite.ts`
- `src/lu/universal/enums/feature/ud/degree.ts`
- `src/lu/universal/enums/feature/ud/deixis-ref.ts`
- `src/lu/universal/enums/feature/ud/deixis.ts`
- `src/lu/universal/enums/feature/ud/evident.ts`
- `src/lu/universal/enums/feature/ud/ext-pos.ts`
- `src/lu/universal/enums/feature/ud/foreign.ts`
- `src/lu/universal/enums/feature/ud/gender.ts`
- `src/lu/universal/enums/feature/ud/mood.ts`
- `src/lu/universal/enums/feature/ud/noun-class.ts`
- `src/lu/universal/enums/feature/ud/num-form.ts`
- `src/lu/universal/enums/feature/ud/num-type.ts`
- `src/lu/universal/enums/feature/ud/number.ts`
- `src/lu/universal/enums/feature/ud/person.ts`
- `src/lu/universal/enums/feature/ud/polarity.ts`
- `src/lu/universal/enums/feature/ud/polite.ts`
- `src/lu/universal/enums/feature/ud/poss.ts`
- `src/lu/universal/enums/feature/ud/pron-type.ts`
- `src/lu/universal/enums/feature/ud/reflex.ts`
- `src/lu/universal/enums/feature/ud/style.ts`
- `src/lu/universal/enums/feature/ud/tense.ts`
- `src/lu/universal/enums/feature/ud/verb-form.ts`
- `src/lu/universal/enums/feature/ud/voice.ts`
- `src/lu/universal/enums/kind/morpheme-kind.ts`
- `src/lu/universal/enums/kind/phraseme-kind.ts`
- `src/lu/universal/enums/kind/pos.ts`
- `src/relations/relation.ts`

Pattern:

- Most of these are `getReprFor*` helper exports and exported enum/value lists.
- The issue appears structural rather than isolated: the package exposes many helpers that are not consumed from the package entry graph.

Likely explanations:

- Some exports were added for anticipated downstream use but are not yet used.
- Some exports are only exercised by tests, which are intentionally excluded from this package-local `knip` run.
- Some exports may be intended as public API surface, in which case `knip` is correctly reporting them as unused internally but they may still be valid external API.

Recommended triage:

- Keep exports that are intentionally public and document them as accepted `knip` noise if needed.
- Remove exports that are not part of the intended public API.
- For internal helpers, stop exporting them if they do not need to leave their module.

### Unused exported types

`knip` reports unused exported types in these files:

- `src/ling-id/internal/wire/header.ts`
- `src/ling-id/public.ts`
- `src/lu/registry-shapes.ts`
- `src/lu/universal/abstract-selection.ts`
- `src/lu/universal/enums/feature/custom/discourse-formula-role.ts`
- `src/lu/universal/enums/feature/index.ts`
- `src/lu/universal/factories/buildSelectionSurface.ts`
- `src/lu/universal/helpers/schema-targets.ts`
- `src/lu/universal/lemma-discriminator.ts`
- `src/relations/relation.ts`

Pattern:

- These are mostly supporting generic types and schema-shape types.
- As with runtime exports, the main question is whether these are meant for consumers outside this package or are leftover internal exposure.

Recommended triage:

- Keep exported types that are part of the intended package API.
- Demote purely internal helper types to non-exported declarations.
- Add explicit `knip` ignores only after the API decision is settled.

### Duplicate exports

`knip` reports duplicate exports in:

- `src/lu/public-entities.ts`
  - `SurfaceSchema`
  - `UnresolvedSurfaceSchema`
- `src/relations/relation.ts`
  - `MorphologicalRelationsSchema`
  - `AbstractMorphologicalRelationsSchema`
  - `LexicalRelationsSchema`
  - `AbstractLexicalRelationsSchema`

Interpretation:

- These names are being exported through more than one path in the same module surface.
- Duplicate exports are usually low-risk at runtime but make the public API harder to reason about and can conceal accidental aliasing.

Recommended triage:

- Collapse each duplicated symbol to a single authoritative export path.
- If duplicate names are intentional aliases, document that explicitly or rename for clarity.

## Suggested Order Of Work

1. Resolve duplicate exports first, because they are usually the clearest and lowest-risk cleanup.
2. Decide whether the reported exported helpers and types are true public API or accidental exposure.
3. Remove or de-export internal-only symbols.
4. Revisit `src/lu/universal/canonical-lemma-form-metadata.ts` and either wire it into the graph or delete it.

## Notes

- This document does not assume every finding is a bug.
- For a library package, internal `knip` findings can over-report intentionally public symbols that are only used by external consumers.
- The correct fix is an API decision first, then targeted cleanup or ignore rules.
