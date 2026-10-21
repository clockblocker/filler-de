# Textfresser Library Management

This context defines the language for the managed Library and its boundary with an Obsidian vault. It covers the Librarian, the Vault Action Manager, the translation of observed vault changes into Library intentions, and the dictionary of Lemma, Reading and Crossroad notes.

Dictionary terms follow the batteries' [dumling](https://github.com/clockblocker/texteater/blob/main/battery/dumling/GLOSSARY.md), [dumrel](https://github.com/clockblocker/texteater/blob/main/battery/dumrel/GLOSSARY.md) and [dumdict](https://github.com/clockblocker/texteater/blob/main/battery/dumdict/GLOSSARY.md) glossaries. Where this glossary and theirs differ, theirs wins.

## Managed Library

**Library**:
The configured subtree of an Obsidian vault whose organization, names, indexes, and reading state are kept consistent by the Librarian.
_Avoid_: Vault, repository, collection

**Section**:
A branch in the Library hierarchy, represented in the vault by a folder and in the Library Tree by a Section Node. Say Library Section where a Block could be meant.
_Avoid_: Category, directory node; Section, for a part of a Lemma note

**Scroll**:
A Markdown content item in the Library that can carry reading status.
_Avoid_: Note, document, Markdown file

**File**:
A non-Markdown content item in the Library. A File has no reading progress and therefore has `Unknown` status.
_Avoid_: Asset, attachment, Scroll

**Codex**:
A Librarian-generated index for a Section, listing its children and exposing their reading status. A Codex describes Library content but is not itself a Library node.
_Avoid_: Index note, Scroll, table of contents

**Core Name**:
The user-meaningful part of a Scroll or File basename after its Library Suffix has been removed.
_Avoid_: Basename, filename

**Library Suffix**:
The delimiter-separated, reverse-ordered chain of ancestor Section names appended to a leaf's Core Name. It makes the leaf's intended Library position recoverable from its basename.
_Avoid_: Extension, path, tag

**Canonical Leaf**:
A Scroll or File whose vault location and basename encode the same Section chain under the current naming rules.
_Avoid_: Valid file, normalized note

**Reading Status**:
The progress state of a Scroll: `NotStarted`, `Done`, or `Unknown`. A Section's status is derived from its descendants rather than stored on the Section itself.
_Avoid_: Checkbox state, completion flag

## Library Consistency

**Librarian**:
The domain coordinator that maintains the Library Tree and reconciles the vault representation with the Library's naming, indexing, backlink, and reading-status rules.
_Avoid_: File watcher, Vault Action Manager, filesystem adapter

**Library Tree**:
The Librarian's hierarchical model of Sections, Scrolls, and Files. It represents Library identity independently of transient Obsidian file objects.
_Avoid_: Vault tree, folder tree, filesystem

**Tree Action**:
A semantic intention to create, delete, rename, move, or change the status of a node in the Library Tree.
_Avoid_: Vault Action, Healing Action, file operation

**Healing**:
Reconciliation that restores agreement between the Library Tree and its vault representation after an observed change.
_Avoid_: Migration, import, repair command

**Healing Action**:
A correction identified by Healing before it is translated into a Vault Action.
_Avoid_: Tree Action, Vault Action

**Observed Split Path**:
The actual vault location seen after a user operation, retained when Healing may need to move or rename that item to its canonical location.
_Avoid_: Canonical path, target locator

**Name-King Policy (`NameKing`)**:
The interpretation policy for a leaf placed directly under the Library root, where its Library Suffix expresses the intended Section chain.
_Avoid_: Filename mode, root mode

**Path-King Policy (`PathKing`)**:
The interpretation policy for a leaf inside nested Section folders, where the folder path expresses the intended Section chain and an inconsistent suffix is healed.
_Avoid_: Folder mode, nested mode

## Obsidian Boundary

**Vault Action Manager (VAM)**:
The Librarian's boundary for reading vault state, requesting vault changes, and observing typed vault events. VAM coordinates Obsidian interaction without owning Library semantics.
_Avoid_: BAM, Librarian, Obsidian DataAdapter

