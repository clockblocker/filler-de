# Textfresser Wikilink Philosophy

## Big picture

Textfresser wikilinks come from two sources:

1. User-authored: the user manually wraps text in `[[...]]`.
2. Textfresser-authored: links inserted by Textfresser commands.

Wikilinks target one of three destination families:

1. Closed-set entries in `Library` (grammar/function-word inventory), for example:
   - `Library/de/pronomen/demonstrativ/die-demonstrativ-pronomen-de.md`
   - `Library/de/pronomen/relativ/die-relativ-pronomen-de.md`
   - `Library/de/artikel/bestimmter/die-bestimmter-artikel-de.md`
   - `Library/de/grammatik/zeit/plusquamperfekt-zeit-grammatik-de.md`
   - `Library/de/morphem/praefix/trennbares/uber-trennbares-praefix-de.md`
2. Open-set lemma notes in `Worter`, for example:
   - `Worter/.../lemma/.../essen.md`
3. Open-set non-lemma notes in `Worter` (`inflection`/`variant`), for example:
   - `Worter/.../inflection/.../ass.md`
   - `Worter/.../variant/.../ass.md`

This is the complete target space for lexical units across supported languages.

## Notes can contain multiple dictionary entries

In `Worter`, we separate meaningful grammatical differences and senses inside one note using entry headers/ids.

Examples:

- `das Essen` and `essen` share `essen.md`, but are separate entries.
- `Schloss` (lock) and `Schloss` (castle) share one note, but are separate entries.
- `der See` and `die See` share `see.md`, but are separate entries.
- `durchschneiden` (separable) and `durchschneiden` (inseparable) may share one note, but are separate entries.

In `Library`, meaningful grammatical differences are usually split into different notes, while finer semantic variants can remain mixed inside a note and are often not the default routing target.

Example:

- `uber-trennbares-praefix-de.md` and `uber-untrennbares-praefix-de.md` are separate notes.
- Internal semantic shades inside each of those notes are not normally the primary routing dimension.

## Librarian naming and global completion behavior

For a note like `die-demonstrativ-pronomen-de.md`, Librarian semantics are:

- `separator`: `-` (user-configurable)
- `coreName`: `die`
- `suffixParts`: `["demonstrativ", "pronomen", "de"]`

Librarian keeps this naming model consistent when separator settings change.

Vault-wide completion behavior for user-authored `[[word]]`:

1. Try native Obsidian resolution. If resolved, keep as-is.
2. Otherwise try Librarian core-name resolution.
3. If Librarian can resolve, the classic behavior rewrites to suffixed target with alias, for example `[[some-suffix-word|word]]`.

## Lemma command philosophy

Lemma is an explicit grammar lookup workflow.

Before LLM queries:

1. Enforce single-target ownership per Lemma invocation (one working target only).
2. If selected surface is one word and already has a `Worter` match, reuse that note as the working target.
3. Otherwise, create a temporary working note in `Worter/.../unknown/.../{selected_text}.md`.
4. Wrap selected text in a clickable wikilink immediately so users can jump in right away.
5. `unknown` is strictly temporary for this invocation and must not remain after LLM finalize.

After queries:

1. Rewrite attestation with semantic links, targeting anchors when available.
2. Keep display text natural in context, including optional directional decorations.
3. If final target is open-set, move/rename the working note to canonical `Worter` destination.
4. If final target is closed-set:
   - resolve the `Worter` surface host note (reuse existing note if present; otherwise rename temp note to host path).
   - add a closed-set membership entry (header with id + link to resolved `Library` target + tags).
   - if user is currently inside that host note, navigate them to the resolved closed-set note.
   - rewrite source attestation to the resolved closed-set link (example: `[[wir-personal-pronomen|Wir]]`).
5. If canonical destination already exists, delete temporary `unknown` note after merging/confirming no unique content should be kept.
6. Lemma classification uses full context and should either:
   - resolve to an existing semantic/grammatical target, or
   - create a new semantic/grammatical target.

