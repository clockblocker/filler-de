---
status: accepted
---

# Store the dictionary as Lemma, Reading and Crossroad notes

Textfresser keeps its dictionary in three kinds of note under `Worter/`. A **Lemma note**, one per dumling Lemma, is also the note of the Lemma's base-form Surface and lists every Surface met so far. A **Reading note**, one per Reading, sits in its Lemma's folder. A **Crossroad note**, one per folded spelling, lists every Lemma and met Surface with that spelling. Dictionary data lives in the plugin's note-metadata facility, never in inline markers, and visible content is never parsed as data. This supersedes ADR-0012, ADR-0013, and the one-note-per-Lemma and marker decisions of the batteries adoption (#49). The decisions were made on the map [Store the dictionary as Lemma, Reading and Crossroad notes](https://github.com/clockblocker/filler-de/issues/105) (#105) and in [Settle how shard folders spell short words, Locutions, leading punctuation and case](https://github.com/clockblocker/filler-de/issues/108) (#108).

```
Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/Fahrer.md                 Lemma note
Worter/de/Lexeme/NOUN/Masc/f/fah/fahre/🚗 Fahrer.md              Reading note
Worter/de/Foreign/Foreign/en/w/wee/weeke/∅ weekend.md            Foreign Reading note
Worter/f/fah/fahre/fahrer.md                                     Crossroad note
Worter/de/Lexeme/NOUN/Masc/t/tag/tag/Tag.md                      short word
Worter/de/Locution/VERB/s/sic/sichi/sich in Acht nehmen.md       phrase
```

## Paths

- **Lemma note:** `Worter/<language>/<Family>/<Kind>/<core slots…>/<l1>/<l3>/<l5>/<name>.md`. The identity folders and their slot grammar are ADR-0013's. The three shard folders follow the old notes.
- **Reading note:** `<emoji> <name>.md` in its Lemma note's folder, such as `🚗 Fahrer.md`. The Emoji Description is normalized as dumling's `readingIdentityKey` normalizes it, without variation selectors or skin-tone modifiers, so Readings that are one Reading by identity get one path. A Foreign Reading has no Emoji Description, so it takes the fixed marker `∅` (U+2205), such as `∅ weekend.md`.
- **Crossroad note:** `Worter/<l1>/<l3>/<l5>/<key>.md`. The key is dumling's `canonicalFormKey(spelling, language)`, which lowercases with `toLocaleLowerCase` and keeps `ß`, so the file name is lowercase. `Morgen` and `morgen` share one Crossroad; `Maße` and `Masse` get two.
- **Shard folders** are the first one, three and five graphemes of the `canonicalFormKey`:
  - **Short words** repeat in full at every deeper level: `t/tag/tag/Tag.md`, `e/er/er/er.md`, `k/k/k/k.md`.
  - **Phrases** drop whitespace in the shard folders only (`s/sic/sichi/`). The file name keeps it: `sich in Acht nehmen.md`.
  - **Leading punctuation, digits and symbols stay**, apart from what `toNameSegment` drops or trims. A spelling left with nothing gets the fallback segment `@`.
  - **Language folders.** The first level is one grapheme, or `@`, so it never spells a language folder such as `de`, and never case-folds to one.
- **No conversion.** `ß`, `ẞ` and umlauts are never converted in file or folder names. The plugin always writes paths in NFC and compares them in NFC. Linux ext4 compares bytes, so NFC and NFD names are distinct files there.
- **Names are lossy.** The real spelling is kept in metadata. A path is a projection of a note's metadata, and nothing is read back from it but the kind of note.

## `toNameSegment`

One pure, host-owned function spells every shard folder, every file name and every text slot (such as `hasSepPrefix`). It belongs to the plugin, not the batteries, because the web host has no file names. Its rules, in order:

