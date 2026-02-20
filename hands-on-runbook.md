# Textfresser Hands-On Runbook (Command-Driven)

This runbook avoids embedded bash snippets. Manual testing is performed through executable scripts in `scripts/runbook-cli/`.

Primary vault target: `cli-e2e-test-vault`  
Primary source note: `textfresser/0_Synthetic_Test_To_Check_Morhp.md`  
CLI entrypoint: `scripts/runbook-cli/textfresser-runbook`

## Philosophy

1. Keep checks composable and reusable.
2. Prefer command primitives over scenario macros.
3. Treat command output as hints; confirm state through vault files.
4. Always gate assertions with idle synchronization.
5. Separate health checks (preflight/doctor/scan) from mutation commands (lemma/reset).

## Command Index

| Command | Purpose |
|---|---|
| `scripts/runbook-cli/textfresser-runbook preflight` | Verify Obsidian CLI, target vault, and plugin command registration. |
| `scripts/runbook-cli/textfresser-runbook doctor` | Run deeper diagnostics (process + IPC smoke + plugin visibility). |
| `scripts/runbook-cli/textfresser-runbook show-config` | Print resolved `VAULT`, `PLUGIN_ID`, `SRC`, `OBSIDIAN_BIN`. |
| `scripts/runbook-cli/textfresser-runbook wait-idle` | Wait until Textfresser async work settles. |
| `scripts/runbook-cli/textfresser-runbook lemma <surface>` | Fire Lemma for one surface in `SRC`. |
| `scripts/runbook-cli/textfresser-runbook read-source` | Read the current source note. |
| `scripts/runbook-cli/textfresser-runbook links-source` | List outgoing links from `SRC`. |
| `scripts/runbook-cli/textfresser-runbook list-entries` | List dictionary entries under `Worter/de`. |
| `scripts/runbook-cli/textfresser-runbook check-no-nested` | Detect nested wikilinks in `SRC`. |
| `scripts/runbook-cli/textfresser-runbook check-entry <path>` | Validate that one dictionary note is non-empty. |
| `scripts/runbook-cli/textfresser-runbook scan-empty` | Validate all `Worter/de` links from `SRC` are non-empty notes. |
| `scripts/runbook-cli/textfresser-runbook reload-plugin` | Reload `cbcr-text-eater-de` in the target vault. |
| `scripts/runbook-cli/textfresser-runbook reset-source` | Recreate `SRC` fixture and wait for idle. |
| `scripts/runbook-cli/textfresser-runbook reset` | Full clean slate: trash `Worter`, reset source, reload plugin. |

The same commands are available via `bun run runbook -- <command>`.

## Recommended Manual Workflow

1. Run `scripts/runbook-cli/textfresser-runbook preflight`.
2. Run `scripts/runbook-cli/textfresser-runbook read-source`.
3. Run one or more `scripts/runbook-cli/textfresser-runbook lemma <surface>` calls.
4. Run `scripts/runbook-cli/textfresser-runbook wait-idle`.
5. Run `scripts/runbook-cli/textfresser-runbook check-no-nested`.
6. Run `scripts/runbook-cli/textfresser-runbook links-source`.
7. Run `scripts/runbook-cli/textfresser-runbook scan-empty`.

## Known Findings From Synthetic Morph Note (2026-02-20)

1. Surface rewriting is incremental; `[[fährt]]` can later normalize to `[[fahren|fährt]]`.
2. Some lemma pairs produce good bidirectional morphology links (`fahren` and `Abfahrt`).
3. Multi-command runs can produce link updates even when some generated target notes remain empty.

## Pain Points

1. Zero-byte dictionary notes can be created and linked.
2. `command id=...` reporting `Executed` is not enough to claim success.
3. `whenIdle()` alone does not guarantee non-empty generated notes.
4. Path casing and umlaut normalization can make manual checks error-prone.
5. `dev:errors` and `dev:console` may stay quiet even when generation quality is degraded.

## Suggestions

1. Add post-lemma integrity validation in plugin flow (retry or mark failed generation if note stays empty).
2. Add explicit plugin command for generation health summary.
3. Keep manual checks command-driven and avoid in-markdown script duplication.

## Environment Overrides

All runbook commands accept environment overrides: `VAULT`, `PLUGIN_ID`, `SRC`, `OBSIDIAN_BIN`.
