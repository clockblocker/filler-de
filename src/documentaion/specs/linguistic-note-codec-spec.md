# Lemma note codec specification

- Status: Draft
- Owner: Textfresser
- Compatibility: Clean break from the legacy Dict Note codec and the earlier typed-block draft
- Tracking: [#54](https://github.com/clockblocker/filler-de/issues/54), implemented by [#55](https://github.com/clockblocker/filler-de/issues/55), part of [#49](https://github.com/clockblocker/filler-de/issues/49)

Related decisions:

- [ADR-0007: Separate note documents from semantic note data](../../../docs/adr/0007-separate-note-documents-from-semantic-note-data.md)
- [ADR-0011: Use different compatibility policies for domain and infrastructure](../../../docs/adr/0011-use-different-compatibility-policies-for-domain-and-infrastructure.md)
- Batteries [ADR 0002] (Lemma and Reading identity), [ADR 0003] (Attestation supersedes Selection), [ADR 0011], [ADR 0012] and [ADR 0020] (direct Semantic Relations), [ADR 0031] (Emoji Description), [ADR 0038] (plural and conjugation class), [ADR 0044] and [ADR 0046] (pronoun cells and Syncretisms)

ADR-0007 predates the batteries. Its "Lemma and Selection content" now means the dumdict records below.

Terms follow the [dumling], [dumrel] and [dumdict] glossaries and `CONTEXT.md`.

## Purpose

The proposed `@textfresser/lemma-note-codec` package converts between one Markdown **Lemma note** and dumdict records.

It owns:

- Block parsing and the typed note document;
- conversion between Blocks and dumdict records;
- rendering of projection Blocks from data the caller supplies;
- Block IDs;
- deterministic serialization;
- structured codec issues.

It must not own:

- vault I/O, lookup, revisions, or commits (the dictionary store, [#58](https://github.com/clockblocker/filler-de/issues/58));
- note paths or the path encoding ([#52](https://github.com/clockblocker/filler-de/issues/52));
- wikilink destination resolution ([#53](https://github.com/clockblocker/filler-de/issues/53));
- prompts or generation (dumgen);
- linguistic or Knowledge schemas (dumling, dumrel).

It depends only on the batteries: `dumling`, `dumrel` and `dumdict`. It must not import VAM types such as `SplitPath`, or any other `@textfresser/*` package.

dumdict's own serialized note (`battery/dumdict/src/dto/serialized-note.ts`, `schemaVersion: 1`) is its reference store's internal shape. The codec must not depend on it.

## One note, one Lemma

A Lemma note holds exactly one dumling Lemma and everything dumdict keys to it:

| Record | Count | Scope in the note |
| --- | --- | --- |
| `LemmaRecord` | exactly 1 | Lemma part |
| `ReadingEntry` | 1 or more | one Reading part each |
| `SurfaceEntry` (owned) | 0 or more | one Surface part each |
| `PendingSemanticRelationRecord` | 0 or more | the Reading part of its source Reading |

The note's path spells the Lemma's identity. The path is a projection of the `identity` Block, which stays authoritative. The codec never reads the path. The encoding is settled in [#52](https://github.com/clockblocker/filler-de/issues/52).

A Foreign Lemma has exactly one Reading, with no Emoji Description ([ADR 0045]). A Lemma Syncretism is a Lemma like any other: its `syncretic` list is part of its identity, and its `syncretized` units are content of the `identity` Block ([ADR 0046]).

## Required model

The codec exposes two layers, as ADR-0007 requires.

```ts
type LemmaNoteDocument = {
	parts: NotePart[];
};

type NotePart =
	| { scope: "lemma"; blocks: Block[] }
	| { scope: "reading"; blockId: string; blocks: Block[] }
	| { scope: "surface"; blockId: string; blocks: Block[] };

type LemmaNoteData<L extends Language> = {
	lemmaRecord: LemmaRecord<L>;
	readingEntries: ReadingEntry<L>[];
	ownedSurfaceEntries: SurfaceEntry<L>[];
	pendingRelations: PendingSemanticRelationRecord<L>[];
};
```

`LemmaNoteDocument` preserves part order, Block order, and the bytes of freeform and unknown Blocks. It also holds every plugin-owned value: Block IDs, `closed_set_membership`, and freeform content.

`LemmaNoteData` holds dumdict records only. Each record must validate with dumdict's `parseAsLemmaRecord`, `parseAsReadingEntry`, `parseAsSurfaceEntry` or `parseAsPendingSemanticRelationRecord` for the codec's language. Reading Knowledge is validated through `parseAsReadingEntry`.

Loose data conversion must return a partial-invalid part when reconstruction fails. It must not return invalid content as a record.

## Block kinds

Every Block is one of three kinds:

- **Serialized**: its payload is one dumdict or dumrel field. Parse reads the payload into data. Its visible rendering, if any, is derived from the payload and is never parsed.
- **Projection**: rendered from data and never parsed back. Deleting or editing one changes no data.
- **Plugin-owned**: Textfresser state that dumdict does not model. It lives only in the document layer.

A serialized Block's payload is canonical JSON in a form Obsidian's reading view hides. The payload must round-trip nested dumling and dumrel values, such as morphological trees and Valency Frames, without loss.

### Lemma part

| Block | Kind | Maps to |
| --- | --- | --- |
| `identity` | Serialized | `LemmaRecord.lemma`: the whole dumling Lemma: language, Family, Kind, Core Features, Canonical Form, and, for a Syncretism, `syncretic` and `syncretized` |
| `closed_set_membership` | Plugin-owned | Link from the Lemma note to a closed-set Library leaf |
| `freeform` | Plugin-owned | Opaque user content, byte-preserved |

### Reading part

| Block | Kind | Maps to |
| --- | --- | --- |
| `header` | Projection | Canonical Form, Emoji Description, article, transcription; carries the Reading's Block ID |
| `reading` | Serialized | `ReadingEntry.reading.emojiDescription`; absent for a Foreign Reading. The Lemma comes from `identity` |
| `attestation` | Serialized | `ReadingEntry.attestations`: Attestation Refs, stored as embeds (`![[Scroll#^id\|^]]`) |
| `translation` | Serialized | `ReadingEntry.knowledge.translations` (`en`, `ru`) |
| `attested_translation` | Serialized | `ReadingEntry.attestedTranslations` |
| `definition` | Serialized | `ReadingEntry.knowledge.definition` |
| `transcription` | Serialized | `ReadingEntry.knowledge.transcription`; shown in `header`, no rendering of its own |
| `relation` | Serialized | `ReadingEntry.knowledge.semanticRelations`: direct claims only, in one target mode |
| `pending_relation` | Serialized | `PendingSemanticRelationRecord`s whose `sourceReading` is this Reading |
| `inverse_relation` | Projection | Inverse and inferred edges from dumrel's `projectSemanticRelations` |
| `morphology` | Serialized | `ReadingEntry.knowledge.morphologicalTree` |
| `valency` | Serialized | `ReadingEntry.knowledge.valency` |
| `participle_source` | Serialized | `ReadingEntry.knowledge.participleSource` |
| `plural` | Serialized | `ReadingEntry.knowledge.plural` (forms, `NoPlural` or `PluralOnly`) |
| `conjugation_class` | Serialized | `ReadingEntry.knowledge.conjugationClass` |
| `locution_type` | Serialized | `ReadingEntry.knowledge.locutionType` |
| `saying_type` | Serialized | `ReadingEntry.knowledge.sayingType` |
| `formula_role` | Serialized | `ReadingEntry.knowledge.formulaRole` |
| `inflection` | Projection | Inflection table |
| `tags` | Projection | Tags derived from the Lemma's route and Core Features and the Reading's Knowledge |
| `notes` | Serialized | `ReadingEntry.notes`; omitted when empty |
| `freeform` | Plugin-owned | Opaque user content, byte-preserved |

### Surface part

| Block | Kind | Maps to |
| --- | --- | --- |
| `surface` | Serialized | `SurfaceEntry.surface`; carries the Surface's Block ID. `id` is recomputed with `makeSurfaceId`, and `ownerLemma` comes from `identity` |
| `attestation` | Serialized | `SurfaceEntry.attestations` |
| `attested_translation` | Serialized | `SurfaceEntry.attestedTranslations` |
| `notes` | Serialized | `SurfaceEntry.notes`; omitted when empty |
| `freeform` | Plugin-owned | Opaque user content, byte-preserved |

A serialized Block whose field is absent or empty is omitted. The codec adds no Block for a Knowledge aspect the route's Knowledge Policy does not apply.

### Dropped

- `root_meta`. Every root field now belongs to a dumdict record and a Block above.
- `inherent_features`. Core Features are Lemma identity ([ADR 0002]) and live in `identity`.
- The Selection identity fields. Selection is retired ([ADR 0003]). An Attestation has no durable identity, so no Block stores one; a durable source reference is an Attestation Ref in `attestation`.
- `deviation`, `morphem` and the propagated `morphology` backlinks of the legacy notes. The Morpheme breakdown is now `morphology`. See open question 5 for the rest.

## Plugin-owned values

**Block IDs.** Each Reading part and Surface part carries one Obsidian block ID. A Reading's ID is a short hash of its `readingIdentityKey`; a Surface's is a short hash of its `SurfaceId`. Both keys are JSON and are not valid block IDs. The prefix tells the scopes apart: `^r-<hash>` and `^s-<hash>`.

- The hash function and length are fixed by the codec and must not change between versions, since links and scroll targets use the IDs.
- A collision inside one note lengthens both colliding IDs deterministically.
- The codec returns the map from Block ID to `readingIdentityKey` or `SurfaceId` beside the document. The map is recomputed from data on every parse and is never stored.
- An ID that does not match its part's identity is reported as `BlockIdMismatch`. Parse does not repair it.

**`closed_set_membership`.** A link to the closed-set Library leaf that plugin ADR-0008 routes through a surface host. It survives only while that ADR does. See open question 3.

**Freeform.** User content inside a part, or before the first part. The document layer keeps its bytes and position. It is never converted to `ReadingEntry.notes`, which dumdict validates and may rewrite.

## Projections

The codec is pure, so the caller supplies every input a projection reads beyond the note itself:

| Projection | Input |
| --- | --- |
| Note path | Not rendered by the codec. The store derives it from `identity` ([#52](https://github.com/clockblocker/filler-de/issues/52)) |
| `header` | `identity`, `reading`, `transcription`, and the Block ID |
| `tags` | `identity` and the Reading's Knowledge |
| `inverse_relation` | `SemanticRelationProjection`s for this note's Readings, computed by the store with `projectSemanticRelations` over the relation edges that target this Lemma, with dictionary-wide `readingCounts` |
| `inflection` | Open; see open question 4 |
| Wikilinks in any rendering | A caller-supplied link renderer for a Lemma or Reading target |

Inverse relations are never written as data, in this note or any other. The `relation` Block holds only direct claims (synonym, nearSynonym, antonym, nearAntonym, hypernym, holonym, endonym), and dumrel's stored Knowledge has no field for an inverse such as hyponym or meronym ([ADR 0012]). Every relation stays inside its source's relation space ([ADR 0020]). When a commit adds or removes an edge, the store re-renders the `inverse_relation` Block of each affected target note ([#59](https://github.com/clockblocker/filler-de/issues/59)). Exonyms, Governors and participle users follow the same rule if rendered.

A pending relation targets a Unit Shadow, not a note, so its rendering is unlinked text.

## Invariants

1. A note must have exactly one `identity` Block, in its Lemma part.
2. `identity` is the only source for the Lemma. Paths, headers, tags and Block IDs never define it.
3. Every Reading part must have exactly one `reading` Block, except a Foreign Reading, which has none. The Reading is `{ lemma, emojiDescription }`, with the Lemma from `identity`.
4. A Foreign Lemma's note must have exactly one Reading part.
5. Readings must be distinct by `readingIdentityKey`. Owned Surfaces must be distinct by `SurfaceId`.
6. Every owned Surface's Lemma must equal the note's Lemma by `lemmaIdentityKey`.
7. Every pending relation's `sourceReading` must be its part's Reading, and `locator.sourceReadingKey` must be that Reading's `readingIdentityKey`.
8. Every reconstructed record must validate with its `parseAs*` parser.
9. Projection Blocks must not be parsed into data.
10. Parse must not repair content. Normalization must be an explicit operation.
11. Block order within a part must not change parse meaning.
12. Default serialization must use canonical order.
13. The document layer must preserve freeform and unknown Blocks byte for byte.

## Repeated Blocks

`freeform` and unknown Blocks can repeat. Every other Block occurs at most once per part. If one repeats:

- strict conversion must fail;
- loose conversion must report `DuplicateBlock`;
- normalization may merge list payloads (`attestation`, `attested_translation`, `pending_relation`) only through an explicit policy.

## Parse and normalize

Parsing has two steps:

1. `parseDocument*` converts Markdown to `LemmaNoteDocument`.
2. `documentToData*` reconstructs and validates `LemmaNoteData`.

`parseData*` is a convenience composition.

Strict document parsing must fail on invalid part or Block structure. Strict data conversion must fail on a missing identity, a duplicate Block, an inconsistent record (invariants 3 to 7), an invalid payload, or a record its `parseAs*` parser rejects.

Loose document parsing must preserve valid Blocks, freeform Blocks, unknown Blocks, and known Blocks with an unparseable payload.

Loose data conversion must return structured issues and partial-invalid parts. The store quarantines a note with any data issue and never throws ([#58](https://github.com/clockblocker/filler-de/issues/58)).

Normalization may:

- deduplicate list payloads;
- merge duplicate Blocks when policy allows;
- canonicalize part and Block order;
- regenerate projection Blocks and Block IDs;
- normalize payload formatting.

Normalization must not rewrite freeform content.

## Serialization

Default part order is the Lemma part, then Reading parts in `readingEntries` order, then Surface parts in `ownedSurfaceEntries` order.

Default Block order within a Reading part follows the table above, from `header` to `freeform`. A Surface part follows its table. Absent Blocks are skipped.

`serializeDocument` may preserve encountered order. `serializeData` uses canonical order and places freeform content last in its part, unless the caller supplies a layout policy.

`document -> data -> document` can lose freeform placement. A caller that needs exact placement must stay on the document layer.

`serializeData` always renders projection Blocks from its inputs, since a Lemma note is regenerated as a whole. `serializeDocument` regenerates them only on request.

The final marker syntax is not fixed. It must:

- identify part and Block boundaries without prose heuristics;
- use stable Block kind names, independent of visible titles;
- keep visible titles cosmetic and localized;
- hide serialized payloads in Obsidian's reading view;
- permit byte-preserving storage of unknown Blocks and freeform content.

## Public API

```ts
parseDocumentStrict(markdown, options?): LemmaNoteDocument
parseDocumentLoose(markdown, options?): { document: LemmaNoteDocument; issues: CodecIssue[] }

documentToDataStrict(document, options): LemmaNoteData
documentToDataLoose(document, options): { data: PartialLemmaNoteData; issues: CodecIssue[] }

parseDataStrict(markdown, options): LemmaNoteData
parseDataLoose(markdown, options): { data: PartialLemmaNoteData; issues: CodecIssue[] }

blockIdsOf(data): Map<string, ReadingIdentityKey | SurfaceId>

normalizeDocument(document, options?)
normalizeData(data, options?)

serializeDocument(document, options?): string
serializeData(data, projections, options?): string
dataToDocument(data, projections, options?): LemmaNoteDocument
```

`options` binds the dumling language. `projections` carries the inputs listed under Projections. Strict functions return typed failures rather than throwing.

`normalizeData` accepts valid `LemmaNoteData`. It must not accept partial-invalid loose output.

## Issue families

The codec must use structured issues. Minimum families are:

- `MissingIdentity`
- `DuplicateBlock`
- `InvalidBlockPayload`
- `InvalidRecord` (a `parseAs*` rejection)
- `InconsistentRecord` (invariants 3 to 7)
- `BlockIdMismatch`
- `UnknownTypedBlock`
- `UnsupportedTopLevelContent`
- `OrderingNormalized`
- `BlockMerged`

## Acceptance

Tests must cover:

- round trips (`parse -> serialize -> parse`) for each German Family, including a Locution, a Saying, a Morpheme, a Foreign Lemma and a Syncretism;
- nested payloads: a morphological tree, a Valency Frame, both relation target modes, and pending relations;
- several Readings of one Lemma (`Mutter` 👩 with `Mütter` and 🔩 with `Muttern`, [ADR 0038]);
- owned Surfaces;
- missing and duplicate identity Blocks;
- rejection of identity derived from the path, header, tags or Block IDs;
- `parseAs*` rejections and inconsistent records as typed issues, never throws;
- a stored inverse relation rejected;
- Block ID derivation, collisions and mismatches;
- freeform and unknown-Block round trips;
- order-independent parsing and canonical serialization order;
- explicit duplicate normalization.

## Open questions

1. **Wikilink form in renderings.** Whether `header`, `relation`, `inverse_relation` and `morphology` render path-qualified links or bare ones, and what a bare `[[See]]` resolves to when several Lemma notes share a spelling. Depends on [#52](https://github.com/clockblocker/filler-de/issues/52) and [#53](https://github.com/clockblocker/filler-de/issues/53). The codec takes a link renderer until then.
2. **Path healing.** Who heals a note whose path disagrees with its `identity`, and how Syncretisms and long Sayings are spelled. [#52](https://github.com/clockblocker/filler-de/issues/52), questions 4 to 6.
3. **`closed_set_membership`.** Whether it survives, and whether closed-class Lemma notes, including generated Syncretisms, live under `Worter/` or in the Library. Depends on [#53](https://github.com/clockblocker/filler-de/issues/53) and the fate of plugin ADR-0008.
4. **`inflection`.** What the table projects from: owned Surfaces, `plural` and `conjugation_class`, a dumcorpus paradigm, or a plugin-owned generator kept beside dumdict state. If it stays generated, it becomes a plugin-owned Block rather than a projection. Depends on [#62](https://github.com/clockblocker/filler-de/issues/62).
5. **Morphemes, features and tags.** Whether morpheme "used in" backlinks become a projection over `morphologicalTree`, whether any tag source beyond dumling identity and dumrel Knowledge survives, and whether `deviation` returns. dumgen does not produce these yet. Depends on [#62](https://github.com/clockblocker/filler-de/issues/62).

Open implementation choices for [#55](https://github.com/clockblocker/filler-de/issues/55) are the marker syntax, the hash function and length, option names, and issue payload fields.

[dumling]: https://github.com/clockblocker/texteater/blob/main/battery/dumling/GLOSSARY.md
[dumrel]: https://github.com/clockblocker/texteater/blob/main/battery/dumrel/GLOSSARY.md
[dumdict]: https://github.com/clockblocker/texteater/blob/main/battery/dumdict/GLOSSARY.md
[ADR 0002]: https://github.com/clockblocker/texteater/blob/main/docs/adr/0002-lemma-is-grammatical-identity-and-reading-is-semantic-identity.md
[ADR 0003]: https://github.com/clockblocker/texteater/blob/main/docs/adr/0003-attestation-supersedes-selection-and-owns-realization-coverage.md
[ADR 0011]: https://github.com/clockblocker/texteater/blob/main/docs/adr/0011-use-reading-owned-lemma-targeted-semantic-relations.md
[ADR 0012]: https://github.com/clockblocker/texteater/blob/main/docs/adr/0012-store-only-direct-semantic-relation-claims.md
[ADR 0020]: https://github.com/clockblocker/texteater/blob/main/docs/adr/0020-keep-semantic-relations-inside-one-family.md
[ADR 0031]: https://github.com/clockblocker/texteater/blob/main/docs/adr/0031-resolve-readings-through-the-emoji-description-alone.md
[ADR 0038]: https://github.com/clockblocker/texteater/blob/main/docs/adr/0038-store-german-inflection-classes-as-reading-knowledge.md
[ADR 0044]: https://github.com/clockblocker/texteater/blob/main/docs/adr/0044-identify-german-pronouns-by-pillar-stem-and-referent.md
[ADR 0045]: https://github.com/clockblocker/texteater/blob/main/docs/adr/0045-give-foreign-material-a-foreign-family-and-retire-lexeme-x.md
[ADR 0046]: https://github.com/clockblocker/texteater/blob/main/docs/adr/0046-generate-a-syncretism-for-each-form-only-its-referent-resolves.md
