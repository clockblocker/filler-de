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

## What `linguistics/src/index.ts` should expose

Yes, it needs a broader root surface, but only a curated native one.

Add these exports at the root:
- `TargetLanguageSchema`, `TargetLanguage`, `TARGET_LANGUAGES`
- `LemmaSchema`, `SelectionSchema`
- `LemmaUnionSchema`, `SelectionUnionSchema`
- `Lemma`, `Selection`, `AnyLemma`, `AnySelection`
- `OrthographicStatus`
- `SurfaceKind`
- `LemmaKind`
- `Pos`
- `PhrasemeKind`
- `MorphemeKind`
- German feature enums/schemas actually needed by generator/runtime consumers:
  - `GermanCase`
  - `GermanNumber`
  - `GermanGender`
  - `GermanDegree`
  - `GermanMood`
  - `GermanPerson`
  - `GermanTense`
  - `GermanVerbForm`
  - `IsReflex`
  - `IsSeparable`

Do not expose these from the new root:
- legacy aliases like `LexicalPos`, `POS`, `LinguisticUnitKind`, `LANGUAGE_ISO_CODE`
- `common` / `de` subpath entrypoints
- app-policy helpers for note IDs, tags, paths, or UI labels

## Public API changes

`@textfresser/linguistics`
- Rename the package from `@textfresser/linguistics-next` to `@textfresser/linguistics`
- Publish only `"."` from `package.json`
- Remove `old-linguistics` path mappings and workspace usage

`@textfresser/lexical-generation`
- Replace `ResolvedLemma` with `ResolvedSelection = Exclude<AnySelection<"German">, { orthographicStatus: "Unknown" }>`
- Rename `generateLemma()` to `resolveSelection()`
- Rename `createMetaTagFromResolvedLemma()` to `createMetaTagFromSelection()`
- Rename `createLexicalMeta({ lemma })` to `createLexicalMeta({ selection })`
- Replace `LexicalInfo["lemma"]` with `LexicalInfo["selection"]`
- Remove legacy exported types that encode dropped semantics:
  - `LexicalAdjectiveClassification`
  - `LexicalAdjectiveDistribution`
  - `LexicalAdjectiveGradability`
  - `LexicalAdjectiveValency`
  - `LexicalNounClass`
  - `LexicalVerbConjugation`
  - `LexicalVerbValency`
  - legacy `LexicalPos` / `LexicalPhrasemeKind` / `LexicalSurfaceKind`
- Replace ad hoc feature unions with a schema-native shape:
  - `features: { inherentFeatures: Record<string, string | boolean> }`
- Keep `inflections`, `relations`, and `morphemicBreakdown`, but switch their value vocabularies to native enums
- Change morpheme separability from string labels to boolean `isSeparable`

## Migration steps

1. Expand the new root export surface.
2. Rename the new package to `@textfresser/linguistics` and update `package.json`, `tsconfig.json`, and workspace references.
3. Add root union helpers (`LemmaUnionSchema`, `SelectionUnionSchema`, `AnyLemma`, `AnySelection`) so consumers do not need deep imports.
4. Rewrite `lexical-generation` to import only from the new root.
5. Rewrite lemma resolution to return native selections, not legacy lemma wrappers.
6. Update meta-tag creation/parsing to encode native `lemmaKind`, discriminator, and `surfaceKind`.
7. Rewrite prompt schemas, examples, and guardrails to native values:
   - `Lexeme`, `Inflection`, `NOUN`, `PROPN`, `DET`, etc.
   - new phraseme kinds
   - no nounClass / adjective classification / verb valency compatibility fields
8. Rewrite `LexicalInfo` generation to emit native-feature data only.
9. Rewrite Textfresser consumers:
   - localize app-owned note/path/tag concepts instead of importing them from linguistics
   - switch section routing to native `Pos` and `PhrasemeKind`
   - remove nounClass-based branching; use `PROPN` directly
   - replace adjective/verb-specific tag builders with generic `inherentFeatures` tag rendering
   - update noun/header/inflection label formatting to native enum values
   - update morpheme formatting to boolean separability
10. Remove all `@textfresser/linguistics/*` deep imports.
11. Delete `src/packages/independent/old-linguistics`.
12. Update architecture docs and migration docs to match the new boundary.

## Test cases and acceptance

Required checks:
- `rg` finds no `old-linguistics`
- `rg` finds no `@textfresser/linguistics/*` imports outside the package itself
- root export smoke tests cover `LemmaUnionSchema` and `SelectionUnionSchema`
- lexical-generation tests cover:
  - `resolveSelection()` success cases
  - meta-tag roundtrip from native selection
  - disambiguation filtering on native selection identity
  - lexical info generation with native enums
- Textfresser tests cover:
  - section selection for `NOUN` vs `PROPN`
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
- App-level concepts like language-code maps, dict-entry IDs, and section/tag routing are not linguistic public API and should stay local to Textfresser.
- Missing old semantics are intentionally removed unless they already exist in the new schema model.
