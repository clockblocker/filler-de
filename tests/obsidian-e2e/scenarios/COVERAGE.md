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

Startup lifecycle and its initial scan are covered by
`startup-healing.test.ts`; `harness-lifecycle.test.ts` verifies that a returned
mutation is already observable.

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
| `010-lemma-manne` source rewrite | `tests/unit/textfresser/steps/lemma-flow.test.ts` through public `Textfresser.executeCommand` |
| `011-move-file-cli-codex` | `move-scroll-between-sections.test.ts` |
| Scroll split command, file lifecycle, and Codex projection | `split-to-pages.test.ts` plus `tests/integration/librarian/split-to-pages-public.test.ts` for deterministic failure and queue semantics |

The initial fixture's out-of-Library file never had a direct assertion. Library
scope rejection is covered explicitly by the `make-library-scoped` and bulk
adapter package tests instead of carrying an unrelated file through every
desktop story.

## Former Textfresser E2E and live runners

| Former behavior | Current owner |
| --- | --- |
| Repeated Lemma runs remain idempotent and never nest wikilinks | `tests/unit/textfresser/steps/lemma-source-rewrite.test.ts` and `lemma-cache.test.ts` |
| A completed mutation is visible before the harness returns | `harness-lifecycle.test.ts` |
| Latest pending background Generate wins | `tests/unit/textfresser/orchestration/background-generate-coordinator.test.ts` |
| Non-empty generated entry and cleanup behavior | background-generate and Generate step tests |
| Nine live Gemini smoke cases | `tests/provider-acceptance/textfresser` smoke corpus |
| Twenty-five homonym, cross-POS, separable-verb, phraseme, and adjective cases | `tests/provider-acceptance/textfresser` edge corpus |
| CLI stdout/error parsing | `tests/obsidian-e2e/infra/cli.test.ts` |

Provider reports explicitly list the orchestration assertions they do not own.
Those assertions stay deterministic rather than being recreated through live
plugin monkey-patches.

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
