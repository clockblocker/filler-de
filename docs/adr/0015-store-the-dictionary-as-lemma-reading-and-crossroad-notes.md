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

- **A link whose exact sense is known points at a Reading note.** These are Classify's links in Scrolls, a Lemma note's links to its own Reading notes, and a morphological leaf that is an exact `morphemeReading`.
- **Every other link the plugin writes points at the Crossroad path** with an alias, such as `[[Worter/k/kra/kraft/kraftwerk|Kraftwerk]]`. That covers relations, inverse relations, pending relations and morphemes. The target is computable from the spelling alone, and it never goes stale: classifying the word later creates the Crossroad note, and the link resolves with no rewrite.
- **The Lemma upgrade.** A sense-unknown link points at the Lemma note instead while its Unit Shadow matches exactly one Lemma, by dumdict's `shadowMatchesLemma` (language, Family, Kind and folded form). Each relation keeps its Shadow beside its current resolution. Adding or removing a Lemma re-evaluates every stored Shadow it matches, in bulk, in the same commit. A unique match resolves to that Lemma, and anything else goes back to the Crossroad, so a link moves back when der See joins die See and forward again when one is removed. Re-evaluation is idempotent, and a link it resolves never points at a Reading. This extends the batteries' ADR 0011 write-time resolution, and the batteries' `LinkTarget` vocabulary (`Spelling`, `Lemma`, `Reading`) carries it ([texteater#1221](https://github.com/clockblocker/texteater/issues/1221)). The codec renders whatever resolution the store holds.
- **Path-qualified links.** The plugin writes every link path-qualified, as before.
- **Landing.** A bare `[[Fahrer]]` the user wraps by hand lands on the Crossroad note. Obsidian prefers a basename match in or under the source note's folder and otherwise the shortest path, so the Crossroad wins for every source outside `Worter/`. The wikilink detector rewrites such links to the Crossroad path, and the store moves the `Worter/<x>.md` notes Obsidian creates for unresolved bare links to where they belong.

## Notes

- **Lemma note.** Its metadata holds the `LemmaRecord`, with its Lemma Paradigm, and every owned `SurfaceEntry`. It shows a header, links to its Reading notes, one inflection table per Licence Group (the Readings whose licences agree share one table, captioned with their emojis), and the list of Surfaces encountered so far, each with its Surface Axes and a `^s-<hash>` anchor. No inflected Surface gets a note of its own.
- **Reading note.** Its metadata holds the `ReadingEntry`, with its Attestation Links, and the `PendingSemanticRelationRecord`s whose source it is. It shows the Reading's layout (#103, #104), and its Flexion section embeds its Licence Group's table from the Lemma note: `![[<lemma path>#^<block id>|…]]`.
- **Crossroad note.** It is plugin-owned and holds no records; a metadata entry only marks it as the store's. It lists every Lemma, with its Reading notes, and every met Surface with its spelling, and is regenerated from the store's index. Variant spellings (Kuss and Kuß) get separate Crossroads. An empty file Obsidian creates when the user clicks an uncreated Crossroad link is filled as "not classified yet", and the plugin generates no Knowledge for it. A Crossroad note is never removed, because other notes may still link to it.
- **Inflection tables** come from the batteries, independent of language, Family and Kind: `dumdict/inflection` projects them, and `dumcorpus/inflection`'s language packs label them. The plugin only renders them.

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
