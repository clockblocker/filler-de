# Textfresser vocabulary architecture

Textfresser turns German text in a Scroll into links to Reading notes. The dictionary keeps three kinds of note under `Worter/`: a Lemma note per dumling Lemma, a Reading note per Reading, and a Crossroad note per folded spelling (ADR-0015). All model work goes through dumgen, which calls TypeSafe (jev) and OpenAI (Luna). The current runtime is German-first.

Related decisions and proposals:

- [ADR-0011: Use different compatibility policies for domain and infrastructure](../../docs/adr/0011-use-different-compatibility-policies-for-domain-and-infrastructure.md)
- [ADR-0014: Segment Sentences lazily into a content-addressed cache](../../docs/adr/0014-segment-sentences-lazily-into-a-content-addressed-cache.md)
- [ADR-0015: Store the dictionary as Lemma, Reading and Crossroad notes](../../docs/adr/0015-store-the-dictionary-as-lemma-reading-and-crossroad-notes.md)

The plugin's own linguistics and lexical-generation packages, the Gemini client, and the Lemma and Generate commands were deleted in [#66](https://github.com/clockblocker/filler-de/issues/66). ADR-0006, ADR-0008 and ADR-0010 describe that code and are superseded. ADR-0012 and ADR-0013, the one-note-per-Lemma layout, are superseded by ADR-0015. The [layout map](https://github.com/clockblocker/filler-de/issues/105) tracks the move to it.

## Domain model

Terms follow dumling, dumrel and dumdict. See `CONTEXT.md` and the [adoption map](https://github.com/clockblocker/filler-de/issues/49).

| Term | Meaning |
| --- | --- |
| Lemma | A grammatical entity: language, Family, Kind, Core Features and Canonical Form. It carries no sense. |
| Reading | A Lemma plus one Emoji Description: one sense. |
| Surface | A grammatical form that realizes exactly one Lemma. |
| Attestation | A fleeting occurrence of a Surface in text. It has no durable identity. |
| Attestation Ref | A durable embed of the source block where an Attestation occurred. |
| Lemma note | The note of one Lemma and of its base-form Surface. It holds the Lemma Record and owned Surface Entries, lists the Surfaces met so far, and shows one inflection table per Licence Group. |
| Reading note | The note of one Reading, `<emoji> <spelling>.md` in its Lemma note's folder. It holds the Reading Entry and embeds its group's inflection table. |
| Crossroad note | The plugin-owned note of one folded spelling, listing every Lemma and met Surface with it. |
| Reading Entry, Surface Entry | The dumdict records a Reading note holds for its Reading, and a Lemma note for one of its Surfaces. |
| Block | A typed part of a Lemma or Reading note, such as translation, relation, or inflection, whose data lives in note metadata. |

Selection is retired. "Section" means a Library Section only.

A note's path spells its identity with identity folders and shard folders (ADR-0015), such as `Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/Fahrer.md`, but the note's metadata stays authoritative. Names are lossy: do not read identity or spelling from a path, only the kind of note.

## Command flow

| Command | Owner | Result |
| --- | --- | --- |
| `Classify` | `ClassifyCommander` | Segment the selected Sentences through dumgen, resolve each Segment's Reading, commit the occurrence to the dictionary store, link the Segment to the Reading's note, and queue background Knowledge for the Reading. |
| `TranslateSelection` | `Textfresser` | Translate the selected German text, or the caret's block, into the known language through dumgen's `translate.sentence`, with the surrounding Sentences as context, and write it under the text. It creates no Reading Entry. |

Classify hands a `ClassifyPlan` of `UnitRef`s to the `UnitResolver` port. `dumgenUnitResolver` implements it: it resolves through dumgen, commits through the dumdict vault store (`@textfresser/dictionary`), and rewrites the Scroll's links. Each instance of a Sentence repeated in a Scroll is an occurrence of its own, with its own Attestation Ref. Knowledge runs after the commit and the links, one run per Reading, and a click on a Reading link whose Knowledge is still running opens the Reading note again once it lands.

Deleting a Classify link from a Scroll removes its occurrence (`createUnlinkObserver`). VAM's Markdown modify observation reports the edit; once the Scroll has been quiet for five seconds and no Classify run is resolving in it, the observer reads it and removes each recorded occurrence whose block no longer links its Reading, through dumdict's `removeOccurrence` and its cascade. Moved text, a lost block ID, a link to a note that is not there, and a file holding none of the refs' blocks remove nothing. Links removed while the plugin was not running reach no modification event, so once the dictionary and the Librarian are ready the observer sweeps every Scroll the dictionary holds refs into, through the same checks (#161). Nothing told the sweep a Scroll was edited, so it judges less: only the refs recorded when it began whose Reading note was then no newer than the Scroll, since a synced dictionary can arrive ahead of the Scroll that links it; only in a Scroll that still links one of its recorded occurrences, so another file of its name removes nothing; only in blocks the Scroll still holds; and only once no Markdown file has been modified from outside for three quiet periods, so Sync catching up lands first. A Scroll modified meanwhile is judged in full, and what the sweep removed is told in one notice.

## Note and Block ownership

- dumling owns Lemma, Reading and Surface identity, and the `canonicalFormKey` that folds a spelling.
- dumdict owns the records, Reading matching, change planning, and the projection of inflection tables (`dumdict/inflection`). The plugin's dumdict host is `@textfresser/dictionary`, over VAM.
- dumrel owns Reading Knowledge and relation projections.
- dumcorpus's language packs (`dumcorpus/inflection`) derive and label inflection tables. The plugin only draws the tables (the Lemma note codec's `drawTable`); it holds no inflection rules of its own.
- `@textfresser/lemma-note-codec` reads and writes Lemma and Reading notes and spells every dictionary path, through `toNameSegment`. Dictionary data lives in the note-metadata facility, never in inline markers, and visible content is never parsed as data.
- The plugin owns Crossroad notes, freeform text, and Block IDs.

Every Block serializes one dumdict or dumrel field, is a projection, or is plugin-owned. Headers, tags, inverse relations and inflection tables are projections. They must not become the canonical source for linguistic identity or data.

## Target routing

- Every Lemma, closed-class ones included, has one Lemma note under `Worter/`, and each of its Readings a Reading note beside it. A closed-class Lemma's notes are created on first click; none goes to a Library leaf.
- Classify links each Segment to its unit's Reading note with a path-qualified link. A link is to a Reading note only when its exact sense is known.
- Every other link the plugin writes, such as relations, pending relations and morphemes, points at the spelling's Crossroad note path with an alias (`[[Worter/k/kra/kraft/kraftwerk|Kraftwerk]]`). It points at the Lemma note instead while its Unit Shadow matches exactly one Lemma; adding or removing a Lemma re-evaluates the stored Shadows it matches, in bulk.
- There are no Shadow notes. A link to a note that does not exist yet is an uncreated link in Obsidian, and clicking an uncreated Crossroad link creates a note the store fills as "not classified yet".
- A bare `[[surface]]` link typed by hand lands on the Crossroad note: Obsidian prefers it for sources outside `Worter/`, the wikilink detector rewrites it to the Crossroad path, and the store moves the `Worter/<x>.md` strays Obsidian creates.
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
| Projections (tags only; tables come from `dumcorpus/inflection`) | `src/packages/independent/lemma-note-projections/` |
