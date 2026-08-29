# Obsidian E2E scenario migration

The desktop suite keeps only behavior that must cross a real Obsidian process,
vault index, CLI transport, or plugin lifecycle. Pure domain coordination moves
to deterministic in-process integration tests. Network-backed language-model
behavior remains an explicit provider acceptance suite.

The desktop runner owns one Obsidian host and session. Each test owns an isolated
`E2E/<session>/<scenario>/Library` subtree inside that session. Fixture paths,
actions, and snapshots remain relative to the scenario's logical `Library`
root. A scenario performs its complete story inside one test and receives a
settled snapshot after every action; it does not reload the plugin, sleep, poll
individual files, or evaluate arbitrary renderer JavaScript.

## Legacy Librarian chain

| Legacy scenario | Destination | Migration |
| --- | --- | --- |
| `000-init` startup healing and codex creation | Desktop E2E | Keep one runner-level host startup scenario. Per-test `beginScenario` coverage proves reconfiguration and fixture discovery, but it does not replace a cold plugin-start assertion. |
| `001-create-more-files` NameKing/PathKing batch | In-process integration | Exercise the full Bulk Vault Event to Tree Action to Healing plan with deterministic adapters. Keep only one representative runtime create in desktop E2E. |
| `002-rename-files` hyphenated folder renames | Desktop E2E | Ported as `folder-rename-healing.test.ts`. |
| `003-create-and-rename-a-file` | Desktop E2E | Port the focused same-folder CLI rename from `cli-fast`; it covers Obsidian rename delivery and codex regeneration without prerequisite chain state. |
| `004-delete-file` | Desktop E2E | Ported as `delete-updates-codex.test.ts`. |
| `005-delete-folder` | Desktop E2E | Keep one isolated folder-delete scenario because Obsidian emits a descendant callback cascade. Cover root reduction variants in-process. |
| `006-rename-corename` three consecutive leaf renames | In-process integration plus one desktop smoke | Put rename-chain collapse and final codex planning under deterministic time. Retain one short real-CLI rename story to verify delivery. |
| `007-create-file-basename-healing` | Desktop E2E | Ported as `basename-healing.test.ts`. |
| `008-toggle-scroll-checkbox` | In-process integration | The legacy helper calls `librarian.handleCodexCheckboxClick` directly, so it is not a UI E2E. Test status propagation through the Librarian interface. Add a separate desktop click test only when the harness has an intentional UI-action interface. |
| `009-toggle-section-checkbox` | In-process integration | Test descendant propagation deterministically. A future desktop UI smoke may cover event decoding once. |
| `010-lemma-manne` with live monkey patches | In-process integration plus deterministic desktop command smoke | Inject a deterministic linguistic adapter at boot for the desktop command path. Keep language quality out of desktop E2E. |
| `011-move-file-cli-codex` | Desktop E2E | Port as one isolated move story using the public action interface. Delete the duplicate `move-file-codex-regeneration.test.ts` after parity is established. |

## Legacy Textfresser suites

| Legacy scenario | Destination | Migration |
| --- | --- | --- |
| P0 idempotent reruns / no nested wikilinks | In-process integration | The important contract is deterministic source rewriting; cover multiple surfaces and reruns without a desktop host. |
| `waitForIdle` makes the source rewrite visible | Desktop E2E harness contract | Replace this with a harness self-test proving that `act` returns only after its mutation is visible in the atomic snapshot. |
| latest pending background Generate wins | In-process integration | Keep this at the background-generate coordinator seam with a deterministic scheduler and test clock. |
| `smoke-test-runner.ts` real Gemini derivations | Provider acceptance | Run only through an explicit secret-bearing, budgeted command in a disposable vault. |
| `edge-case-runner.ts` H1 homonyms | Provider acceptance | Preserve as model-quality cases, not deterministic E2E assertions. |
| `edge-case-runner.ts` H2 cross-POS | Provider acceptance | Preserve as model-quality cases. |
| `edge-case-runner.ts` separable verbs | Provider acceptance | Preserve as model-quality cases. |
| `edge-case-runner.ts` phrasems | Provider acceptance | Preserve as model-quality cases. |
| `edge-case-runner.ts` adjective forms | Provider acceptance | Preserve as model-quality cases. |
| `cli-noise.test.ts` | Driver unit test | Test structured CLI parsing with captured stdout/stderr fixtures. It is transport behavior, not a desktop scenario. |

## `cli-fast` suite

| Fast scenario | Destination | Migration |
| --- | --- | --- |
| `create-file-basename-healing-fast` | Desktop E2E | Ported as `basename-healing.test.ts`; fixed waits are removed. |
| `delete-file-fast` | Desktop E2E | Ported as `delete-updates-codex.test.ts`; its fixture now owns an isolated scenario subtree rather than sharing Library state with other tests. |
| `rename-files-fast` | Desktop E2E | Ported as `folder-rename-healing.test.ts`; both folder renames and the assertion are one story. |
| `create-and-rename-file-fast` | Desktop E2E | Port next as the isolated replacement for legacy step 003. |
| `rename-corename-fast` | In-process integration plus desktop smoke | Move timing-sensitive rename collapse to deterministic integration coverage and retain a representative real-host rename. |

## Harness assumptions encoded by these files

- The outer runner exclusively owns one Obsidian host and session.
- `withObsidianScenario` allocates
  `E2E/<session>/<scenario>/Library`, changes the plugin's `libraryRoot`, seeds
  fixtures through Obsidian interfaces, and settles before entering the
  callback.
- The logical Library root basename remains `Library`, so Library suffixes do
  not include session or scenario identifiers.
- Fixture and action paths are relative to `Library`.
- `act` settles the plugin before it resolves and never retries an ambiguously
  delivered mutation.
- `snapshot()` is atomic and returns relative, sorted paths plus Markdown
  contents after all observed work is settled.
- Binary files appear with `kind: "file"`; Markdown files use `kind: "md"`.
- `status()` is bound to the same instance generation for the whole callback.
- `withObsidianScenario` removes the scenario subtree even when an assertion
  fails. The outer runner shuts down the owned host after the session.
