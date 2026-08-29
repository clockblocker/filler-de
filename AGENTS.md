```bash
# Build
bun run build        # production
bun run dev          # watch mode
bun run build:dev    # dev + typecheck

# Deterministic tests
bun test             # Bun discovery; desktop/provider suites are excluded
bun run test:unit    # repository unit, spec, and in-process integration tests
bun run test:integration # focused Library/Librarian integration tests
bun test path/to/test.test.ts

# Obsidian desktop E2E
bun run test:obsidian-e2e # attached dedicated vault
bun run test:obsidian-e2e --scenario=basename-healing
bun run test:obsidian-e2e:managed # disposable vault; Obsidian must be closed
bun run test:obsidian-e2e:infra # driver/transport only; no Obsidian required

# Provider acceptance (live Gemini is always explicit)
bun run test:provider-acceptance:preflight
TEXTFRESSER_PROVIDER_ACCEPTANCE=1 bun run test:provider-acceptance --suite=smoke

# Code quality
bun run lint
bun fix
bun run typecheck
bun run typecheck:changed  # RUN BEFORE FINISHING WORK
```

# Learning more about Effect

This repository uses the Effect TypeScript library.

Before writing any Effect code, first read `node_modules/effect/AGENTS.md`
**completely**, and follow the links in the file when required.

If you need to learn more about particular Effect APIs and concepts that the
guide does not cover, search through `node_modules/effect/src`.

## Obsidian desktop E2E

The only supported desktop harness is `tests/obsidian-e2e`. It uses Obsidian's
official CLI binary, normally
`/Applications/Obsidian.app/Contents/MacOS/obsidian-cli` or the registered
`obsidian` command. Never substitute the GUI executable
`/Applications/Obsidian.app/Contents/MacOS/Obsidian`: it does not provide the
required awaited CLI contract.

Attached mode reads `OBSIDIAN_E2E_VAULT_PATH` from `.env.obsidian-e2e`, resolves
that registered vault's ID, and opens or focuses it as a second window in the
existing Obsidian process. Existing local `.env.cli-e2e` files are accepted as
a configuration compatibility fallback only. The runner never closes the
user's existing vault. It owns deployment, readiness, isolation, diagnostics,
and cleanup; do not manually copy or reload artifacts between scenarios.

Scenario authors use only
`withObsidianScenario({ id, fixture }, callback)` from
`tests/obsidian-e2e/harness.ts`. The callback receives `act`, `snapshot`, and
`status`; raw `eval`, plugin internals, sleeps, reloads, and network stubs do
not belong in desktop scenarios. See `tests/obsidian-e2e/README.md`.

Live model-quality checks live in `tests/provider-acceptance`; they require an
explicit suite budget, opt-in flag, and provider key. They never share the
desktop E2E lifecycle.
