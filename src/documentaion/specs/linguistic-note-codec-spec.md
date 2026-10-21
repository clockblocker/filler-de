# Lemma and Reading note codec specification

- Status: Draft. This is the target of [#112](https://github.com/clockblocker/filler-de/issues/112). The code still writes the one-note-per-Lemma marker format of [#55](https://github.com/clockblocker/filler-de/issues/55) until #112 lands.
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
- the metadata payloads it hands the note-metadata facility;
- rendering of projection Blocks from data the caller supplies;
- Block IDs;
- deterministic serialization;
- structured codec issues;
- dictionary note paths, as its own module (ADR-0015, #111).

It must not own:

- vault I/O, lookup, revisions, commits, or cross-note invariants (the dictionary store, #113);
- the metadata facility's storage format (`src/stateless-helpers/note-metadata/`, [#107](https://github.com/clockblocker/filler-de/issues/107));
- link resolution: it renders the `LinkTarget` the store holds and decides nothing;
- Crossroad notes, which hold no records (#114);
- inflection rules or labels (`dumdict/inflection`, `dumcorpus/inflection`);
- prompts or generation (dumgen);
- linguistic or Knowledge schemas (dumling, dumrel).

It depends only on the batteries. It must not import VAM types such as `SplitPath`, or any other `@textfresser/*` package.

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

The codec exposes two layers per note kind, as ADR-0007 requires.

```ts
type LemmaNoteDocument = { metadata: LemmaNoteMetadata; blocks: Block[] };
type ReadingNoteDocument = { metadata: ReadingNoteMetadata; blocks: Block[] };

type LemmaNoteData<L extends Language> = {
	lemmaRecord: LemmaRecord<L>;
	ownedSurfaceEntries: SurfaceEntry<L>[];
};

type ReadingNoteData<L extends Language> = {
	readingEntry: ReadingEntry<L>;
	pendingRelations: PendingSemanticRelationRecord<L>[];
};
```

A document preserves Block order and the bytes of freeform text, and holds every plugin-owned value: Block IDs and freeform content. Data holds dumdict records only. Each record must validate with dumdict's `parseAs*` parser for the codec's language. Loose data conversion returns a partial-invalid result when reconstruction fails; it must not return invalid content as a record.

## Block kinds

Every Block is one of three kinds:

- **Serialized**: one dumdict or dumrel field. Its data lives in the note's metadata, never in the visible text. Its visible rendering, if any, is derived from the data and is never parsed.
- **Projection**: rendered from data and never parsed back. Deleting or editing one changes no data.
- **Plugin-owned**: Textfresser state that dumdict does not model, such as freeform text. It lives only in the document layer.

The metadata payload must round-trip nested dumling and dumrel values, such as morphological trees and Valency Frames, without loss. The facility escapes it so that no link, embed or comment syntax inside it reaches Obsidian's index (#107).

### Lemma note

| Block | Kind | Maps to |
| --- | --- | --- |
| `identity` | Serialized | `LemmaRecord.lemma`: language, Family, Kind, Core Features, Canonical Form and, for a Syncretism, `syncretic` and `syncretized` |
| `paradigm` | Serialized | the Lemma Paradigm: Paradigm Variants per Variation Dimension, and each Reading's licences (texteater#1226) |
| `header` | Projection | Canonical Form, article, transcription |
| `readings` | Projection | One link per Reading note, with its emoji |
| `inflection` | Projection | One table per Licence Group, from `projectLemmaTables` (texteater#1228), each with its Block ID and its group's emojis as caption |
| `surface` | Serialized | One owned `SurfaceEntry`; rendered as one line in the "Surfaces encountered so far" list with its Surface Axes and its `^s-<hash>` Block ID |
| `freeform` | Plugin-owned | Opaque user content, byte-preserved |

### Reading note

Rows are in canonical order (see Layout).

| Block | Kind | Maps to |
| --- | --- | --- |
| `reading` | Serialized | `ReadingEntry.reading.emojiDescription`; absent for a Foreign Reading. The Lemma comes from the Lemma note, by the store |
| `transcription` | Serialized | `ReadingEntry.knowledge.transcription`; shown in `header` |
| `header` | Projection | Canonical Form, Emoji Description, article, transcription |
| `attestation` | Serialized | `ReadingEntry`'s Attestation Links (`{ ref, surfaceId, reading }`, texteater#1227), each rendered as the Scroll embed and the Surface's `^s-<hash>` |
| `notes_title` | Projection | The Note title, always present |
| `notes` | Serialized | `ReadingEntry.notes`; omitted when empty |
| `notes_placeholder` | Projection | `*You can write here*`, while the note has no `notes` and no freeform |
| `freeform` | Plugin-owned | Opaque user content, byte-preserved |
| `relation` | Serialized | `ReadingEntry.knowledge.semanticRelations`: direct claims only, with each target's resolution |
| `pending_relation` | Serialized | `PendingSemanticRelationRecord`s whose `sourceReading` is this Reading |
| `inverse_relation` | Projection | Inverse edges from dumrel's `projectSemanticRelations` |
| `morphology` | Serialized | `ReadingEntry.knowledge.morphologicalTree` |
| `translation` | Serialized | `ReadingEntry.knowledge.translations` |
| `attested_translation` | Serialized | `ReadingEntry.attestedTranslations`; renders those `translation` does not already list |
| `definition` | Serialized | `ReadingEntry.knowledge.definition` |
| `valency` | Serialized | `ReadingEntry.knowledge.valency` |
| `participle_source` | Serialized | `ReadingEntry.knowledge.participleSource` |
| `locution_type`, `saying_type`, `formula_role` | Serialized | the matching `ReadingEntry.knowledge` fields |
| `inflection_embed` | Projection | `![[<lemma note>#^<block id>\|…]]`: the Lemma note's table of this Reading's Licence Group |
| `tags` | Projection | Tags derived from the Lemma's route and Core Features and the Reading's Knowledge |

Principal parts (`plural`, `conjugationClass`, `preterite`, `presentSingular`, `pastParticiple`, `subjunctivePast`) leave Reading Knowledge for the Lemma Paradigm (texteater#1226). A serialized Block whose field is absent or empty is omitted. The codec adds no Block for a Knowledge aspect the route's Knowledge Policy does not apply, and a new dumrel aspect fails to compile until it gets a Block.

### Dropped

- The part and Block markers (`%%tf-part…%%`, `%%tf:<kind>…%%`) and their seals. Data lives in metadata.
- Reading parts and their `^r-<hash>` Block IDs. A Reading is a note.
- `root_meta`, `inherent_features`, the Selection identity fields and `closed_set_membership`, as before: Core Features are Lemma identity ([ADR 0002]), Selection is retired ([ADR 0003]), and closed-class Lemmas have their own notes under `Worter/`.
- `deviation`, `morphem` and the propagated `morphology` backlinks of the legacy notes (open question 3).

## Plugin-owned values

**Block IDs.**

- A met Surface's line carries `^s-<hash>`, a short hash of its `SurfaceId`. Table cells and other notes link a Surface as `<lemma note>#^s-<hash>`.
- A table's ID is `^t` when the Lemma has a single Licence Group, otherwise a short hash of the group's `selectionKey`.
- The hash function and length are fixed by the codec and must not change between versions, since links and embeds use the IDs. A collision inside one note lengthens both colliding IDs deterministically.
- The codec returns the map from Block ID to `SurfaceId` or Licence Group beside the document. It is recomputed from data on every parse and is never stored.

**Freeform.** User content anywhere in either note. The document layer keeps its bytes. It is never converted to `ReadingEntry.notes`, which dumdict validates and may rewrite.

## Projections

The codec is pure, so the caller supplies every input a projection reads beyond the note itself:

| Projection | Input |
| --- | --- |
| Note paths | Not rendered by the note codec. The store derives them with the path module (ADR-0015) |
| `header` | `identity`, `reading`, `transcription` |
| `readings` | The Lemma's Reading notes, from the store |
| `inflection`, `inflection_embed` | `projectLemmaTables`' `LemmaTablesView` and the language pack's labels and display. Until #120 lands, the hook can wrap `@textfresser/lemma-note-projections` |
| `tags` | `identity` and the Reading's Knowledge |
| `inverse_relation` | `SemanticRelationProjection`s for this Reading, computed by the store; see Projected inverse relations |
| Links in any rendering | The `LinkTarget` the store holds for each link: `Spelling`, `Lemma` or `Reading` (texteater#1221) |

Inverse relations are never written as data, in this note or any other. The `relation` Block holds only direct claims (synonym, nearSynonym, antonym, nearAntonym, hypernym, holonym, endonym), and dumrel's stored Knowledge has no field for an inverse such as hyponym or meronym ([ADR 0012]). Every relation stays inside its source's relation space ([ADR 0020]).

### Links

- **Sense unknown.** Every link the codec renders without knowing the exact sense points at the Crossroad note path with an alias, such as `[[Worter/k/kra/kraft/kraftwerk|Kraftwerk]]`: relations, inverse relations, pending relations, morphemes, and the header's self-link when it has no sense. The path comes from `crossroadNotePath` and needs only the spelling.
- **Lemma upgrade.** A relation, morpheme or pending-relation link whose resolution the store holds as `Lemma` renders a link to that Lemma note. The store re-evaluates resolutions in bulk when Lemmas are added or removed and re-renders the affected notes (#113).
- **Sense known.** Only a link whose exact sense is known renders a Reading note: a Lemma note's links to its own Reading notes, and a morphological leaf that is an exact `morphemeReading`.
- The codec makes no lookup, and rendering twice against the same data gives identical bytes.

## Invariants

The codec checks these for one note:

1. A Lemma note has exactly one `identity` and one `paradigm`. A Reading note has exactly one Reading Entry.
2. `identity` is the only source for the Lemma. Paths, headers, tags and Block IDs never define it.
3. A Reading note has a `reading` Block, except a Foreign Reading, which has none.
4. Owned Surfaces are distinct by `SurfaceId`, and each one's Lemma equals the note's Lemma by `lemmaIdentityKey`.
5. Every pending relation's `sourceReading` is the note's Reading, and `locator.sourceReadingKey` is that Reading's `readingIdentityKey`.
6. Every reconstructed record validates with its `parseAs*` parser.
7. Projection Blocks are never parsed into data, and visible content is never read as data.
8. Parse does not repair content. Normalization is an explicit operation.
9. Default serialization uses canonical order.
10. The document layer preserves freeform text byte for byte.

The store checks the cross-note ones:

- Every Reading note has a Lemma note in its folder, and its Reading's Lemma is that note's Lemma.
- Every Reading in a Lemma note's Paradigm has a Reading note, and a Foreign Lemma has exactly one.
- Readings are distinct by `readingIdentityKey` across a Lemma's Reading notes.
- No two identities share a path's collision key (ADR-0015).

## Parse and normalize

Parsing has two steps per note kind: Markdown and metadata to a document, then a document to validated data. Strict conversion fails on a missing identity, a duplicate Block, an inconsistent record, an invalid payload, or a record its `parseAs*` parser rejects. Loose conversion returns structured issues and partial-invalid data, and the store quarantines a note with any data issue and never throws.

A note in the old marker format parses to a typed issue, never a throw, so the Dictionary reset can find it.

Normalization may deduplicate list payloads, canonicalize Block order, regenerate projection Blocks and Block IDs, and normalize payload formatting. It must not rewrite freeform content.

## Serialization

Default Block order follows the tables above. Freeform stands in the Reading note's Note section, and last in a Lemma note. Serializing data always renders projection Blocks from its inputs, since a note is regenerated as a whole.

The rendering boundary must:

- tell the codec's renderings from user text without inline seals, for example by keeping each rendering's line span and hash in the metadata;
- treat any line that doesn't match a rendering as freeform, kept byte for byte and never read as data, so a hand-edited rendering becomes freeform;
- keep visible titles cosmetic and localized;
- keep every table a single Obsidian block, so an embed shows all of it.

## Issue families

The codec uses structured issues. Minimum families are `MissingIdentity`, `DuplicateBlock`, `InvalidBlockPayload`, `InvalidRecord` (a `parseAs*` rejection), `InconsistentRecord` (invariants 3 to 5), `BlockIdMismatch`, `LegacyMarkerFormat`, `OrderingNormalized` and `BlockMerged`.

## Acceptance

Tests must cover:

- round trips of both note kinds for each German Family, including a Locution, a Saying, a Morpheme, a Foreign Lemma and a Syncretism;
- nested payloads: a morphological tree, a Valency Frame, both relation target modes, and pending relations;
- Licence Groups: Mutter 👩 / 🔩 with two tables, melken with one, and senden with partial overlap;
- stable table Block IDs, Reading-note embeds that target their group's table, and Surface lines that keep their `^s-<hash>`;
- links rendered from each `LinkTarget`;
- freeform round trips byte for byte in both notes, and a hand-edited rendering read as freeform, never as data;
- no `%%tf` in any output, and a marker-format note parsed as a typed issue.

## Open questions

1. **Rendering boundary.** How a note tells its own renderings from user text once the seals are gone (#112).
2. **Whole-path length.** Windows' 260-character limit without long-path support is not checked; only each segment is capped (ADR-0015).
3. **Morphemes.** Whether morpheme "used in" backlinks become a projection over `morphologicalTree`, and whether `deviation` returns.

## Layout

The codec lays the notes out as the user's dictionary example ([#49](https://github.com/clockblocker/filler-de/issues/49)) shows an entry ([#103](https://github.com/clockblocker/filler-de/issues/103), [#104](https://github.com/clockblocker/filler-de/issues/104)), split across the two notes. Only the visible lines follow the example. Visible text is never parsed.

A Reading note, `🏭 Kohlekraftwerk.md`:

```
🏭 das [[Worter/k/koh/kohle/kohlekraftwerk|Kohlekraftwerk]], [ˈkoːləˌkraftvɛɐ̯k ♫](https://youglish.com/pronounce/Kohlekraftwerk/german)

<span class="note_block_title note_block_title_kontexte">Deine Kontexte</span>
![[Atom#^13|^]]

![[Atom#^14|^]]
<span class="note_block_title note_block_title_kontexte">Note</span>
*You can write here*


<span class="note_block_title note_block_title_synonyme">Semantische Beziehungen</span>
= [[Worter/k/kra/kraft/kraftwerk|Kraftwerk]]
≈ [[Worter/i/ind/indus/industrieanlage|Industrieanlage]], [[Worter/f/fab/fabri/fabrik|Fabrik]]
≠ [[Worter/w/win/windr/windrad|Windrad]]
<span class="note_block_title note_block_title_morpheme">Morpheme</span>
[[Worter/k/koh/kohle/kohle|Kohle]]|[[Worter/k/kra/kraft/kraft|Kraft]]|[[Worter/w/wer/werk/werk|Werk]]
<span class="note_block_title note_block_title_translations">Übersetzung</span>
coal-fired power plant
<span class="note_block_title note_block_title_flexion">Flexion</span>
![[Worter/de/Lexeme/NOUN/Neut/k/koh/kohle/Kohlekraftwerk#^t|Flexion]]
<span class="note_block_title note_block_title_tags">Tags</span>
#noun/neuter
```

A Lemma note, `Kohlekraftwerk.md`, in the same folder. Its layout is a sketch; #112 settles it:

```
das [[Worter/k/koh/kohle/kohlekraftwerk|Kohlekraftwerk]], [ˈkoːləˌkraftvɛɐ̯k ♫](https://youglish.com/pronounce/Kohlekraftwerk/german)

[[Worter/de/Lexeme/NOUN/Neut/k/koh/kohle/🏭 Kohlekraftwerk|🏭]]

<span class="note_block_title note_block_title_flexion">Flexion</span>
N: das Kohlekraftwerk, die Kohlekraftwerke
A: das Kohlekraftwerk, die Kohlekraftwerke
G: des Kohlekraftwerks, der Kohlekraftwerke
D: dem Kohlekraftwerk, den Kohlekraftwerken
^t

<span class="note_block_title note_block_title_surfaces">Surfaces encountered so far</span>
Kohlekraftwerken: Dat.Pl ^s-…
```

- **Header.** The Emoji Description (in a Reading note), a German noun's article, a link to the spelling, and the transcription as a YouGlish link with `♫` in its text (`/…/` for a language YouGlish lacks).
- **Sections.** In a Reading note, every Block but the header belongs to a section, in this order: Deine Kontexte (`attestation`), Note (`notes_title`, `notes`, `notes_placeholder`), Semantische Beziehungen (`relation`, `pending_relation`, `inverse_relation`), Morpheme (`morphology`), Übersetzung (`translation`, `attested_translation`), Definition, Valenz, Partizip von, Art (`locution_type`, `saying_type`, `formula_role`), Flexion (`inflection_embed`) and Tags. A section opens with its title, `<span class="note_block_title note_block_title_<class>">Title</span>`. The class is the example's: `kontexte` (the Note title's too), `synonyme`, `morpheme`, `translations`, `flexion`, `tags`, and the section's own name for the new ones. Titles are cosmetic: `projections.titles` replaces them, and an empty title leaves the line out.
- **Spacing.** A blank line follows the header, two follow the Note section, and sections otherwise stand on consecutive lines, as in the example.
- **Renderings.** Attestation embeds are separated by a blank line. Relations are one line per relation with the dictionary's symbols, `=` synonym, `≈` near synonym, `≠` antonym, `≉` near antonym, `⊃` hypernym, `⊂` hyponym, `∋` holonym, `∈` meronym, `⇒` endonym, `⇐` exonym, each target once, so direct, pending and projected relations read as one list. A morphological tree lists its leaves. Translations show their words, prefixed by the language only when there are several; attested translations show in italics. Links alias the spelling alone. Inflection cells are display-only (batteries ADR 0019).
- **Note.** A Reading note always has the Note title, so a user knows where to write. Freeform text stands directly under it, after `notes`, and text typed anywhere else moves there when the note is written again. While the note has neither `notes` nor freeform, `notes_placeholder` shows `*You can write here*`. Text typed in its place is freeform, and the next serialize drops the placeholder; a freeform Block holding only the placeholder's words is dropped too.
- **Not rendered.** The example's Verweise section and its compound-parts line have no data, nor do the old "Morphologische Relationen" (Verwendet in) backlinks and "Abweichungen" (open question 3).

## Projected inverse relations (#59)

`@textfresser/dictionary` fills the `inverse_relation` hook itself; a caller's `projections` cannot supply it.

- **Inventory.** A Reading note's projection runs `projectSemanticRelations` over its Lemma's Readings and the source Readings of the claims that target its Lemma (`relationEdgesTo`), with each claim cut down to targets inside that inventory and dictionary-wide `readingCounts` for every Lemma in it.
- **What shows.** Only inverses: for each claim another Reading makes on this Lemma or Reading, the relation this Reading holds back, when dumrel infers it. Closure follows ADR 0011, so a Lemma target on a homonymous Lemma projects nothing, and a direct claim of the note's own wins and stays in the `relation` Block.
- **Links.** An inverse links its source Reading's Lemma, by the same rules as every other sense-unknown link: the Crossroad path, or the Lemma note while the claim's Unit Shadow matches exactly one Lemma.
- **Re-rendering.** A commit renders every note it writes against the post-commit index. Once its writes landed, the store rewrites the notes whose `inverse_relation` Blocks the index changed, as a compare-and-swap under the writer lock, retried for at most three rounds. A re-render that still fails is logged and never fails the commit. A full rebuild, such as startup, re-renders nothing.
- **Revisions.** A re-render changes no record, so it does not move the revision.

## Derived projections (#75, until #120)

Until [#120](https://github.com/clockblocker/filler-de/issues/120) moves them to the dumcorpus German pack, `@textfresser/lemma-note-projections` derives the German inflection tables and tags without a model. Its cells are display-only, never Surfaces (batteries ADR 0019); forms come from stored data, never from pattern labels (ADR 0038), and a cell whose form the data leaves in doubt is left out, not guessed.

- **Nouns.** A case table from the Canonical Form, Core `gender`, the plural and dumcorpus's definite article cells. A singular form an owned Surface attests wins. No weak (n-Deklination) form is derived, and a genitive whose ending is in doubt is left out unless a Surface attests it.
- **Verbs.** Stored principal parts win over rules, for any class. Without them, a weak verb gets Präsens, Präteritum, Konjunktiv II, Partizip II and Imperativ, with its particle and reflexive in place; any other verb gets only what its stored forms and the regular Präsens cells allow. The haben/sein auxiliary is never shown.
- **Comparison.** A `comparable` ADJ or ADV gets Positiv, Komparativ and Superlativ: suppletive forms from dumcorpus, then a stored comparative Surface, then regular forms for an ADJ whose stem cannot umlaut.
- **Closed classes.** A declining DET or PRON stem gets its case table from dumcorpus's realizations, and a closed VERB or AUX lists its forms.
- **Tags.** The route, one nested tag per Core Feature value (`noun/masculine`, `verb/separable`, `verb/reflexive-acc`), and the inflection class Knowledge stores (`verb/weak`, `noun/plural-only`). Tags stay in the plugin after #120.

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