1. NFC normalize.
2. Drop `/ \ : * ? " < > | # ^ [ ]` and control characters.
3. Collapse each run of whitespace to one space.
4. Trim leading and trailing spaces and dots. Windows rejects trailing ones, and a leading `.` hides the file.
5. Prefix the Windows reserved base names with `@`: CON, PRN, AUX, NUL, COM1–COM9 and LPT1–LPT9, compared case-insensitively on the part before the first dot. `CON` becomes `@CON` and `con.txt` becomes `@con.txt`.
6. Cap the segment at 255 UTF-8 bytes, cut at a grapheme boundary. A file name is capped at 252 bytes, so that it still fits 255 bytes with `.md`.
7. Fall back to `@` when nothing is left.

`toNameSegment(toNameSegment(x))` equals `toNameSegment(x)`. `@` is legal in Obsidian names and links and means nothing else in a path: `_`, `+` and `~` already mean null slot, value set and Syncretism in the identity folders.

## Collisions

- **The collision key** is the full Unicode case fold of the NFC path, as Python's `str.casefold` does it: `ß` and `ẞ` fold to `ss`. On a default APFS volume, `Maße`/`Masse`, `Maße`/`MAẞE`, `Maße`/`MASSE`, NFC/NFD `Mütter` and `Morgen`/`morgen` are each one file, while `Mütter`/`Mutter` are two. NTFS is case-insensitive too.
- **Every component is checked.** Two identities whose file paths share a key collide, and so do two spellings of one folder, since only one of them can exist on disk. `toNameSegment` can create collisions (`C#` and `C` are both `C.md`), and so can case that dumling keeps in identity but the file system folds. Shard folders separate most pairs anyway (`m/maß/maße/Maße.md` and `m/mas/masse/Masse.md`).
- **Report loudly, never overwrite.** A collision is reported, and the store writes neither identity over the other.
- **The workaround, built only when a real collision appears:** the Obsidian host renders both identities in one file, separated by `***` twice, like entries.
- **The Foreign marker.** `∅` is no emoji dumling accepts in an Emoji Description, and it is neither `toNameSegment`'s reserved prefix nor its fallback. Every printable character `toNameSegment` keeps can begin some Canonical Form, so no marker is impossible as a first character. Instead the shard folders separate them: a Reading note named `<prefix> <name>` lands in its Lemma's shard folders, while a Lemma note with that same name lands in the prefix's. The two meet only when the Lemma's shard spelling starts with five graphemes of the prefix repeated, such as `∅∅∅∅∅`. The collision key reports that case like any other. Two Reading notes collide only when their Lemma notes' names do, because an Emoji Description holds no space, or when `toNameSegment` drops what tells two Emoji Descriptions apart: the keycaps `#️⃣` and `*️⃣` both lose their first character.

## Links