**Split Path**:
A typed, vault-scoped identity for a folder, Markdown file, or other file, separated into path parts, basename, kind, and—when applicable—extension.
_Avoid_: String path, system path, node locator

**Vault Action**:
A typed request for VAM to create, update, rename, process, or trash a vault item.
_Avoid_: Tree Action, Healing Action, Obsidian event

**Dispatch Batch**:
A set of Vault Actions submitted to VAM as one coordination unit. It is dependency-ordered and executed sequentially, but it is not an atomic transaction with rollback.
_Avoid_: Transaction, bulk event, atomic write

**Vault Event**:
VAM's typed observation of a create, rename, or delete reported by Obsidian.
_Avoid_: Vault Action, Tree Action, user-interface event

**Bulk Vault Event**:
A time-bounded observation containing normalized Vault Events plus Semantic Roots that identify independent user intent.
_Avoid_: BAM, Dispatch Batch, bulk operation

**Semantic Root**:
A Vault Event that represents an independent user operation after descendant effects and other derived noise have been removed. A folder root can imply changes to its entire subtree.
_Avoid_: First event, root folder, raw event

**Self Event**:
An Obsidian Vault Event expected as a consequence of a Vault Action dispatched by VAM, rather than a new user intention.
_Avoid_: Duplicate event, recursive action

**Bulk Vault Action Adapter**:
The Library boundary that translates a Bulk Vault Event into Tree Actions by applying Library scope, materializing single-node observations, and inferring Library intent. Despite its source name, it neither executes Vault Actions nor implements an Obsidian adapter.
_Avoid_: BAM, VAM, DataAdapter, bulk executor

**Materialized Node Event**:
A Library-scoped, single-node observation used between bulk-event normalization and Tree Action translation.
_Avoid_: Tree Action, raw Vault Event

## Dictionary

**Lemma**:
A grammatical entity identified by its language, Family, Kind, Core Features and Canonical Form. A Lemma carries no meaning; its Readings do. A Lemma together with its sense emojis is a Reading.
_Avoid_: Dictionary entry, Lemma Form

**Core Features**:
The grammatical features that belong to a Lemma's identity, such as a noun's gender.
_Avoid_: Inherent Features

**Reading**:
One Lemma together with one Emoji Description: a sense of the Lemma. A Foreign Lemma has exactly one Reading and no Emoji Description.
_Avoid_: Sense, meaning, Entry

**Emoji Description**:
The emoji label that tells the Readings of one Lemma apart. It is an identity label, not a mnemonic.
_Avoid_: Sense emojis, gloss

**Surface**:
A reusable grammatical form that realizes exactly one Lemma, such as an inflected form.
_Avoid_: Selection, selected text

**Attestation**:
A fleeting occurrence of one Surface in a text. It has no durable identity and is never stored as one.
_Avoid_: Selection, source reference, context

**Attestation Ref**:
A durable reference to the place in a Scroll where an Attestation occurred, stored as an embed in a Reading Entry's or Surface Entry's `attestations`.
_Avoid_: Attestation, Kontext

**Reading Knowledge**:
Optional linguistic content owned by one Reading, such as translations, definition, Semantic Relations, morphological tree, valency, plural and conjugation class. A Lemma owns no Knowledge.
_Avoid_: Lemma metadata, sections

**Semantic Relation**:
A direct claim from one Reading to a Lemma or Reading, stored only on its source. Inverse and inferred relations are projected when a note is read and are never written.
_Avoid_: Lexical Relation, propagated relation

**Pending Semantic Relation**:
A Semantic Relation whose target does not exist yet, kept as a dumdict record until a matching Lemma is created. It is stored only in its source Reading Note's metadata, and its link points at the target's Crossroad Note path.
_Avoid_: Stub note, placeholder target, Shadow note

**Lemma Record**, **Reading Entry**, **Surface Entry**:
The dumdict records for a Lemma, for one of its Readings with its Knowledge and learner content, and for one Surface it owns. With Pending Semantic Relations, they are the dictionary's only data.
_Avoid_: Entry, for any of them alone

