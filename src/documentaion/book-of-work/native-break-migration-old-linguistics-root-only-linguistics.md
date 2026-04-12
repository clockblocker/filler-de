# Native Break Migration: `old-linguistics` -> root-only `linguistics`

## Summary

Delete `src/packages/independent/old-linguistics` and promote `src/packages/independent/linguistics/src/index.ts` to the only public linguistic boundary.

Locked decisions for this plan:
- Use a native clean break. No legacy compatibility facade.
- External consumers are root-only: `@textfresser/linguistics` and nothing deeper.
- The new schema model is the source of truth. Old concepts that do not exist there are dropped, not backfilled.

This is not a path-only migration. The new package has a different model:
- `Lexem` -> `Lexeme`
- `Inflected` -> `Inflection`
- old title-case `POS` values -> native `Pos` values (`NOUN`, `VERB`, `DET`, `PROPN`, ...)
- old phraseme taxonomy -> new `PhrasemeKind`
- old adjective/verb/nounClass feature model -> current new-schema feature model

Boundary rule:
- `lexical-generation` uses exact targeted schemas from the registry for prompt IO and validation, for example a German verb lemma or a German noun inflection branch
- the rest of the system stays as abstract as possible and treats data as broad lemma/selection unions, narrowing only through discriminator fields and inferred subtypes

Meta-tag rule:
- the meta tag represents canonical note identity, not full native selection identity
- it is allowed to drive cache/disambiguation filtering for stored note senses
- it must encode only the stable note-shaping fields needed for that job: lemma kind, discriminator, and surface kind
- target language is intentionally excluded because canonical note identity is already language-scoped by note location / app policy
- it must not encode `orthographicStatus`
- it must not encode `inflectionalFeatures`
- `orthographicStatus` and `inflectionalFeatures` belong to selection-instance resolution, not canonical stored-note identity
- disambiguation should continue to narrow stored candidates to canonical lemma-note candidates before comparing senses

## What `linguistics/src/index.ts` should expose

Yes, it needs a broader root surface, but only a curated native one.

Add these exports at the root:
- `TargetLanguageSchema`, `TargetLanguage`, `TARGET_LANGUAGES`
- `LemmaSchema`, `SelectionSchema`
- `Lemma`, `Selection`
- required type-only broad aliases for ergonomic downstream use:
  - `AnyLemma<L extends TargetLanguage = TargetLanguage>`
  - `AnySelection<L extends TargetLanguage = TargetLanguage>`
- `UnknownSelection`
- `InherentFeatures`
- `OrthographicStatus`
- `SurfaceKind`
- `LemmaKind`
- `Pos`
- `PhrasemeKind`
- `MorphemeKind`
- generic cross-language native enums that downstream consumers need for mapping/parsing/formatting:
  - `Case`
  - `Gender`
  - `GrammaticalNumber`

Generator code should obtain targeted schemas by indexing into the exported registries, not by importing leaf primitives or separate schema helper barrels. Examples:
- lemma generation for German verb: `LemmaSchema.German.Lexeme.VERB`
- inflection generation for German noun: `SelectionSchema.German.Standard.Inflection.Lexeme.NOUN`

Do not add leaf feature enums, language-specific feature enums, or targeted branch helper exports to the root just to preserve the old `schema-primitives` pattern. Generic cross-language enums needed by real downstream consumers are allowed; everything else stays off the root unless a concrete ergonomics problem appears during implementation.

Do not expose these from the new root:
- legacy aliases like `LexicalPos`, `POS`, `LinguisticUnitKind`, `LANGUAGE_ISO_CODE`
- `common` / `de` subpath entrypoints
- app-policy helpers for note IDs, tags, paths, or UI labels
- native relation helper types unless a concrete non-generator consumer appears later

## Public API changes

`@textfresser/linguistics`
- Rename the package from `@textfresser/linguistics-next` to `@textfresser/linguistics`
- Publish only `"."` from `package.json`
- Remove `old-linguistics` path mappings and workspace usage
- Do not publish replacement `common` / `de` subpath entrypoints
- Make the package-name cutover atomic:
  - in the same patch, stop `old-linguistics` from claiming `@textfresser/linguistics`
  - in the same patch, rename the new package to `@textfresser/linguistics`
  - in the same patch, repoint TS paths and workspace dependency resolution to the new package
  - do not leave an intermediate state where both packages claim the same name or where `@textfresser/linguistics` still resolves to `old-linguistics`

`@textfresser/lexical-generation`
- Replace `ResolvedLemma` with `ResolvedSelection`, inferred from the appropriate `SelectionSchema.German` branches for non-`Unknown` selections
- For `Unknown` results, `ResolvedSelection` uses a small public `UnknownSelection` type, i.e. `{ orthographicStatus: "Unknown" }`; do not expose `AbstractSelectionFor` as part of the public root API just for this case
- Rename `generateLemma()` to `resolveSelection()`
- Rename `createMetaTagFromResolvedLemma()` to `createMetaTagFromSelection()`
- Rename `createLexicalMeta({ lemma })` to `createLexicalMeta({ selection })`
- Replace `LexicalInfo["lemma"]` with `LexicalInfo["selection"]`
- Use exact registry branches for prompt schemas and guardrails instead of `schema-primitives` leaf exports
- Remove legacy exported types that encode dropped semantics:
  - `LexicalAdjectiveClassification`
  - `LexicalAdjectiveDistribution`
  - `LexicalAdjectiveGradability`
  - `LexicalAdjectiveValency`
  - `LexicalNounClass`
  - `LexicalVerbConjugation`
  - `LexicalVerbValency`
  - legacy `LexicalPos` / `LexicalPhrasemeKind` / `LexicalSurfaceKind`
