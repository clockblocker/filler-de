# E2E cutover coverage

The old shared-vault chain and fast-reload harnesses were retired after every
behavior was assigned to the narrowest honest test seam. The table is the
cutover ledger; it is not a queue of tests still waiting to move.

Desktop scenarios own behavior that must cross Obsidian's real vault,
file-manager callbacks, plugin lifecycle, or official CLI transport. Public
in-process tests own deterministic Library and Textfresser composition. Live
model quality is opt-in provider acceptance and never shares the desktop host.

## Intended Librarian interaction matrix

Every user-originated Tree Action has a desktop owner. `Create` is a leaf-only
action: Sections enter the Tree when a nested Scroll or File is created.
`ChangeStatus` applies only to Scrolls and Sections.

| Interaction | Section | Scroll | File |
| --- | --- | --- | --- |
| Create | `create-more-files.test.ts` (implicit ancestor) | `basename-healing.test.ts`, `create-more-files.test.ts` | `create-more-files.test.ts` |
| Delete | `delete-section.test.ts` | `delete-updates-codex.test.ts` | `delete-file.test.ts` |
| Rename Core Name | `rename-section.test.ts` | `create-and-rename-scroll.test.ts` | `rename-file.test.ts` |
| Move by path | `move-section-between-sections.test.ts` | `move-scroll-between-sections.test.ts` | `move-file-between-sections.test.ts` |
| Move by name | `folder-rename-healing.test.ts` | `move-leaves-by-name.test.ts` | `move-leaves-by-name.test.ts` |
| Change status | `change-status.test.ts` | `change-status.test.ts` | Not applicable |

The Librarian's user commands also have desktop owners:

| Command | Desktop owner |
| --- | --- |
| `SplitToPages` | `split-to-pages.test.ts` |
| `SplitInBlocks` | `librarian-commands.test.ts` |
| `GoToNextPage` | `librarian-commands.test.ts` |
| `GoToPrevPage` | `librarian-commands.test.ts` |
| Restart Librarian | `librarian-commands.test.ts` |