- **A link whose exact sense is known points at a Reading note.** These are Classify's links in Scrolls and a Lemma note's links to its own Reading notes. No Breakdown link points at a Reading note: a Breakdown piece or Source targets a Lemma or a Unit Shadow (batteries ADR 0050, #264).
- **Every other link the plugin writes points at the Crossroad path** with an alias, such as `[[Worter/k/kra/kraft/kraftwerk|Kraftwerk]]`. That covers relations, inverse relations, pending relations, and Breakdown pieces and Sources whose target is a Shadow. The target is computable from the spelling alone, and it never goes stale: classifying the word later creates the Crossroad note, and the link resolves with no rewrite.
- **The Lemma upgrade.** A sense-unknown link points at the Lemma note instead while its Unit Shadow matches exactly one Lemma, by dumdict's `shadowMatchesLemma` (language, Family, Kind and folded form). Each relation keeps its Shadow beside its current resolution. Adding or removing a Lemma re-evaluates every stored Shadow it matches, in bulk, in the same commit. A unique match resolves to that Lemma, and anything else goes back to the Crossroad, so a link moves back when der See joins die See and forward again when one is removed. Re-evaluation is idempotent, and a link it resolves never points at a Reading. This extends the batteries' ADR 0011 write-time resolution, and the batteries' `LinkTarget` vocabulary (`Spelling`, `Lemma`, `Reading`) carries it ([texteater#1221](https://github.com/clockblocker/texteater/issues/1221)). The codec renders whatever resolution the store holds.
- **Path-qualified links.** The plugin writes every link path-qualified, as before.
- **Landing.** A bare `[[Fahrer]]` the user wraps by hand lands on the Crossroad note. Obsidian prefers a basename match in or under the source note's folder and otherwise the shortest path, so the Crossroad wins for every source outside `Worter/`. The wikilink detector rewrites such links to the Crossroad path, and the store moves the `Worter/<x>.md` notes Obsidian creates for unresolved bare links to where they belong.

## Notes

- **Lemma note.** Its metadata holds the `LemmaRecord`, with its Lemma Paradigm, and every owned `SurfaceEntry`. It shows a header, links to its Reading notes, one inflection table per Licence Group (the Readings whose licences agree share one table, captioned with their emojis), and the list of Surfaces met so far ("Begegnete Formen"), each with its Surface Axes and a `^s-<hash>` anchor. No inflected Surface gets a note of its own.
- **Reading note.** Its metadata holds the `ReadingEntry`, with its Attestation Links, and the `PendingSemanticRelationRecord`s whose source it is. It shows the Reading's layout (#103, #104), and its Flexion section embeds its Licence Group's table from the Lemma note: `![[<lemma path>#^<block id>|…]]`.
- **Crossroad note.** It is plugin-owned and holds no records; a metadata entry only marks it as the store's. It lists every Lemma, with its Reading notes, and every met Surface with its spelling, and is regenerated from the store's index. Variant spellings (Kuss and Kuß) get separate Crossroads. An empty file Obsidian creates when the user clicks an uncreated Crossroad link is filled as "not classified yet", and the plugin generates no Knowledge for it. A Crossroad note is never removed, because other notes may still link to it.
- **Inflection tables** come from the batteries, independent of language, Family and Kind: `dumdict/inflection` projects them, and `dumcorpus/inflection`'s language packs label them. The plugin only renders them.

### Refinements from the note codec (#112)

- **Metadata namespaces.** A Lemma note keeps its data under `lemmaNote` and a Reading note under `readingNote`, each a versioned namespace of the note-metadata facility. A Reading note's metadata holds its whole Reading, its Lemma included, so the note names its identity alone and the store can find one outside its Lemma's folder.
- **The rendering boundary.** With no inline markers, a note tells its renderings from user text by Rendering Seals in its metadata: each Block's rendering is sealed as its line count and a hash of its lines. Lines that match a seal are the rendering; every other line is freeform, kept byte for byte and never read as data, so an edited rendering becomes freeform and survives beside the fresh one.
- **Frontmatter.** While "Hide metadata" is off, the dictionary namespaces write `[` as `\[` (and `\` as `\\`) in every string and key of their frontmatter, so Obsidian indexes no link inside the data in either format, and the toggle works for `Worter/` as for the Library.
- **Headers.** A Lemma note's header links its spelling's Crossroad note; a Reading note's header links its own Lemma note.
- **Tables and Surfaces.** A table is `^t` when its Lemma has one Licence Group, otherwise `^t-<hash>` of its group's `selectionKey`, and is one Obsidian block, captioned with its group's emojis. The "Begegnete Formen" list holds every owned Surface, in-core forms too, since only a list item, never a table cell, can carry a Surface's `^s-<hash>`.

### Refinements from the store (#113)

- **Write order.** A commit writes in stop-on-first-failure batches: creates of new Lemma and Reading notes, then the notes whose records change, then the re-renders of other notes its change moves links or inverse relations in and the Crossroad notes of the spellings it touches, then removed Reading notes and removed Lemma notes to the trash.
- **Recovery.** A failed create trashes what the commit created and asks the caller to plan again. A later failure rebuilds the index from the files and writes what is missing once more. Every rebuild re-evaluates the stored Shadows the files' Lemmas no longer fit, so links converge however a commit stopped, and a removal is followed by that re-evaluation as a commit of its own.
- **Removed notes keep their text.** A removed Reading note's freeform moves to its Lemma note, and a removed Lemma's to its spelling's Crossroad note.
- **Links by uniqueness.** Breakdown pieces, Sources, inverse relations, prepositions and source verbs link the Lemma note while their Unit Shadow names exactly one Lemma, like resolved relations, and the store re-renders them in the commit that changes that.
- **Recognition.** Without dictionary metadata, a file at a Crossroad path is a Crossroad note, one directly in `Worter/` a stray, and an empty one at a note path is reported and never written over. A Reading note without its Lemma note is quarantined until the Lemma comes back.

### Refinements from the Crossroad notes (#114)

- **Layout.** A Crossroad note is a compact router page under the dictionary's section titles: "Einträge" lists each Lemma with its article (or its Kind) and its Reading notes by emoji, and "Begegnete Formen" lists each met Surface of another Lemma as `Tage → der Tag`. A spelling with neither says "not classified yet".
- **Staleness from seals.** Its metadata seals what it shows, so the store finds missing and stale Crossroad notes from the index alone and regenerates them after every full read of `Worter/`. A second run writes nothing.
- **Clicked notes.** An empty file at a Crossroad path is filled as "not classified yet" as soon as the store sees it, with no Knowledge generated.
- **Never created for nothing.** A Crossroad note is created only while its spelling has something to list; once created, it is never removed.

### Refinements from table versions (#121)

- **Recorded versions.** A Lemma note's metadata records the pack and Table Schema versions its tables were rendered at. A Reading note records none: its embed names a Block ID that hashes its Licence Group's selection, never a version.
- **Re-rendered after every full read.** The store finds the Lemma notes recorded at other versions from the index alone, and re-renders those Lemmas' notes in the background, in chunks under the writer lock. It writes each Lemma's Reading notes before its Lemma note, through the usual compare-and-swap re-render. A second run writes nothing.

### Refinements from link landing (#115)

- **The rewrite.** In a note outside `Worter/`, a bare link the user wraps in `[[ ]]` or closes with `]]` becomes `[[Worter/<l1>/<l3>/<l5>/<key>|<word>]]`, keeping the user's spelling as its alias, whether or not the Crossroad note exists yet. The wikilink detector of the event layer finds the link and where Obsidian resolves it (`getFirstLinkpathDest`); the completion handler decides.
- **Left alone.** A link with a path, a heading or block, an extension or an alias; an embed; a link with no letter or digit; and every link typed in a note under `Worter/`.
- **Another note's link.** A bare link names a note that is not the dictionary's, and keeps the Library's rules, when Obsidian resolves it outside `Worter/`, or, resolving nowhere, when the Library tree holds leaves of that core name. A link Obsidian resolves into `Worter/` (a Crossroad, a Lemma note or a stray) is the dictionary's and is rewritten. The Librarian's suffix alias applies only to such Library links, so `[[E-Mail]]` lands on its Crossroad instead of becoming `[[E-Mail|E]]`.
- **Strays.** The store moves a stray to its spelling's Crossroad path and fills it, keeping its text below the rendering; it merges one whose Crossroad note is already there into that note and trashes it. A stray whose properties a merge would lose stays, reported, as does one named `Untitled`. A stray moves without Obsidian's link updater: links to it are bare, the updater would rewrite `[[Fahrer]]` as `[[fahrer]]` in the user's texts (#102), and left alone they resolve to the Crossroad note by name.
- **Moved Crossroad notes** move back to their own path through the link-preserving rename, since their links are path-qualified and aliased, or merge into the Crossroad note that took it.
- **Undo.** The detector ignores undo and redo, so undoing a rewrite leaves the bare link the user wrapped.
- **Placement is not pinned.** No test checks Obsidian's undocumented resolution order; the rewrite makes it matter only for links the plugin did not see typed, such as those the Dictionary reset left and the bare links to a healed stray.

### Refinements from Breakdown links (#267)

- **Stored, and reversible.** The store moves a Breakdown piece's or a Source's target between its Unit Shadow and the one stored Lemma the Shadow names, in the same commit as the Lemma's creation or removal, as the Lemma upgrade moves a relation. A new Breakdown is settled as it is published.
- **The Shadow is kept in the Lemma.** dumrel stores one target, a Lemma or a Shadow, and the producers write only Shadows. A Lemma target's Shadow is `unitShadowOf` that Lemma, which names the same Lemmas as the Shadow it resolved, so re-evaluation reads the Shadow alone and a link moves back when der See joins die See or its Lemma is removed. Nothing beside the target is stored.
- **No Source points back.** A Source never moves to a Lemma one of whose stored Readings names its owner as its own Source (texteater #1279); it stays on its Shadow.
- **Fan-out.** A commit moves the links of at most 200 owning Readings, as tf-demo's `MAX_MOVED_OWNERS`; the rest move in commits of their own after it. The index keeps each Shadow key's owning Readings. Every rebuild settles every link, as it re-evaluates relations, and a Lemma whose note is there but unreadable keeps its links.

## Considered Options

- **One note per Lemma with every Reading as a block** (ADR-0012). Rejected: a Reading's Knowledge, attestations and notes outgrow a shared note, and a link to a sense needs a block ID instead of a note.
- **Unsharded identity paths** (ADR-0013). Rejected: Crossroad notes have no identity folders to partition them, and the old notes' shard folders keep every folder short.
- **Shadow notes** under `Worter/<language>/Shadow/` (ADR-0012). Rejected: Obsidian's uncreated links take their role. A link to a note that doesn't exist yet shows as an uncreated link and as a ghost node in the graph.
- **Percent-encoded names** (ADR-0013). Rejected: they are reversible, but a reversible name is useless when the spelling lives in metadata, and `%2A` is unreadable. `toNameSegment` drops what Obsidian forbids instead.
- **Folding `ß` to `ss` in shards and Crossroads.** Rejected: dumling's `canonicalFormKey` keeps `ß`, and `Maße` and `Masse` are different words. Only the collision key folds it.
- **A bare link resolved by Obsidian.** Rejected as the plugin's link form: which note wins is undocumented, and it changes as notes are added.

## Consequences

- **What survives from ADR-0012 and ADR-0013:**
  - the identity folders and slot grammar, including `_`, `+` and `~` and the German slot orders;
  - closed-class Lemmas under `Worter/`, each created on first click;
  - path-qualified links written by the plugin;
  - path healing by the dictionary store, now also for Reading notes outside their Lemma's folder.
- **What does not survive:**
  - one note per Lemma;
  - the Reading block links `#^r-<hash>`;
  - Shadow notes;
  - "no Crossroad notes";
  - unsharded paths;
  - percent-encoded names, replaced by `toNameSegment`;
  - the 100-character shortening with a hash suffix, replaced by the 255-byte cap. Long names that the cap makes equal are reported like any other collision;
  - "identity folds case, first writer's casing wins" for file names. dumling's identity still folds case, but the file name keeps the display casing of the Canonical Form it was written with, and the collision key decides what the file system treats as one file.
- **A Pending Semantic Relation** is stored only in its source Reading note's metadata. Inverse relations are still projected at read time from the store's index and are never written.
- **Writes are not atomic across files.** One commit now touches a Lemma note, its Reading notes, Crossroad notes and inverse-relation targets, and VAM batches stop at the first failure without rolling back. The store rebuilds its index from files.
- **The store scans about three times as many files**: a Reading note per sense, plus Crossroad notes.
- **Landing on Crossroads relies partly on undocumented Obsidian behaviour.** Rewriting and healing are the fallbacks.
- **A misjudged NoMatch creates a second Reading note**, because a Reading note's name is its emoji. Nothing renames or merges the first.
- **Not checked yet:** Windows' 260-character limit on a whole path without long-path support. Only each segment is capped.