- Replace ad hoc feature unions with a schema-native typed shape that preserves native feature keys and value types:
  - `features: { inherentFeatures: InherentFeatures }`
  - `InherentFeatures` is a public root export derived from the native model for lexeme inherent features, i.e. the public alias for the current native `AbstractLemma<"Lexeme">["inherentFeatures"]` shape
  - do not collapse `inherentFeatures` to `Record<string, string | boolean>`
  - if Textfresser renders tags generically from `inherentFeatures`, the contract must preserve stable feature keys and native enum/boolean values so formatting logic does not become heuristic
- Keep `inflections`, `relations`, and `morphemicBreakdown`, but switch their value vocabularies to native enums where those values are exposed
- Change morpheme separability from string labels to boolean `isSeparable`
- Keep `LexicalRelationKind` as a `lexical-generation`-owned DTO contract for now
- Do not widen the curated `@textfresser/linguistics` root API just to expose native relation DTOs unless another non-generator consumer needs them

## Migration steps

1. Expand the new root export surface.
2. Perform the package-name cutover atomically:
   - rename `src/packages/independent/linguistics/package.json` to `@textfresser/linguistics`
   - in the same patch, stop `src/packages/independent/old-linguistics/package.json` from publishing `@textfresser/linguistics`
   - in the same patch, repoint `tsconfig.json`, workspace dependencies, and lockfile state to the new package
   - only then proceed with deleting `old-linguistics`
3. Rewrite `lexical-generation` to import only from the new root.
4. Remove `internal/schema-primitives.ts` as the package boundary. Replace it with direct indexing into `LemmaSchema` / `SelectionSchema` for exact task-specific schemas, and use inferred types from the broad exported types for non-generator code.
5. Rewrite lemma resolution to return native selections, not legacy lemma wrappers.
6. Update meta-tag creation/parsing to work with native selections.
   - The exact post-migration tag format is not locked by this plan.
   - Compatibility with pre-migration tag formats is not required.
7. Rewrite prompt schemas, examples, and guardrails to native values:
   - `Lexeme`, `Inflection`, `NOUN`, `PROPN`, `DET`, etc.
   - new phraseme kinds
   - no nounClass / adjective classification / verb valency compatibility fields
8. Rewrite `LexicalInfo` generation to emit native-feature data only, but keep its consumer-facing typing abstract enough that Textfresser narrows by discriminator fields instead of importing targeted generator schemas.
9. Rewrite Textfresser consumers:
   - localize app-owned note/path/tag concepts instead of importing them from linguistics
   - switch section routing to native discriminators like `Pos`, `PhrasemeKind`, `MorphemeKind`, `LemmaKind`, and `SurfaceKind`
   - allow Textfresser to consume generic native linguistic enums from the root for mapping/parsing/formatting, for example `Case`, `Gender`, and `GrammaticalNumber`; do not introduce language-specific exports
   - remove nounClass-based branching; use `PROPN` directly
   - narrow broad selection/lemma types through discriminator fields rather than importing targeted schemas
   - replace adjective/verb-specific tag builders with generic `inherentFeatures` tag rendering
   - Textfresser owns generic feature rendering policy:
     - display maps for feature keys
     - display maps for enum/boolean values
     - ordering/grouping rules for rendered tags and labels
   - `linguistics` exports the raw native enums/types/schemas, not app-facing display helpers
   - update noun/header/inflection label formatting to native enum values
   - update morpheme formatting to boolean separability
10. Remove all `@textfresser/linguistics/*` deep imports.
11. Delete `src/packages/independent/old-linguistics`.
12. Update architecture docs and migration docs to match the new boundary.

## Test cases and acceptance

Required checks:
- production/source import checks exclude docs and prose-only references:
  - `rg` finds no `old-linguistics` references in runtime/package source after deletion
  - `rg` finds no `@textfresser/linguistics/*` imports in consumer code outside the package itself
- root export smoke tests cover the curated root surface (`LemmaSchema`, `SelectionSchema`, discriminants, and any intentionally exported type-only convenience aliases)
- lexical-generation tests cover:
  - `resolveSelection()` success cases
  - task-specific prompt schemas selected from the registry resolve to the expected German branches
  - `AnyLemma<L>` and `AnySelection<L>` compile ergonomically for downstream narrowing
  - meta-tag roundtrip from canonical note identity
  - disambiguation filters canonical lemma-note candidates and does not depend on `orthographicStatus` or `inflectionalFeatures`
  - lexical info generation with native enums
- Textfresser tests cover:
  - section selection for `NOUN` vs `PROPN`
  - discriminator-based narrowing on broad selection/lemma types
  - generic tag rendering from `inherentFeatures`
  - noun header/inflection formatting with native gender/case/number values
  - target/path resolution with app-local policy types
  - morpheme decoration from boolean separability
- repo verification:
  - `bun test`
  - `bun run typecheck`
  - `bun run typecheck:changed`

## Assumptions and defaults

- Breaking TypeScript API changes are allowed.
- Breaking prompt-output shape changes are allowed.
- Persisted lexical metadata and note-generation behavior may change as part of this cut.
- Meta-tag format compatibility with pre-migration data is not a goal.
- App-level concepts like language-code maps, dict-entry IDs, and section/tag routing are not linguistic public API and should stay local to Textfresser.
- Missing old semantics are intentionally removed unless they already exist in the new schema model.
- `AnyLemma<L extends TargetLanguage = TargetLanguage>` and `AnySelection<L extends TargetLanguage = TargetLanguage>` are part of the minimum root API because downstream code is expected to narrow broad unions ergonomically; omitting `L` means “all supported target languages”
- Runtime union schemas are not part of the minimum plan.
- `LexicalRelationKind` remains a generator-owned DTO until a concrete shared consumer forces a different boundary.