**Lemma Note**:
The Markdown note of one Lemma, which is also the note of its base-form Surface. Its metadata holds the Lemma Record and every owned Surface Entry. It lists every Surface met so far, each with an anchor, and shows one inflection table per Licence Group. No inflected Surface gets a note of its own. It lives at `Worter/<lang>/<Family>/<Kind>/<core slots…>/<l1>/<l3>/<l5>/<spelling>.md` (ADR-0015).
_Avoid_: Vocabulary note, surface host, Dict Note

**Reading Note**:
The Markdown note of one Reading, named `<emoji> <spelling>.md` in its Lemma Note's folder, such as `🚗 Fahrer.md`; a Foreign Reading takes `∅` for the emoji. Its metadata holds the Reading Entry and the Pending Semantic Relations whose source it is. It embeds its Licence Group's inflection table from the Lemma Note.
_Avoid_: Sense note, Reading block

**Crossroad Note**:
The plugin-owned note of one folded spelling (dumling's `canonicalFormKey`), at `Worter/<l1>/<l3>/<l5>/<key>.md`. It lists every Lemma and every met Surface with that spelling and holds no records. Every link the plugin writes without knowing the exact sense points at it, unless its Unit Shadow matches exactly one Lemma, and a word the user wraps in `[[ ]]` lands on it. A Crossroad Note whose spelling has no Lemma yet says "not classified yet".
_Avoid_: Surface host, disambiguation note, Shadow note

**Shard Folders**:
The three folders `<l1>/<l3>/<l5>` above a Lemma, Reading or Crossroad Note: the first one, three and five graphemes of the spelling's `canonicalFormKey`, with whitespace dropped. A shorter spelling repeats in full (`t/tag/tag/`).
_Avoid_: Prefix folders, buckets

**Name Segment**:
A folder or file name the plugin writes, spelled by `toNameSegment`, which drops the characters Obsidian forbids. Names are lossy; the real spelling lives in metadata.
_Avoid_: Encoded basename

**Path Collision**:
Two identities, or two spellings of one folder, whose paths have equal collision keys: the full Unicode case fold of the NFC path, so `Maße.md` and `MASSE.md` are one file. It is reported and never overwritten.
_Avoid_: Duplicate note

**Block**:
A typed part of a Lemma Note or Reading Note, whose data lives in the note's metadata. A Block serializes one dumdict or dumrel field, is a Projection Block, or is plugin-owned.
_Avoid_: Section, Entry Section

**Projection Block**:
A Block rendered from dictionary data and never parsed back, such as the Header, Tags, inverse relations, or an inflection table. Editing it changes no data.
_Avoid_: Generated section, cache

**Block ID**:
The plugin-owned Obsidian block ID of an inflection table or a met Surface in a Lemma Note, which Reading Notes embed and other notes link: `^t` or a short hash of its Licence Group for a table (#112), and `^s-<hash>` for a Surface.
_Avoid_: Entry ID, sense ID

## Classify

**Classify**:
The command that segments the Sentences a selection in a Scroll touches through dumgen and links each covered Segment to its unit's Reading Note. It pipes two stages: segmentation, then resolution.
_Avoid_: Lemma command, click classification

**Segmentation Cache**:
The device-local store of Segmented Sentences in the hidden vault folder `.textfresser/segmentation/`, one immutable entry per Sentence key: a hash of the segmenter version, the language and the Sentence's Stitched Text. It holds no Scroll identity, so only an edit to the Sentence invalidates its entry.
_Avoid_: Sidecar, segmentation index

**Unit Ref**:
The hand-off from segmentation to resolution: a Sentence key plus one dumgen unit's Segment indices, discontinuous pieces included. The unit's route gives its Family and Kind. It never touches disk in piped Classify.
_Avoid_: Segment ID, provisional link

**Selection** (retired):
Use Attestation for an occurrence and Surface for a form.
