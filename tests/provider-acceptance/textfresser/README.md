# Textfresser provider acceptance

This opt-in suite owns the model-quality assertions from the retired live
Textfresser runners. It calls Gemini through the public
`@textfresser/lexical-generation-next` interface. It does not start Obsidian,
evaluate renderer JavaScript, reach into the plugin instance, or import the
legacy CLI utilities.

The command refuses to make a request unless both
`TEXTFRESSER_PROVIDER_ACCEPTANCE=1` and `GEMINI_API_KEY` are present. It also
requires an explicit request budget:

```bash
TEXTFRESSER_PROVIDER_ACCEPTANCE=1 \
  bun run test:provider-acceptance --suite=smoke
```

The supported suites are `smoke`, `edge`, and `all`. A focused request such as
`--suite=edge --case=H1-C` includes the earlier cases needed to construct the
sense candidates for that assertion. `TEXTFRESSER_PROVIDER_MODEL` overrides
the default model.

Reports have stable paths under
`tests/provider-acceptance/artifacts/textfresser/<selection>.{json,md}`. Set
`TEXTFRESSER_PROVIDER_ARTIFACT_DIR` to put them elsewhere. The generated
artifact directory is ignored by Git.

This suite verifies resolution, canonical lemma, lexical kind, sense
disambiguation, and schema-valid lexical generation. Source rewrites,
idempotent wikilinks, and persisted dictionary notes are Textfresser
orchestration contracts; they remain outside this provider seam and are listed
as such in every report. The exact deterministic helper scenarios and the
historical `edge-case-results.md` observations are retained as typed migration
data in `corpus.ts`; they are not treated as live-provider assertions.

Run the free preflight checks without credentials or network access:

```bash
bun run test:provider-acceptance:preflight
```
