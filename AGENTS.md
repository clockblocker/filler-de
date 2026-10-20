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

## Battery packages from texteater

`common-utils`, `dumling`, `dumrel`, `dumcorpus`, `dumdict` and `dumgen` come
from a local checkout of [clockblocker/texteater](https://github.com/clockblocker/texteater).
They are read from its `battery/*/src`, so the checkout needs no `bun install`
and no `dist`. Nothing is copied, and nothing is written inside texteater.

- **Where texteater goes.** Clone it as `texteater` or `textfresser-batteries`
  next to this checkout, or next to any parent folder, such as the vault. To
  use another location, set `TEXTEATER_DIR=/path/to/texteater` and run
  `bun run link:texteater`.
- **The link.** `bun install` runs `scripts/link-texteater.ts` as
  `postinstall`. It points the gitignored `.texteater` symlink at the checkout,
  keeps an existing link that still holds the batteries, and only warns when
  no checkout is found. Re-run `bun run link:texteater` after moving the
  checkout.
- **Resolution.** `tsconfig.json` `paths` map each battery export to its
  `.texteater/battery/<pkg>/src` entry, and map `effect`, `zod`,
  `emoji-regex`, `jsonc-parser` and `@typesafe-ai/sdk` to this repo's
  `node_modules`. That gives the bundle one copy of effect and one of zod. Bun
  resolves imports from a symlink's real path and uses the nearest tsconfig,
  so `build:root`, `test:unit`, `test:integration` and `coverage` pass
  `--tsconfig-override=tsconfig.json` to apply the paths inside battery files
  too. Bun then prints a harmless `Internal error: directory mismatch` line.
  Pass the same flag to any other `bun test` or `bun build` that loads a
  battery, including workspace-package scripts; without it, battery code
  loads texteater's own effect.
- **Type-only mapping.** `@typesafe-ai/sdk` maps to its declarations, so
  battery code may import only types from it.
- **When a battery changes.** If a battery gains an npm dependency, add it
  here at the same version. If battery code gains a bare import or a battery
  gains an export, add its `paths` entry.
  `tests/unit/batteries/battery-link.test.ts` fails until you do. Import
  `dumcorpus/inventories`, not the `dumcorpus` root, which reads files through
  `node:fs`.

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
