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
| `Classify` | `ClassifyCommander` | Segment the selected Sentences through dumgen, resolve each Segment's Reading, commit the Reading to the dictionary store, and link the Segment to the Reading's note. An occurrence becomes an Attestation, and its Reading's Knowledge is asked for, only when the user clicks its link (#281). |
| `TranslateSelection` | `Textfresser` | Translate the selected German text, or the caret's block, into the known language through dumgen's `translate.sentence`, with the surrounding Sentences as context, and write it under the text. It creates no Reading Entry. |

Classify hands a `ClassifyPlan` of `UnitRef`s to the `UnitResolver` port. `dumgenUnitResolver` implements it: it resolves through dumgen, commits through the dumdict vault store (`@textfresser/dictionary`), and rewrites the Scroll's links. Each instance of a Sentence repeated in a Scroll is an occurrence of its own, with its own Attestation Ref. Up to twelve units resolve at once. A judgement the provider refused as rate limited or overloaded (HTTP 429, 503 or 529, which jev's failures carry as `status` and Luna's name in their message) is tried once more after two seconds before its unit goes Pending. A unit decides its Reading and commits under its Lemma's lock, taken once `resolve.grammar` has named the Lemma and held across runs and clicks, dropped once idle, so the units of one Lemma judge against the Readings the ones before them committed instead of ending stale; the stale re-judge stays for a Reading added outside the lock. Knowledge runs after the commit and the links, one run per Reading, and a click on a Reading link whose Knowledge is still running opens the Reading note again once it lands.

Classify attests nothing (#281). It commits each unit's Reading, Lemma and Surface and writes its links, but no Attestation Ref and no block ID, and keeps each occurrence's judgement (its Attestation, Reading and Sentence target) in the Judgement Cache, `.textfresser/judgements/`. An occurrence a click already attested keeps its ref when Classify runs over it again. A click on a unit link in a Scroll, plain or with Cmd/Ctrl or the middle button, attests that occurrence (`makeOccurrenceAttester`), in the background once Obsidian was told to open the link, before the Reading note's reopen waits for Knowledge. The click names the note of the pane holding the link, which in a split pane need not be the active one, and the offset inside the link; only a link there with the clicked target is attested, so text read behind unsaved typing attests nothing. The link's Sentence gives its occurrence key; an occurrence the dictionary holds a ref of naming the link's block is left alone, so a second click adds nothing, while a refrain copy that took over the key of a deleted copy is attested again; clicks on one occurrence while it is being attested wait for that one. Any other occurrence is resolved again by Classify on the link alone, as `Clicked`, for the Reading the link opens while that is stored: from its cached judgement, or on a miss, as on another device, from `resolve.grammar` alone, so the link never moves to another Reading; only a link whose Reading is gone is judged in full. It cuts the clicked Sentence's paragraph into sentence blocks and mints their IDs in one compare-and-swap write, commits the ref, and asks for the Reading's Knowledge with that Attestation as its context: all of it for a Reading without Knowledge, as Classify leaves one, and for any other only what its Knowledge lacks, so a covered Reading asks nothing; the queue joins a run already going. The plain click's fiber waits for the attesting, then for the Knowledge, and once it lands the note Obsidian opened is re-rendered in place, keeping its scroll position, but only while it is still the active note: a user who went back to the Scroll, or opened anything else, is never pulled into it, and leaving the note ends the wait. A Reading note opened any other way, as through the quick switcher or a backlink, asks for nothing: Knowledge is asked with an Attestation as its context, and the note has none until a link of the Reading is clicked. The Scroll is busy meanwhile, so the unlink observer leaves it alone. The dictionary reset attests as it links (`attest: "Now"`), since the old notes it reads were attested, and asks for each Reading's Knowledge then, waiting for it as before.

Deleting a Classify link from a Scroll removes its occurrence (`makeUnlinkObserver`, in the Classify Layer's scope). VAM's Markdown modify observation reports the edit; once the Scroll has been quiet for five seconds and no Classify run is resolving in it, the observer reads it and removes each recorded occurrence whose block no longer links its Reading, through dumdict's `removeOccurrence` and its cascade. A link counts as Obsidian resolves it from the Scroll (`resolveLinkpathDest`), so one the link updater rewrote to the shortest path, another case, a heading or block, `.md`, or an embed still links its Reading (#171). Block IDs run `^0`, `^1`… in every classified file, so the observer judges a file in full only when it still links one of its recorded occurrences in that occurrence's block; once the last link is gone, it judges only the occurrences whose own Sentence the file still holds in their block (one of its cached units gives back the occurrence's key, so a cache miss keeps it); another file at the Scroll's path removes nothing beyond an occurrence whose very Sentence it holds. Each remaining link to a Reading is keyed by its occurrence key, recomputed from the Segmentation Cache (`occurrence-keys.ts`), and explains a missing occurrence only when its key is recorded, or cannot be computed: moved text and a lost block ID keep their occurrence by its key, an edited Sentence keeps the occurrences recorded in its block, and a link whose key is recorded nowhere, such as one never attested (#281), keeps nothing. A block that is gone, and a link that resolves to no note, remove nothing. dumdict's `removeOccurrence` removes a Reading left with no Attestation Link, so until it can keep one, a Reading's last occurrence stays while a link still names the Reading, in the Scroll or in another file outside `Worter/` (Obsidian's resolved links): removing it would remove the Reading those unclicked links open. Sync can bring refs into Reading notes ahead of the Scroll that links them, so no check runs until no dictionary note has been modified from outside for three quiet periods. Links removed while the plugin was not running reach no modification event, so once the dictionary and the Librarian are ready the observer sweeps every Scroll the dictionary holds refs into, through the same checks (#161). Nothing told the sweep a Scroll was edited, so it judges less: only the refs recorded when it began whose Reading note was then no newer than the Scroll, since a synced dictionary can arrive ahead of the Scroll that links it; only in a Scroll that still links one of its recorded occurrences, so another file of its name or an old version removes nothing; and only once no Markdown file has been modified from outside for three quiet periods, so Sync catching up lands first. A Scroll modified meanwhile is judged in full, and what the sweep removed is told in one notice.

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
| dumgen service (`Dumgen`, one `DumgenLive` build per action) and its transports | `src/managers/dumgen/` |
| Obsidian host services: commands and listeners (`PluginHost`), `Notices`, `Confirm`, `Workspace.openLink`, `HttpTransport` | `src/managers/obsidian/host/` |
| Dictionary store | `src/packages/composed/dictionary/` |
| Lemma note codec | `src/packages/independent/lemma-note-codec/` |
| Projections (tags only; tables come from `dumcorpus/inflection`) | `src/packages/independent/lemma-note-projections/` |