Classify on a selection (#63) is owned by `classify-selection.test.ts`: the
`UnitRef`s handed to the resolver port, a discontinuous unit's pieces, the
Segmentation Cache hit, an edit invalidating only its own Sentence, and the
block ID Classify gives the unit's block before it resolves anything. Its
dumgen answers from a scripted jev, so no provider is reached; the same
story runs in process in `tests/unit/classify/classify-commander.test.ts`.

Resolution (#64) is owned by `classify-resolution.test.ts`: a noun, a
separable verb and a Locution each linked to its Reading note beside its
Lemma note, and a re-encounter that appends an Attestation
with no Knowledge call. It also pins the ADR-0015 layout (#118): the
dictionary holds exactly the Lemma, Reading and Crossroad notes, a met
Surface's Crossroad included, each with its data in the hidden metadata
section and no `%%tf` marker; the Lemma note shows its Crossroad, its
Readings, its inflection table and "Begegnete Formen"; the Reading note
shows its sections, its "Deine Kontexte" embeds with their `|^<key>`
aliases and an embed of its table. Its scripted jev and Luna, and those
layout assertions, live in `classify-resolution-script.ts`, and
`tests/integration/classify/classify-resolution.test.ts` runs the same story
in process; the resolver's other cases are unit tests under
`tests/unit/classify/resolution/`. `dictionary-layout.ts` holds the layout
helpers every classifying scenario shares.

Licence Groups (#118) are owned by `classify-licence-groups.test.ts`: two
senses of Mutter whose plurals differ give the Lemma note two tables,
captioned 👩 and 🔩, and each Reading note embeds its own. Its script lives
in `classify-licence-groups-script.ts`, and
`tests/integration/classify/classify-licence-groups.test.ts` runs it in
process. `dictionary-metadata-modes.test.ts` classifies the same word with
"Hide metadata" off, so every note keeps its data in the frontmatter, and
then with the default again, so a scenario's settings end with it.

Breakdowns (#264) are owned by `classify-breakdown.test.ts`. Classifying
Kohlekraftwerk in a Scroll gives its Reading note a Morpheme section, a
morphemes line and a constituents line, whose pending part Kraftwerk
links to its Crossroad path as one Unsplit chunk. Classifying Kraftwerk
moves that link to Kraftwerk's Lemma note and splits the morphemes line
through it (`Kohle|kraft|werk`), and unlinking Kraftwerk's only occurrence
moves it back. A conversion, Lauf, shows a Source line and no constituents
line. Its Source moves to laufen's Lemma note once laufen, a bottom word,
is classified and split into its morphemes. A Reading that stores its
Breakdown or Source, or whose Source came back Unresolved
(`breakdownSettled`), asks for neither again. Its scripted jev answers the
segmenters and the Source by stage (`<stage>:<id>`), and
`classify-breakdown-script.ts` holds the scripts and the assertions it
shares with `tests/integration/classify/classify-breakdown.test.ts`, which
runs the same stories in process. The run, the re-pointing and the
rendering have unit tests of their own
(`tests/unit/classify/resolution/knowledge-breakdown.test.ts`,
`dictionary/tests/breakdown-links.test.ts`,
`lemma-note-codec/tests/breakdown.test.ts`). Formations (#269) are not on
master yet, and hovering the morphemes line (#270) stays manual, since
the harness has no pointer-hover action.

Removing a link from a Scroll (#116) is owned by `classify-unlink.test.ts`:
the occurrence of a deleted link goes, a Reading that still has a linked
occurrence stays, and one that lost its last goes with its Lemma note. The
unlink observer's guards (moved text, a lost block ID, a running Classify, a
repeated Sentence's instances, the Shadow re-evaluation after a removal,
another file at the Scroll's path, a block that is gone, links resolved as
Obsidian resolves them) are
unit tests in `tests/unit/classify/resolution/unlink-observer.test.ts` and
`scroll-unlinks.test.ts`. The scenario also shows the commit regenerating
the Crossroads it touches: heute's goes back to "not classified yet".

Rewriting a renamed Scroll's refs (#99) is owned by
`scroll-rename-refs.test.ts`: a Scroll the user renames keeps its
occurrences, each Deine Kontexte embed shows once by the new name with the
hidden metadata agreeing, and an unlink in the renamed Scroll still removes
its occurrence; a Scroll moved into a Section follows the Librarian's
suffix rename. Folder renames, rename chains and swaps, Obsidian's own
rewrite of the embeds, shared basenames, protected paths and a rename
while the plugin was off are unit tests in
`src/packages/composed/dictionary/tests/scroll-renames.test.ts`; the
observer staying quiet during the rename is in `unlink-observer.test.ts`.

Landing hand-wrapped links on Crossroad notes (#115) is owned by
`crossroad-link-landing.test.ts`: a word wrapped in `[[ ]]` in a Scroll is
rewritten to its Crossroad path, a word naming a Library note keeps the
Library's link, and a click on the uncreated Crossroad link creates the note
at that exact path, its folders included, filled as "not classified yet".
Its second story sets `newNotesInDictionary`, so Obsidian creates new notes
in `Worter/` as the user's vault does: a click on a bare `[[Kaffeekanne]]`
makes the stray `Worter/Kaffeekanne.md`, and the store heals it onto
`Worter/k/kaf/kaffe/kaffeekanne.md`, leaving the link as written. The
rewrite rules are unit tests in
`tests/unit/behaviors/wikilink-completion-behavior.test.ts`, and the other
stray-healing cases (merges, properties, `Untitled`) are
`dictionary/tests/stray-healing.test.ts`.

Startup lifecycle and its initial scan are covered by
`startup-healing.test.ts`; `harness-lifecycle.test.ts` verifies that a returned
mutation is already observable. VAM's Markdown modify subscription, including
Self Event filtering of the Librarian's Codex writes, is covered by
`md-modify-observation.test.ts`, over a Library Section rather than the
dictionary.

## Former Librarian chain

| Former case | Current owner |
| --- | --- |
| `000-init` codex creation and canonical suffixes | `startup-healing.test.ts` |
| `001-create-more-files` PathKing and NameKing creates | `create-more-files.test.ts` plus `library-core/tests/integration/create-healing-policies.test.ts` |
| `002-rename-files` hyphenated Section renames | `folder-rename-healing.test.ts` |
| `003-create-and-rename-a-file` | `create-and-rename-scroll.test.ts` |
| `004-delete-file` and Codex regeneration | `delete-updates-codex.test.ts` |
| `005-delete-folder` callback cascade | `delete-section.test.ts` |
| `006-rename-corename` repeated Core Name changes | `core-name-renames.test.ts` plus `library-core/tests/integration/repeated-corename-rename.test.ts` |
| `007-create-file-basename-healing` and backlink | `basename-healing.test.ts` |
| `008-toggle-scroll-checkbox` | `change-status.test.ts` plus deterministic details in `tests/integration/librarian/codex-checkbox-public.test.ts` |
| `009-toggle-section-checkbox` | `change-status.test.ts` plus deterministic details in `tests/integration/librarian/codex-checkbox-public.test.ts` |
| `011-move-file-cli-codex` | `move-scroll-between-sections.test.ts` |
| Scroll split command, file lifecycle, and Codex projection | `split-to-pages.test.ts` plus `tests/integration/librarian/split-to-pages-public.test.ts` for deterministic failure and queue semantics |

The initial fixture's out-of-Library file never had a direct assertion. Library
scope rejection is covered explicitly by the `make-library-scoped` and bulk
adapter package tests instead of carrying an unrelated file through every
desktop story.

## Former Textfresser E2E and live runners

| Former behavior | Current owner |
| --- | --- |
| A completed mutation is visible before the harness returns | `harness-lifecycle.test.ts` |
| CLI stdout/error parsing | `tests/obsidian-e2e/infra/cli.test.ts` |

## Former fast suite

| Former fast case | Current owner |
| --- | --- |
| Create and rename | `create-and-rename-scroll.test.ts` |
| Unsuffixed Scroll healing | `basename-healing.test.ts` |
| Delete Scroll | `delete-updates-codex.test.ts` |
| Repeated Core Name rename | `core-name-renames.test.ts` |
| Folder rename sequence | `folder-rename-healing.test.ts` |

## Harness contracts

- The outer runner owns one exclusive Obsidian session and deploys once while
  both plugins are disabled.
- Each callback owns `E2E/<session>/<scenario>/Library`; paths passed to
  fixtures and actions are relative to that Library.
- `act` settles the real plugin before returning and never retries an
  ambiguously delivered mutation.
- `snapshot` returns a sorted, atomic view of the scoped Library.
- Every mutation is fenced to one Textfresser instance and generation.
- Failures preserve structured driver state, Obsidian errors/console, and a
  screenshot; successful runs remove temporary artifacts.

Opening the dictionary reset (#65, #117) is owned by
`dictionary-reset-modal.test.ts`: the "Reset dictionary from old notes…"
command lists the vault's root folders and opens its modal, offering the
vault-root `Worter/` as a source; the driver closes the modal again,
clicking nothing in it. The reset's plan, dry run and Execute are unit tests
under `tests/unit/dictionary-reset/`, and
`tests/unit/dictionary-reset/vam-reset-vault.test.ts` lists the root
through a real VAM over an app that finds it, as Obsidian does, only as "/".
