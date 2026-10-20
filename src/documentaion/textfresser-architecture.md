# Textfresser vocabulary architecture

Textfresser turns German text in a Scroll into links to Lemma notes, one note per dumling Lemma. All model work goes through dumgen, which calls TypeSafe (jev) and OpenAI (Luna). The current runtime is German-first.

Related decisions and proposals:

- [ADR-0011: Use different compatibility policies for domain and infrastructure](../../docs/adr/0011-use-different-compatibility-policies-for-domain-and-infrastructure.md)
- [ADR-0012: Link classified Segments to Reading blocks and keep every Lemma in Worter](../../docs/adr/0012-link-classified-segments-to-reading-blocks-and-keep-every-lemma-in-worter.md)
- [ADR-0013: Spell each Lemma note's dumling identity in its path](../../docs/adr/0013-spell-each-lemma-notes-dumling-identity-in-its-path.md)
- [ADR-0014: Segment Sentences lazily into a content-addressed cache](../../docs/adr/0014-segment-sentences-lazily-into-a-content-addressed-cache.md)

The plugin's own linguistics and lexical-generation packages, the Gemini client, and the Lemma and Generate commands were deleted in [#66](https://github.com/clockblocker/filler-de/issues/66). ADR-0006, ADR-0008 and ADR-0010 describe that code and are superseded.

## Domain model

Terms follow dumling, dumrel and dumdict. See `CONTEXT.md` and the [adoption map](https://github.com/clockblocker/filler-de/issues/49).

| Term | Meaning |
| --- | --- |
| Lemma | A grammatical entity: language, Family, Kind, Core Features and Canonical Form. It carries no sense. |
| Reading | A Lemma plus one Emoji Description: one sense. |
| Surface | A grammatical form that realizes exactly one Lemma. |
| Attestation | A fleeting occurrence of a Surface in text. It has no durable identity. |
| Attestation Ref | A durable embed of the source block where an Attestation occurred. |
| Lemma note | The one Markdown note for one Lemma and all of its Readings and owned Surfaces. |
| Reading Entry, Surface Entry | The dumdict records a Lemma note holds for one Reading or one Surface. |
| Block | A typed part of a Lemma note, such as translation, relation, or inflection. |

Selection is retired. "Section" means a Library Section only.

One note holds one Lemma. Its path spells the Lemma's identity (ADR-0013), but the note's `identity` Block stays authoritative. Do not read identity from the path, and do not use the path as the identity of a Reading.

## Command flow

| Command | Owner | Result |
| --- | --- | --- |
| `Classify` | `ClassifyCommander` | Segment the selected Sentences through dumgen, resolve each Segment's Reading, commit the occurrence to the dictionary store, link the Segment to the Reading's block, and queue background Knowledge for the Reading. |
| `TranslateSelection` | `Textfresser` | Translate the selected German text, or the caret's block, into the known language through dumgen's `translate.sentence`, with the surrounding Sentences as context, and write it under the text. It creates no Reading Entry. |

Classify hands a `ClassifyPlan` of `UnitRef`s to the `UnitResolver` port. `dumgenUnitResolver` implements it: it resolves through dumgen, commits through the dumdict vault store (`@textfresser/dictionary`), and rewrites the Scroll's links. Knowledge runs after the commit and the links, one run per Reading, and a click on a Reading link whose Knowledge is still running scrolls to it once it lands.

## Note and Block ownership

- dumling owns Lemma, Reading and Surface identity.
- dumdict owns the records, Reading matching, and change planning. The plugin's dumdict host is `@textfresser/dictionary`, over VAM.
- dumrel owns Reading Knowledge and relation projections.
- `@textfresser/lemma-note-codec` reads and writes Lemma notes; `@textfresser/lemma-note-projections` derives inflection tables, features and tags.
- The plugin owns freeform Blocks.

Every Block serializes one dumdict or dumrel field, is a projection, or is plugin-owned. Headers, tags, inverse relations and the inflection table are projections. They must not become the canonical source for linguistic identity or data.

## Target routing

- Every Lemma, closed-class ones included, has one note under `Worter/` whose path spells its identity. A closed-class Lemma's note is created on first click; none goes to a Library leaf.
- A Shadow (a dumrel Unit Shadow) has a note under `Worter/<lang>/Shadow/`, removed when its Lemma is created.
- Classify links each Segment to its unit's Reading with a path-qualified link to the Reading's block.
- A bare `[[surface]]` link typed by hand is a side case and may be ambiguous; Obsidian picks the nearest or shortest path. There are no Crossroad notes.
- Inverse relations are never written. A Semantic Relation is a direct claim stored on its source Reading only; the target note shows its inverse as a projection.

The Librarian parses Library suffixes. Textfresser must not duplicate the separator rules.

## Source map

| Area | Location |
| --- | --- |
| Classify | `src/commanders/classify/` |
| Resolution and Knowledge | `src/commanders/classify/resolution/` |
| Translate | `src/commanders/textfresser/` |
| dumgen host and transports | `src/managers/dumgen/` |
| Dictionary store | `src/packages/composed/dictionary/` |
| Lemma note codec | `src/packages/independent/lemma-note-codec/` |
| Projections | `src/packages/independent/lemma-note-projections/` |
