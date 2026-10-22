# Lemma and Reading note codec specification

- Status: Implemented by [#112](https://github.com/clockblocker/filler-de/issues/112) in `@textfresser/lemma-note-codec`. The dictionary store writes Lemma, Reading and Crossroad notes since [#113](https://github.com/clockblocker/filler-de/issues/113): see The dictionary store.
- Owner: Textfresser
- Compatibility: Clean break from the one-note-per-Lemma format. The Dictionary reset ([#65](https://github.com/clockblocker/filler-de/issues/65), [#117](https://github.com/clockblocker/filler-de/issues/117)) regenerates old notes into this layout.
- Tracking: the [layout map](https://github.com/clockblocker/filler-de/issues/105), implemented by [#111](https://github.com/clockblocker/filler-de/issues/111) (paths) and [#112](https://github.com/clockblocker/filler-de/issues/112) (notes)

Related decisions:

- [ADR-0007: Separate note documents from semantic note data](../../../docs/adr/0007-separate-note-documents-from-semantic-note-data.md)
- [ADR-0011: Use different compatibility policies for domain and infrastructure](../../../docs/adr/0011-use-different-compatibility-policies-for-domain-and-infrastructure.md)
- [ADR-0015: Store the dictionary as Lemma, Reading and Crossroad notes](../../../docs/adr/0015-store-the-dictionary-as-lemma-reading-and-crossroad-notes.md)
- Batteries [ADR 0002] (Lemma and Reading identity), [ADR 0003] (Attestation supersedes Selection), [ADR 0011], [ADR 0012] and [ADR 0020] (direct Semantic Relations), [ADR 0031] (Emoji Description), [ADR 0038] (plural and conjugation class), [ADR 0044] and [ADR 0046] (pronoun cells and Syncretisms), and the Lemma Paradigm and inflection-table design ([texteater#1220](https://github.com/clockblocker/texteater/issues/1220))

ADR-0007 predates the batteries. Its "Lemma and Selection content" now means the dumdict records below.

Terms follow the [dumling], [dumrel] and [dumdict] glossaries and `CONTEXT.md`.

## Purpose

`@textfresser/lemma-note-codec` converts between dumdict records and two kinds of Markdown note: the **Lemma note** of one Lemma and the **Reading note** of one of its Readings.

It owns:

- the typed note documents and their conversion to dumdict records;
- the metadata payloads it hands the note-metadata facility, their schemas and versions;
- the rendering boundary between its renderings and user text;
- rendering of projection Blocks from data the caller supplies;
- Block IDs;
- deterministic serialization;
- structured codec issues;
- dictionary note paths, as its own module (ADR-0015, #111).

It must not own:

- vault I/O, lookup, revisions, commits, or cross-note invariants (the dictionary store, #113);
- the metadata facility's storage format (`src/stateless-helpers/note-metadata/`, [#107](https://github.com/clockblocker/filler-de/issues/107));
- link resolution: it renders the `LinkTarget` the store holds and decides nothing;
- Crossroad notes, which hold no records (#114; see The dictionary store);
- inflection rules or labels (`dumdict/inflection`, `dumcorpus/inflection`);
- prompts or generation (dumgen);
- linguistic or Knowledge schemas (dumling, dumrel).

It depends only on the batteries, and on zod for its metadata schemas. It must not import VAM types such as `SplitPath`, or any other `@textfresser/*` package.

dumdict's own serialized note (`battery/dumdict/src/dto/serialized-note.ts`) is its reference store's internal shape. The codec must not depend on it.

## Two note kinds

| Record | Count | Note |
| --- | --- | --- |
| `LemmaRecord`, with its Lemma Paradigm | exactly 1 | the Lemma note |
| `SurfaceEntry` (owned) | 0 or more | the Lemma note |
| `ReadingEntry`, with its Attestation Links | exactly 1 per note | its Reading note |
| `PendingSemanticRelationRecord` | 0 or more | the Reading note of its source Reading |

Every Reading of a Lemma has its own Reading note in the Lemma note's folder. The Lemma note is also the note of the Lemma's base-form Surface, and no inflected Surface gets a note of its own.

Paths spell identity (ADR-0015), but metadata stays authoritative. The note codec never reads a path.

A Foreign Lemma has exactly one Reading, with no Emoji Description ([ADR 0045]); its Reading note is `∅ <name>.md`. A Lemma Syncretism is a Lemma like any other: its `syncretic` list is part of its identity, and its `syncretized` units are content of its `LemmaRecord` ([ADR 0046]).

## Required model

The codec exposes two layers per note kind, as ADR-0007 requires. It reads and writes a note as its visible **body** and its **metadata**, the value of the note kind's namespace in the note-metadata facility. It never touches the facility's storage format; the plugin composes the two (`src/stateless-helpers/dictionary-notes.ts`).

```ts
type LemmaRecords<L> = {             // every record of one Lemma
	lemmaRecord: LemmaRecord<L>;      // with its Lemma Paradigm
	readingEntries: ReadingEntry<L>[];
	ownedSurfaceEntries: SurfaceEntry<L>[];
	pendingRelations: PendingSemanticRelationRecord<L>[];
};
type LemmaNoteData<L> = { lemmaRecord: LemmaRecord<L>; ownedSurfaceEntries: SurfaceEntry<L>[] };
type ReadingNoteData<L> = { readingEntry: ReadingEntry<L>; pendingRelations: PendingSemanticRelationRecord<L>[] };

type LemmaNoteDocument = { metadata: LemmaNoteMetadata | undefined; segments: BodySegment[] };
type ReadingNoteDocument = { metadata: ReadingNoteMetadata | undefined; segments: BodySegment[] };
```

Rendering either note reads the Lemma's records: a Lemma note links its Readings and draws one table per Licence Group, and a Reading note embeds its group's table.

### API

```ts
// Lemma notes
parseLemmaNote(note: { body; metadata: LemmaNoteMetadata | undefined }, { language }): { document; data }
serializeLemmaNote(records: LemmaRecords<L>, options?: SerializeOptions<L>): { body; metadata: LemmaNoteMetadata }
renderLemmaNote(records, options?: RenderOptions<L>): string

// Reading notes
parseReadingNote(note: { body; metadata: ReadingNoteMetadata | undefined }, { language }): { document; data }
serializeReadingNote(records, reading: Dumling.Reading<L>, options?: SerializeOptions<L>): { body; metadata: ReadingNoteMetadata }
renderReadingNote(records, reading, options?: RenderOptions<L>): string

// Metadata: the plugin defines its namespaces from these specs
LEMMA_NOTE_METADATA     // { name: "lemma-note", key: "lemmaNote", version: 1, schema, migrations }
READING_NOTE_METADATA   // { name: "reading-note", key: "readingNote", version: 1, schema, migrations }
lemmaNoteDataOf(metadata, { language }) / readingNoteDataOf(metadata, { language })   // metadata → records

// Rendering boundary, tables, paths
readBody(body, seals): BodySegment[]; sealOf(rendering): RenderingSeal
BodyWriter; renderingLines(text)   // for other notes with user text, such as Crossroads (#114)
inflectionFromPack(pack, draw = drawTable): InflectionHook<L>; lemmaTables(hook, input); tableOfReading(tables, reading)
surfaceBlockIds(surfaces); tableBlockIds(selectionKeys)
notePathsOf(records): { lemma; readings; claims; collisions }
```

`RenderOptions` are the projections' inputs: `resolve` (the store's link resolutions), `paths`, `inflection`, `tags`, `inverseRelations` and `titles`. `SerializeOptions` adds `previous`, the document parsed from the note's current file, whose freeform serialize keeps. Parse never throws and never repairs; serialize throws `NoteSerializeError` for records no valid note holds, such as a Reading of another Lemma.

A document preserves the bytes of freeform text. Data holds dumdict records only, each validated by dumdict's `parseAs*` parser for the codec's language; an invalid note returns typed issues, never invalid content as a record.

## Metadata and Blocks

Every visible Block is a rendering: of data, which lives in the note's metadata, or a projection. No visible line is ever parsed as data. The metadata payload round-trips nested dumling and dumrel values, such as morphological trees and Valency Frames, without loss; the facility escapes `[` (and, in the hidden section, `%`, `<` and `#`) so that no link, embed or comment syntax inside it reaches Obsidian's index (#107, #112).

### Lemma note

Metadata, `lemmaNote`:

| Field | Holds |
| --- | --- |
| `lemma` | `LemmaRecord.lemma`: language, Family, Kind, Core Features, Canonical Form and, for a Syncretism, `syncretic` and `syncretized` |
| `paradigm` | `LemmaRecord.paradigm`: Paradigm Variants per Variation Dimension and each Reading's Licences (texteater#1226); absent when the Lemma has none |
| `surfaces` | One entry per owned `SurfaceEntry`: its `surface`, and its `attestations`, `attestedTranslations` and `notes` when not empty. Its id and owner are rebuilt from the Surface and the note's Lemma |
| `rendering` | The seals of the body's renderings (Rendering boundary) |
| `tables` | The versions its tables were rendered at (#121): `pack`, the Inflection Pack's `version`, and `schema`, the Table Schema's `id` and `version` when the Lemma has one. It is no record; it is absent when the inflection hook names no versions, or in a note written before they were recorded |

Visible Blocks, in order:

| Block | Shows |
| --- | --- |
| `header` | A German noun's article and a link to the Lemma's spelling |
| `readings` | One link per Reading note, its alias the Emoji Description (the Canonical Form for a Foreign Reading) |
| `flexion_title`, `inflection` | One table per Licence Group, from the inflection hook, each captioned with its group's emojis and ending in its Block ID |
| `surface` | One list item per owned Surface: its form, its Surface Axes, any Licence Conflict mark and its `^s-<hash>` Block ID, under "Begegnete Formen" |

Freeform stands last.

### Reading note

Metadata, `readingNote`:

| Field | Holds |
| --- | --- |
| `reading` | `ReadingEntry.reading`, its Lemma included, so the note names its identity alone and the store can tell a Reading note outside its Lemma's folder |
| `knowledge` | `ReadingEntry.knowledge`, as is |
| `attestationLinks` | Each Attestation Link as `{ ref, surfaceId }`; its Reading is the note's (texteater#1227) |
| `attestedTranslations`, `notes` | `ReadingEntry`'s learner content, when not empty |
| `pendingRelations` | The `PendingSemanticRelationRecord`s whose source is the note's Reading, as `{ relation, target, resolvedLemma? }`; source and locator are rebuilt from the Reading |
| `rendering` | The seals of the body's renderings |

Visible Blocks, in canonical order (see Layout):

| Block | Shows |
| --- | --- |
| `header` | Emoji Description, article, a link to the Lemma note, transcription |
| `attestation` | Each Attestation Link's ref, the Scroll embed |
| `notes_title`, `notes`, `notes_placeholder` | The Note title, `ReadingEntry.notes`, and `*You can write here*` while there is neither notes nor freeform |
| `relation`, `pending_relation`, `inverse_relation` | Direct claims, unresolved pending relations, and inverse edges from dumrel's `projectSemanticRelations` |
| `morphology` | The morphological tree's leaves |
| `translation`, `attested_translation` | Translations, then attested translations they do not list |
| `definition`, `valency`, `participle_source`, `locution_type`, `saying_type`, `formula_role` | The matching Knowledge fields |
| `inflection_embed` | `![[<lemma note>#^<block id>\|<Canonical Form>]]`: the Lemma note's table of this Reading's Licence Group |
| `tags` | Tags from the tags hook |

Principal parts (`plural`, `conjugationClass`, `preterite`, `presentSingular`, `pastParticiple`, `subjunctivePast`) left Reading Knowledge for the Lemma Paradigm (texteater#1226). A Block whose field is absent or empty is left out, and a new dumrel Knowledge aspect fails to compile until a Block shows it.

### Dropped

- The part and Block markers (`%%tf-part…%%`, `%%tf:<kind>…%%`) and their seals. Data lives in metadata.
- Reading parts and their `^r-<hash>` Block IDs. A Reading is a note.
- `root_meta`, `inherent_features`, the Selection identity fields and `closed_set_membership`, as before: Core Features are Lemma identity ([ADR 0002]), Selection is retired ([ADR 0003]), and closed-class Lemmas have their own notes under `Worter/`.
- `deviation`, `morphem` and the propagated `morphology` backlinks of the legacy notes (open question 2).

## Plugin-owned values

**Block IDs.**

- A met Surface's line carries `^s-<hash>`, the first 8 hex digits of the SHA-256 of its `SurfaceId`. Table cells and other notes link a Surface as `<lemma note>#^s-<hash>`.
- A table's ID is `^t` when the Lemma has a single Licence Group, otherwise `^t-<hash>` of the group's `selectionKey`. IDs are assigned over every group the inflection hook names, so one group's table emptying never moves another's.
- The hash function and length are fixed by the codec and must not change between versions, since links and embeds use the IDs. A collision inside one note lengthens both colliding IDs deterministically.
- Block IDs are recomputed from data on every parse and are never stored.

**Freeform.** User content anywhere in either note. The document layer keeps its bytes. It is never converted to `ReadingEntry.notes`, which dumdict validates and may rewrite.

## Projections

The codec is pure, so the caller supplies every input a projection reads beyond the records:

| Projection | Input |
| --- | --- |
| Note paths | `paths`; by default the path module (ADR-0015). `notePathsOf` gives a Lemma's notes' paths and the collisions among them |
| `readings` | The Lemma's Reading Entries, in the records |
| `inflection`, `inflection_embed`, Surface Axes, Licence Conflicts | The `inflection` hook. `inflectionFromPack(pack)` builds one from `projectLemmaTables`' `LemmaTablesView` (texteater#1228), drawing each group with `drawTable` and the pack's `labels` and `display`, its Surface Axes from `surfaceAxes` through `labels.bundle`. The plugin's hook is `inflectionFromPack(inflectionPacks.de)`, the German Inflection Pack of `dumcorpus/inflection` (texteater#1229) |
| `tags` | The `tags` hook |
| `inverse_relation` | The `inverseRelations` hook: `SemanticRelationProjection`s for this Reading, computed by the store; see Projected inverse relations |
| Links in any rendering | `resolve`: the `LinkTarget` the store holds for each link (texteater#1221) |

Inverse relations are never written as data, in this note or any other. The `relation` Block holds only direct claims (synonym, nearSynonym, antonym, nearAntonym, hypernym, holonym, endonym), and dumrel's stored Knowledge has no field for an inverse such as hyponym or meronym ([ADR 0012]). Every relation stays inside its source's relation space ([ADR 0020]).

### Links

The codec decides no link target. Each link it renders is a `LinkSubject`: its role (`header`, `reading`, `relation`, `pendingRelation`, `inverseRelation`, `morpheme`, `valency`, `participleSource`) and what the data names (an exact Lemma, an exact Reading, or a Unit Shadow). The caller's `resolve` answers the `LinkTarget` the store holds for it, and the codec maps the target to a path:

- `Lemma` renders a link to that Lemma note;
- `Spelling` renders the Crossroad path, `crossroadNotePath`;
- `Reading` renders a Reading note, only for links whose exact sense is known.

Without `resolve`, the codec renders what a note knows without a lookup (`defaultResolve`):

- **Sense known.** An exact Reading goes to its Reading note: a Lemma note's links to its own Reading notes, a morphological leaf that is an exact `morphemeReading`, and a claim in Reading target mode.
- **Exact Lemma.** A direct claim's Lemma goes to its Lemma note, since dumdict holds a direct claim only on a stored Lemma, and so does a Reading note's header, which names its own Lemma.
- **Sense unknown.** Everything else goes to the Crossroad note of its spelling, with the spelling as alias, such as `[[Worter/k/kra/kraft/kraftwerk|Kraftwerk]]`: pending relations, morpheme Shadows, inverse relations (by their source's Lemma's Unit Shadow), a Valency Frame's preposition and a participle's source verb, which may be stored nowhere, and a Lemma note's header.

The store re-evaluates resolutions in bulk when Lemmas are added or removed and re-renders the affected notes (The dictionary store). A resolved Pending Semantic Relation is not rendered: its direct claim shows it. The codec makes no lookup, and rendering twice against the same inputs gives identical bytes.

## Invariants

The codec checks these for one note:

1. A Lemma note's metadata holds exactly one Lemma Record, a Reading note's exactly one Reading Entry.
2. The metadata is the only source of data. Paths, headers, tags, tables and Block IDs never define it.
3. Owned Surfaces are distinct by `SurfaceId`, and each one's Lemma equals the note's Lemma by `lemmaIdentityKey`.
4. Every pending relation's source is the note's Reading, by construction.
5. Every reconstructed record validates with its `parseAs*` parser.
6. Visible content is never read as data.
7. Parse does not repair content.
8. Serialization uses canonical order, and serializing what was parsed gives the same note.
9. The document layer preserves freeform text byte for byte.

Serialize checks that every record it is given is its Lemma's, once.

The store checks the cross-note ones:

- Every Reading note has a Lemma note in its folder, and its Reading's Lemma is that note's Lemma.
- Every Reading in a Lemma note's Paradigm has a Reading note, and a Foreign Lemma has exactly one.
- Readings are distinct by `readingIdentityKey` across a Lemma's Reading notes.
- No two identities share a path's collision key (ADR-0015). `notePathsOf` reports the collisions among one Lemma's notes; the store checks its claims against every other note's and never writes one over another.

## Parse and normalize

Parsing a note reads its records from its metadata and splits its body at the rendering boundary. Strict conversion fails on missing metadata, metadata that is not its kind's shape, an inconsistent record, or a record its `parseAs*` parser rejects. The store quarantines a note with any issue and never throws.

A note in the old marker format has no metadata of its kind. It parses to `LegacyMarkerFormat` and `MissingMetadata`, never a throw, so the Dictionary reset can find it, and its whole body reads as freeform.

## Serialization

Default Block order follows the tables above. Freeform stands in the Reading note's Note section, and last in a Lemma note. Serializing always renders projection Blocks from its inputs, since a note is regenerated as a whole.

### Rendering boundary

How a note tells its own renderings from user text without inline seals (#112):

- **Seals in metadata.** Serialize seals each Block's rendering in the note's metadata as `{ block, lines, hash }`: its kind, its line count, and the first 8 hex digits of the SHA-256 of its lines joined by `\n`. A rendering never opens or ends with a blank line; it may hold blank lines, as Deine Kontexte does.
- **Matching.** Parse matches the seals in order, each first at the next non-blank line after the previous match, as an unedited note has it, then anywhere among the lines no other seal claimed, so a section the user moved still counts. Lines are compared without a CRLF file's CR.
- **Retargeted refs.** Obsidian's link updater cannot see the refs in metadata, but it rewrites the Deine Kontexte embeds when their Scroll moves, which breaks the `attestation` seal. When the seal matches once each line that is a stored ref with only its link path changed is put back to that ref, those lines are the rendering again, and the document lists the refs it shows retargeted (`ReadingNoteDocument.retargeted`); a ref copied into the user's text stays freeform. The next serialize writes the rendering once, from the refs the metadata holds (#99).
- **Freeform.** Every line no seal matches is freeform, kept byte for byte and never read as data. A line typed under a rendering leaves the rendering intact. An edited rendering no longer matches its seal, so its lines become freeform, and the next serialize writes a fresh rendering beside them. In a Lemma note, freeform loses the codec-owned Block IDs that end its lines (`^t…`, `^s-…`), so each ID stays once in the note, on the fresh rendering.
- **Placement.** In a Reading note, freeform stands directly under the Note title and notes, and text typed anywhere else moves there; a freeform run holding only the placeholder's words is dropped. In a Lemma note, freeform stands last.
- **Titles** are cosmetic and localized; an empty title leaves its line out.
- **Tables.** Each table is a single Obsidian block: blank lines around it, its caption first and its Block ID on its last line, so an embed shows all of it.

A note whose metadata holds no seals, such as one written by hand, reads as freeform alone; its next serialize writes the renderings and keeps every line of it.

## Issue families

The codec's issues are `MissingMetadata`, `InvalidMetadata` (metadata that is not its kind's shape), `LegacyMarkerFormat`, `InvalidRecord` (a `parseAs*` rejection) and `InconsistentRecord` (the invariants above), each with a location in the metadata where it has one.

## Acceptance

Tests cover (`lemma-note-codec/tests/`, `tests/unit/dictionary-notes/`):

- round trips of both note kinds for each German Family, including a Locution, a Saying, a Morpheme, a Foreign Lemma and a Syncretism;
- nested payloads: a morphological tree, a Valency Frame, both relation target modes, pending relations and a resolved Shadow relation;
- Licence Groups: Mutter 👩 / 🔩 with two tables, melken with one, and senden with partial overlap, with a toy Inflection Pack;
- stable table Block IDs, Reading-note embeds that target their group's table, and Surface lines that keep their `^s-<hash>`;
- links rendered from each `LinkTarget`, and the default resolutions;
- freeform round trips byte for byte in both notes, and a hand-edited rendering read as freeform, never as data;
- golden notes in the user's layout, idempotent writes, both metadata formats, the frontmatter link escape and the toggle;
- path collisions among a Lemma's notes;
- no `%%tf` in any output, and a marker-format note parsed as a typed issue.

## Open questions

1. **Whole-path length.** Windows' 260-character limit without long-path support is not checked; only each segment is capped (ADR-0015).
2. **Morphemes.** Whether morpheme "used in" backlinks become a projection over `morphologicalTree`, and whether `deviation` returns.

## Layout

The codec lays the notes out as the user's dictionary example ([#49](https://github.com/clockblocker/filler-de/issues/49)) shows an entry ([#103](https://github.com/clockblocker/filler-de/issues/103), [#104](https://github.com/clockblocker/filler-de/issues/104)), split across the two notes. Only the visible lines follow the example. Visible text is never parsed.

A Reading note, `🏭 Kohlekraftwerk.md`:

```
🏭 das [[Worter/de/Lexeme/NOUN/Neut/k/koh/kohle/Kohlekraftwerk|Kohlekraftwerk]], [ˈkoːləˌkraftvɛɐ̯k ♫](https://youglish.com/pronounce/Kohlekraftwerk/german)

<span class="note_block_title note_block_title_kontexte">Deine Kontexte</span>
![[Atom#^13|^]]

![[Atom#^14|^]]
<span class="note_block_title note_block_title_kontexte">Note</span>
*You can write here*


<span class="note_block_title note_block_title_synonyme">Semantische Beziehungen</span>
= [[Worter/de/Lexeme/NOUN/Neut/k/kra/kraft/Kraftwerk|Kraftwerk]]
≈ [[Worter/de/Lexeme/NOUN/Fem/i/ind/indus/Industrieanlage|Industrieanlage]], [[Worter/de/Lexeme/NOUN/Fem/f/fab/fabri/Fabrik|Fabrik]]
≠ [[Worter/de/Lexeme/NOUN/Neut/w/win/windr/Windrad|Windrad]]
<span class="note_block_title note_block_title_morpheme">Morpheme</span>
[[Worter/k/koh/kohle/kohle|Kohle]]|[[Worter/k/kra/kraft/kraft|Kraft]]|[[Worter/w/wer/werk/werk|Werk]]
<span class="note_block_title note_block_title_translations">Übersetzung</span>
coal-fired power plant
<span class="note_block_title note_block_title_flexion">Flexion</span>
![[Worter/de/Lexeme/NOUN/Neut/k/koh/kohle/Kohlekraftwerk#^t|Kohlekraftwerk]]
<span class="note_block_title note_block_title_tags">Tags</span>
#noun/neuter
```

The Lemma note of Mutter, `Mutter.md`, whose Readings license two plurals:

```
die [[Worter/m/mut/mutte/mutter|Mutter]]

[[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/👩 Mutter|👩]]
[[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/🔩 Mutter|🔩]]

<span class="note_block_title note_block_title_flexion">Flexion</span>

👩
N: die [[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/Mutter|Mutter]], die Mütter
A: die [[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/Mutter|Mutter]], die Mütter
G: der [[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/Mutter|Mutter]], der Mütter
D: der [[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/Mutter|Mutter]], den Müttern
^t-8ed83aad

🔩
N: die [[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/Mutter|Mutter]], die Muttern
A: die [[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/Mutter|Mutter]], die Muttern
G: der [[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/Mutter|Mutter]], der Muttern
D: der [[Worter/de/Lexeme/NOUN/Fem/m/mut/mutte/Mutter|Mutter]], den Muttern
^t-eb48dc8c

<span class="note_block_title note_block_title_surfaces">Begegnete Formen</span>
- Mütter: Nom.Pl ^s-95e50a29
- Muttern: Akk.Pl ⚠ 👩 → 🔩 ^s-b41162c0
```

Here Muttern was also met in a text judged 👩, whose Licence takes only Mütter: a Licence Conflict, marked on its line and never written into 👩's table.

Tables of other routes, shown with bare links (`paths.lemma` undefined); the Lemma note links them at its path:

```
🚉
Präsens: ich fahre … ab, du fährst … ab, er fährt … ab, wir fahren … ab, ihr fahrt … ab, sie fahren … ab
Präteritum: ich fuhr … ab, du fuhrst … ab, er fuhr … ab, wir fuhren … ab, ihr fuhrt … ab, sie fuhren … ab
Konjunktiv II: ich führe … ab, du führest … ab, er führe … ab, wir führen … ab, ihr führet … ab, sie führen … ab
Partizip II: abgefahren
^t

🐄 💰
Präsens: ich melke, du melkst / milkst, er melkt / milkt, wir [[melken]], ihr melkt, sie [[melken]]
Präteritum: ich melkte / molk, du melktest / molkst, er melkte / molk, wir melkten / molken, ihr melktet / molkt, sie melkten / molken
Konjunktiv II: ich melkte / mölke, du melktest / mölkest, er melkte / mölke, wir melkten / mölken, ihr melktet / mölket, sie melkten / mölken
Partizip II: gemelkt / gemolken
^t

⚡
Positiv: [[schnell]]
Komparativ: schneller
Superlativ: am schnellsten
^t

👉
N: [[dieser]] (m), dieses (n), diese (f), diese (Pl)
A: diesen (m), dieses (n), diese (f), diese (Pl)
G: dieses (m), dieses (n), [[dieser]] (f), [[dieser]] (Pl)
D: diesem (m), diesem (n), [[dieser]] (f), diesen (Pl)
^t
```

- **Header.** In a Reading note: the Emoji Description, a German noun's article, a link to its Lemma note, and the transcription as a YouGlish link with `♫` in its text (`/…/` for a language YouGlish lacks). In a Lemma note: the article and a link to its spelling's Crossroad note. The transcription is Reading Knowledge, so only Reading notes show it.
- **Sections.** In a Reading note, every Block but the header belongs to a section, in this order: Deine Kontexte (`attestation`), Note (`notes_title`, `notes`, `notes_placeholder`), Semantische Beziehungen (`relation`, `pending_relation`, `inverse_relation`), Morpheme (`morphology`), Übersetzung (`translation`, `attested_translation`), Definition, Valenz, Partizip von, Art (`locution_type`, `saying_type`, `formula_role`), Flexion (`inflection_embed`) and Tags. A section opens with its title, `<span class="note_block_title note_block_title_<class>">Title</span>`. The class is the example's: `kontexte` (the Note title's too), `synonyme`, `morpheme`, `translations`, `flexion`, `tags`, and the section's own name for the new ones (`surfaces` in a Lemma note). Titles are cosmetic: `titles` replaces them, and an empty title leaves the line out.
- **Spacing.** A blank line follows the header, two follow the Note section, and sections otherwise stand on consecutive lines, as in the example. In a Lemma note, a blank line separates the header, the Reading links, the Flexion title, each table and the Surface list.
- **Renderings.** Attestation embeds are separated by a blank line. Relations are one line per relation with the dictionary's symbols, `=` synonym, `≈` near synonym, `≠` antonym, `≉` near antonym, `⊃` hypernym, `⊂` hyponym, `∋` holonym, `∈` meronym, `⇒` endonym, `⇐` exonym, each target once, so direct, pending and projected relations read as one list. A morphological tree lists its leaves. Translations show their words, prefixed by the language only when there are several; attested translations show in italics. Links alias the spelling alone. Inflection cells are display-only (batteries ADR 0019).
- **Tables** (`drawTable`) are drawn in the dictionary's line style, never as Markdown grids, from the shape of the pack's view alone; the drawer names no case, tense or person.
  - **One panel** (a noun's declension, a comparison, a stem's declension): one line per row, `<row label>: <cells>`, with no panel caption.
  - **Several panels** (a verb's Präsens, Präteritum, Konjunktiv II and Partizip II): a single-column panel is one line, `<panel label>: <its rows' cells>`, the display's Context telling the rows apart; any other panel is its label on a line of its own, then its rows.
  - **Cells** stand in column order with `, ` between them. In a panel of more than two columns, each cell is followed by its column label (`dieser (m)`), since order alone no longer tells them apart.
  - **Forms** show the pack's display runs: Context as plain text (`die`, `er`), a Gap as ` … ` (`er fährt … ab`), and ` / ` between a cell's forms (`er melkte / molk`), a leading Context they all share shown once. A form that is one Form run spelled as the Lemma's Canonical Form links the Lemma note (link role `inflection`); every other form is plain text, as the dictionary notes wrote them.
  - **Holes.** An Unknown cell, which neither derivation nor a met form fills, shows `?`. An Absent cell, which the language or the group's licensed selection gives no form (a `NoPlural` noun's plural), shows `—`. A met form only one of whose candidate cells this is (a Surface Syncretism placed OneOf) gets ` (?)`. A row with no form, a column Absent in every row, and a panel with neither are left out; a group with no line gets no table. A met form that no stored variant derives in the cell it Covers (`undescribed`) is never written there; it shows only in the Surface list.
- **The Surface list**, "Begegnete Formen", lists every owned Surface, in-core forms included: an Obsidian Block ID cannot sit in a table cell, so the list is where every Surface's `^s-<hash>` anchor lives. Each line is a list item, so each is its own block: `- <form>: <Surface Axes> <marks> ^s-<hash>`.
  - **Surface Axes** come from `surfaceAxes` through the pack's `labels.bundle` (`Dat.Pl`, `Präs.3.Sg`): the bundles of the cells the Surface Covers, `, ` between them, or of the cells it may be OneOf, ` / ` between them, then its bundles that fit no cell.
  - **Licence Conflicts.** A Surface met under a Reading whose Licence doesn't take its form gets `⚠ <that Reading> → <the groups it fits>`, by emoji (`⚠ 👩 → 🔩`), one per Reading. A conflict is never written into a table.
- **Note.** A Reading note always has the Note title, so a user knows where to write. While the note has neither `notes` nor freeform, `notes_placeholder` shows `*You can write here*`.
- **Not rendered.** The example's Verweise section and its compound-parts line have no data, nor do the old "Morphologische Relationen" (Verwendet in) backlinks and "Abweichungen" (open question 2).

## The dictionary store (#113)

`@textfresser/dictionary` keeps the notes the codec reads and writes. Each Markdown file under `Worter/` is, by its metadata:

- a **Lemma note** (`lemmaNote`) or a **Reading note** (`readingNote`), read as data when the codec accepts it and quarantined otherwise;
- a **Crossroad note** (`crossroadNote`), or, without metadata, a file at a Crossroad path, such as the empty note a click on an uncreated Crossroad link leaves;
- without metadata, a **stray** directly in `Worter/` (healed, see Strays and moved Crossroad notes), an **empty file** at an exact Lemma or Reading path, or a quarantined file, such as a note in the retired marker format.

Strays, empty files and Crossroad notes are never quarantined. Empty files at note paths are reported and left alone, and no note is ever written over them.

**Records.** A Lemma's records are its Lemma note's and those of every Reading note whose metadata names its Lemma, wherever it sits. A Reading note whose Lemma no readable Lemma note holds is an orphan; a Lemma whose Paradigm licenses a Reading no note holds, or a Foreign Lemma with two Reading notes, is inconsistent. Both are quarantined and reported; a Lemma created again takes its orphaned Reading notes back. A second note of one Lemma or Reading is a duplicate; the one at its own path holds it.

**Index.** Besides the records, the index keeps a Lemma's notes' paths, Lemma keys by form key (the Crossroad index) and by Unit Shadow, pending relations by Shadow, the claims on each Lemma and its Readings, Attestation Links by ref, the Readings whose links name each Surface, and the Lemmas whose Knowledge names each Shadow outside its claims (a morpheme, a preposition, a source verb).

**Links.** The store's `resolve` answers:

- an exact Reading: its Reading note;
- a direct claim's Lemma, a Reading note's own Lemma and a table's form spelled as its Lemma: the Lemma note;
- an unresolved pending relation and a Lemma note's own spelling: the Crossroad note;
- every other sense-unknown link, a morpheme's Shadow, an inverse relation's source, a preposition or a source verb not stored as named: the Lemma note while its Unit Shadow names exactly one stored Lemma (`resolveShadow`), the Crossroad note otherwise.

**Commits.** A commit stages its changes over the index, renders every note it touches against the index as it will read once the commit lands, and writes them as stop-on-first-failure batches in this order:

1. creates of new Lemma and Reading notes;
2. rewrites of the notes whose records change;
3. re-renders of the other notes whose links or inverse relations the change moves, and of the Crossroad notes of every spelling it touches;
4. removed Reading notes, then removed Lemma notes, to the trash.

Every rewrite is a compare-and-swap with the facility's transforms inside it. A note whose records stay is rewritten only when its metadata, which holds its renderings' seals, changes, so a note the user rearranged is not rewritten for that alone. A Reading note's embed names its Licence Group's table, so a Paradigm Change that splits or merges groups rewrites the Lemma note's tables and its Reading notes' embeds in one commit.

**Transactions.** Classify commits through `transact(plan, { maxAttempts })`, never by planning from reads and calling `commitChanges` after. `plan` runs under the store's lock, the one commits, observed changes and rescans take, against one index version (`DictionaryView`), and the commit runs under the same lock, so no other writer moves the revision in between. `plan` is synchronous and answers a `Transaction`: `Commit` a plan, `CommitAndReplan` (commit, then plan again under the lock, as moving an occurrence removes it first), `Stop` with a value (a New judged against Readings that are no longer all of its Lemma's), or `Replan`. Work that waits, such as a model's judgement or a quiet period, goes before the transaction; a plan that finds it stale stops, and its caller redoes it and transacts again. A commit plans again, after releasing the lock so pending events land, only when it meets a change made outside the store: a file ahead of the index, or a write VAM failed as `conflict`, `exists` or `missing` (`DictionaryWriteError.externalChange`). After `maxAttempts` plans it fails with `DictionaryTransactionConflict`. A write VAM failed as `io` (`DictionaryWriteError.transient`), such as a file another process held, plans again once, after a short pause and within the attempts; any other failure fails it at once.

**Renamed Scrolls (#99).** An Attestation Ref names its Scroll by basename (`@textfresser/lemma-note-codec`'s `attestationRef` and `parseAttestationRef`) when Obsidian opens the Scroll for it, and by its vault path without `.md` otherwise. Classify asks the store for that name before it writes a ref (`scrollRefNames`, #198), so the store's rewrite and Classify name a Scroll alike. When the store hears a Markdown note or a folder outside `Worter/` renamed, from any origin but its own, it rewrites every ref naming it in one `transact` (`dictionary.rewriteScrollRefs`, `src/scroll-refs.ts`). It first asks Obsidian, through VAM's `resolveLinkpathDest` and `findByBasename`, how the names resolve, then plans under the lock from the index as it is then. Names compare as Obsidian matches link names, ignoring case (#199):

- refs naming the old basename or the old path take the Scroll's new name: its basename when Obsidian opens the Scroll for it, its path otherwise; a folder rename moves the refs that name a path below it, and none that name a basename;
- refs whose old basename Obsidian opens another note outside `Worter/` for, one that did not take the name in the same bulk, stay, and are logged: they may be that note's. If, within a minute, the store hears that note take the name in a rename of its own, as when two Scrolls swap names in separate bulks, the refs move as if both renames had come in one bulk; a rename that first moves that note away shows it had the name all along, and the refs stay. A note under `Worter/` owns no ref's name, so refs whose old basename only dictionary notes have move;
- refs that already named the new basename, when the renamed Scroll now wins it and exactly one other note outside `Worter/` had it, move to that note's path;
- a ref moves only where no ref stays and no other ref moves; a Reading's links keep their order, and refs may trade names, as in a swap; a chain of renames in one bulk is one rename;
- a rename heard twice, or after Obsidian already rewrote the embeds, writes once, and the store waits for its pending modifications before it plans.

**One ref per occurrence (#198).** A stored ref with the occurrence's block and key that names its Scroll by another spelling Obsidian opens the Scroll for, such as its path after the basename became the Scroll's again, stands for the occurrence: Classify records the occurrence under that ref (`storedRefFor`) and adds no second one.

After every full read, refs Obsidian retargeted while the store was not listening are adopted: a retargeted ref whose stored name opens no note and whose shown name opens a note outside `Worter/` takes that note's name, as one commit. A Scroll moved outside Obsidian leaves nothing to adopt. Splitting a Scroll into pages creates new notes and trashes the old one, with new block IDs, so it renames no ref.

**User text in removed notes.** A removed Reading note's freeform moves to its Lemma note; a removed Lemma's notes' freeform moves to its spelling's Crossroad note, which is never removed and says "not classified yet" once its spelling has nothing left.

**Crossroad notes (#114).** The store renders them itself (`dictionary/src/crossroad.ts`); the codec only lends `BodyWriter`, `readBody` and `articleOf`. A Crossroad is a router page under the dictionary's section titles, one line per Lemma and per met Surface, each its own sealed Block:

```
<span class="note_block_title note_block_title_eintraege">Einträge</span>
- die [[Worter/de/Lexeme/NOUN/Fem/s/suc/sucht/Sucht|Sucht]]: [[Worter/de/Lexeme/NOUN/Fem/s/suc/sucht/💉 Sucht|💉]]
<span class="note_block_title note_block_title_surfaces">Begegnete Formen</span>
- sucht → [[Worter/de/Lexeme/VERB/s/suc/suche/suchen|suchen]] (VERB)
```

That is `Worter/s/suc/sucht/sucht.md`. der See and die See share `Worter/s/see/see/see.md`, one line each.

- **Einträge** lists every Lemma whose Canonical Form has the note's key, by Lemma key: a noun's article, or the Kind in parentheses for any other Lemma (`[[…/gehen|gehen]] (VERB)`), and its Reading notes by emoji.
- **Begegnete Formen** lists every met Surface of another Lemma with that key, as `<form> → <its Lemma>`, so `Tage` lands on `Tag`.
- **Not classified yet.** A spelling with neither shows the Einträge title over `*Not classified yet*`. That is what a Crossroad note goes back to when its spelling loses its last Lemma and Surface, and what the empty note a click on an uncreated Crossroad link leaves is filled with. The store generates no Knowledge for it.
- **Freeform** follows the renderings after a blank line and is kept byte for byte; an old layout's sealed renderings are replaced, not kept.
- **Metadata** (`crossroadNote`) holds the key, the language and the renderings' seals, so a Crossroad note is stale exactly when its seals or key differ from what the index renders, and the store tells that without reading the file.
- **When the store writes one:** in every commit that changes its spelling's Lemmas or Surfaces; when a file appears or changes at a Crossroad path without being current, such as a click's empty note or one without metadata; and after every full read of `Worter/`, at startup, after a rescan and after a rebuild, for every spelling missing its note or holding a stale one. A missing note is created only while its spelling has something to list, so a spelling whose note was never created gets none. A hand edit of a current note is left alone, a note the user deletes stays deleted until the next full read, and a second regeneration writes nothing.
- **Collisions.** A Crossroad note is never created over a file or folder the vault spells another way, nor beside another created Crossroad note it collides with. Names are lossy (`C#` and `C` are both `c.md`), so the first spelling's note keeps its path and the other is reported.

**Strays and moved Crossroad notes (#115).** Clicking an unresolved bare link such as `[[Fahrer]]` makes Obsidian create `Worter/Fahrer.md` (`newFileLocation: folder`, `newFileFolderPath: Worter`). Healing, after every full read and every observed change, treats such a stray, and a Crossroad note moved away from its own path, as its spelling's Crossroad note: the stray's name is its spelling, the moved note's metadata names its key.

- **Move.** While the Crossroad path is free, the note moves there and is filled as a Crossroad note right after. Its text stays, as freeform below the rendering, and so do its properties.
- **Links.** A moved Crossroad note moves through Obsidian's link-preserving rename: its links are path-qualified and aliased, so they follow it back unchanged. A stray moves without it (`RenameMdFile` with `updateLinks: false`): links to a stray are bare, and the updater would rewrite `[[Fahrer]]` as `[[fahrer]]` in the user's texts, as it did in #102. Left as they are, they resolve to the Crossroad note by name, case-insensitively, wherever Obsidian's resolution order lets it win.
- **Merge.** When its spelling's Crossroad note is already there, the note's user text joins that note's freeform, then the note goes to the trash, only while it still holds what was read. Text the Crossroad note already holds is not added again. A note whose frontmatter holds properties is not merged, since a Crossroad note cannot take them: it stays and is reported.
- **A note that changes while it merges** (#201) refuses its trash. A merge lands as a whole, so an edited paragraph never stands in the Crossroad note beside its earlier copy. The store's copy is known only while the Crossroad note still holds it exactly as the store wrote it, and every step on it is a compare-and-swap on those bytes. While that holds, the copy is replaced by the note's text as it now reads and the trash is tried again, three times in all. After the third refusal the copy is taken back, and the note waits, whole, for the next merge, reported in `healingBlocked`. If the user edited the Crossroad note after the copy, the copy stays as they left it and the note's text is added beside it: both versions stay, and the store logs it. No marker is written into the user's text. A note that gains properties meanwhile stays, and its copy is taken back.
- **Two notes of one spelling** in one pass: the first moves, and the other merges into it.
- **Blocked.** A file or a folder the vault spells another way on the path blocks a move (the collision rules), and the note stays and is reported in `healingBlocked`. A move that fails is not tried again until the note changes.
- **Not healed.** A stray named as Obsidian names a new note, `Untitled` or `Untitled 3`, is no spelling: it stays and is reported.

**Collisions.** Every created path is checked against every indexed path and folder by the collision key, and against the commit's other creates. A collision refuses the commit, which writes nothing.

**Recovery.** A failure among the creates goes through VAM's `dispatchOrUndo`: each note it created is trashed while it holds what it was created with, an uncertain create is probed and trashed only if it landed, and the commit answers a revision conflict. A created note VAM could not take back, such as one typed into meanwhile, makes the commit a `DictionaryWriteError` naming it, with the index rebuilt. A failure among the rewrites or trashes rebuilds the index from the files and writes what is still missing once more, from the files as they are; only if that fails too is the commit a `DictionaryWriteError`, with the index rebuilt. A re-render of another note that fails, or whose file is ahead of the index, never fails the commit: it is read again and re-rendered after it. Every rebuild, at startup too, plans `reevaluateShadows` for each stored Shadow relation whose resolution the stored Lemmas no longer fit and for every claim on a Lemma the files no longer hold, so links converge however a commit stopped. A commit that removes Lemmas, and a Lemma note the user deletes, is followed by that re-evaluation, as its own commit from a fresh slice (texteater#1257).

## Projected inverse relations (#59)

`@textfresser/dictionary` fills the `inverse_relation` hook itself; a caller's `projections` cannot supply it.

- **Inventory.** A Reading note's projection runs `projectSemanticRelations` over its Lemma's Readings and the source Readings of the claims that target its Lemma (`relationEdgesTo`), with each claim cut down to targets inside that inventory and dictionary-wide `readingCounts` for every Lemma in it.
- **What shows.** Only inverses: for each claim another Reading makes on this Lemma or Reading, the relation this Reading holds back, when dumrel infers it. Closure follows ADR 0011, so a Lemma target on a homonymous Lemma projects nothing, and a direct claim of the note's own wins and stays in the `relation` Block.
- **Links.** An inverse links its source Reading's Lemma, by the same rules as every other sense-unknown link: the subject is the Lemma's Unit Shadow, so the Crossroad path, or the Lemma note when the store resolves the Shadow to exactly one Lemma.
- **Re-rendering.** A commit renders every note it writes against the post-commit index, and re-renders the notes of the Lemmas whose inverse relations it moves in its third batch. A change the store observes, such as a deleted note, re-renders them after it. A re-render changes no record.

## Derived projections

Inflection tables come from the batteries ([#120](https://github.com/clockblocker/filler-de/issues/120)): `dumdict/inflection`'s `projectLemmaTables` projects them from the Lemma Paradigm and the German Inflection Pack of `dumcorpus/inflection`, which owns every German rule and label, and the codec only draws them (Layout). The plugin composes its projections in `src/stateless-helpers/dictionary-projections.ts`.

**Table versions** (#121). Tables are projections, never stored (system ADR 0049), so a pack or Table Schema change needs no data migration; only the notes that draw the old tables are stale. `inflectionFromPack`'s hook names, through its `versions`, the pack's `version` and the `schemaFor` schema's id and version, which are the ones the view carries, and a Lemma note records them as `tables`. After every full read of `Worter/` (startup, a rescan, a rebuild) the store finds, from the index alone, the Lemma notes whose recorded versions differ from the current ones, and re-renders those Lemmas' notes in the background (`refreshTables`):

- **Bounded.** Chunks of 32 Lemmas, each under the writer lock, so commits and events go between them and the store opens without waiting. Over 2,000 Lemma notes, 4,000 Reading notes and 2,000 Crossroad notes, in an in-memory vault, a store opened after a pack bump is ready in about 280 ms, as without the bump. The background re-render then takes about 2.9 s, and a second open finds nothing stale and writes nothing.
- **Through the normal re-render.** It writes compare-and-swaps on the content the store read, and retries a note whose file changed meanwhile from its new content. Freeform and edited renderings stay, as on every write, and only the notes whose metadata changes are written. That means each Lemma note, and a Reading note only when its embed moves.
- **Order.** A Lemma's Reading notes are written before its Lemma note, so a Lemma note that records the current versions never stands beside a stale embed. A note whose writes keep failing stays stale, is reported, and is tried again at the next full read.
- **Block IDs.** Table Block IDs hash the Licence Groups' `selectionKey`s, never versions, so a version-only re-render keeps every `^t…` and every Reading note's embed.
- **Reported.** The plugin logs how many Lemmas' notes each run re-rendered.

`@textfresser/lemma-note-projections` keeps only the Reading's Tags, which are Obsidian's: the route, one nested tag per Core Feature value (`noun/masculine`, `verb/separable`, `verb/reflexive-acc`), and the inflection class the Reading's own Licences give in the Lemma Paradigm: each licensed Präteritum variant's conjugation class (`verb/strong` for `fuhr`, both classes for melken's `molk / melkte`) and a licensed plural marker (`noun/singular-only`, `noun/plural-only`).

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