Examples:

- `Pass auf dich [auf]` -> `[[aufpassen#^verb-sep-1|>Pass]] auf dich [[aufpassen#^verb-sep-1|auf<]]`
- `Wir [arbeiten] im Team, ...` -> `Wir [[arbeiten#^verb-1|arbeiten]] im Team, ...`
- `..., [verbessert] unsere Arbeit` -> `..., [[verbessern#^verb-1|verbessert]] unsere Arbeit`
- `[Wir] arbeiten im Team, ...` -> `[[wir-personal-pronomen|Wir]] arbeiten im Team, ...`

## Closed-set surface policy

Manual closed-set `[[word]]` should stay visually surface-first for the user while routing to a `Worter` surface host note for that surface.

Invariant: all units that share a surface (within a language) share the same `Worter` note.

That surface host note can contain mixed entry types:

1. Open-set dictionary entries.
2. Closed-set membership entries (linking to `Library` targets).
3. Other surface-related entries (for example, attestation-derived entries across POS).

For Lemma specifically, confirmed closed-set attestations link directly to the resolved `Library` leaf in source text, while the `Worter` surface host note gets/keeps the corresponding closed-set membership entry.

## DTO-first principle

All Textfresser-produced dictionary-entry wikilinks should be represented as linguistic wikilink DTOs when note content is parsed into entry/entity DTOs.

Semantic meaning is primary. Markdown string shape is a rendering detail.

### Parse-time granularity

1. Parse-time target refs are rich and fully populated.
2. We do not use a basename-only unresolved target variant in linguistic DTOs.
3. Relation links are lemma-only by policy; section type + current POS context provides target details.
4. If relation context inference is insufficient, lookup existing target and collapse to Lexem target policy.
5. `Library` leaf targets are parse-time decomposed into `coreName + suffixParts` (not stored as raw basename).
6. Decomposition uses Librarian suffix parser utility, which respects user-configured separator settings.

### Source and intent derivation

1. `source` is parse-derived from section ownership:
   - `Freeform` section => `UserAuthored`
   - non-Freeform Textfresser sections => `TextfresserCommand`
2. `intent` is parse-derived from section context:
   - Attestation => `LemmaSemanticAttestation`
   - Relation/Morphology/Inflection/Morpheme => `GenerateSectionLink`
   - Freeform => `ManualSurfaceLookup`
   - propagation-marked contexts => `PropagationLink`
3. `LemmaPreflight` is runtime-only command state and is not part of persisted/parsed linguistic DTOs.

### Scope boundary

1. Go-back links are Librarian navigation business, not linguistic-wikilink DTOs.
2. Parser/reader pipelines should strip/ignore go-back links before linguistic DTO extraction.
3. Dict-entry wikilinks (attestations, relations, inflection links, morpheme links) are linguistic-wikilink DTOs.

### Inflection-link rule

1. Inflection cells are wikilinks, not plain text.
2. Target selection for inflected surface `s`:
   - if `Worter/.../lemma/.../s.md` exists, treat inflection as another dict entry under that lemma note.
   - otherwise target `Worter/.../inflection/.../s.md`.
3. Link rendering stays surface-first (`[[s]]`), with routing resolved by policy.

### Morpheme-link rule

1. Morpheme breakdown comes from LLM as DTOs with morpheme kind.
2. German prefixes classified as closed-set route to `Library`.
3. Other morphemes route to `Worter`.

## Anchor philosophy

Block-id anchors are deterministic compact IDs, encoding:

1. POS tag.
2. POS x language-specific feature tags.
3. Sense index.
4. Sense index is sequential per `(posTag + featureTags)` bucket.

Example forms: `^noun-n-1`, `^verb-1`, `^prep-2`.

In prompts, IDs are expanded into full objects (`pos`, decoded features, emoji description, sense info). The LLM should choose an existing target or create a new one from that expanded view.
