```bash
# Build
bun run build        # production
bun run dev          # watch mode
bun run build:dev    # dev + typecheck
bun run batteries:sync # make and link the worktree for batteries.lock
bun run batteries:sync --bump # move batteries.lock to texteater origin/main

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

# Provider acceptance (live providers are always explicit)
bun run test:provider-acceptance:preflight
TEXTFRESSER_PROVIDER_ACCEPTANCE=1 bun run test:provider-acceptance:dumgen --suite=smoke # TypeSafe + OpenAI

# Code quality
bun run lint         # biome, then lint:ox, then gauge:effect --check
bun run lint:ox      # oxlint with the @effect/tsgo rules; errors in src/
bun run gauge:effect --check scripts/effect-gauge-targets.json
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

Unlike that guide, this repository uses no Effect `Schema`. Define errors with
`Data.TaggedError`, put a wrapped failure in a `cause` field, and validate
with Zod, as the batteries do (texteater ADR 0013, dumgen ADR 0009).
`bun run lint:ox` rejects imports of `Schema` and its `Schema*` modules from
`effect` and `effect/Schema*`. It also rejects `import * as … from "effect"`,
which would reach `Schema`; import the modules you use by name.

## Enforcing the Effect end state

The Effect migration (#215) is enforced by `bun run lint`, which runs
`lint:ox` and `gauge:effect --check scripts/effect-gauge-targets.json`.

- **Lint rules.** `.oxlintrc.json` makes the `@effect/tsgo` effect-native,
  error and run rules, and `typescript/no-floating-promises`, errors in all
  of non-test `src/`. A line that must break one says why, with
  `// oxlint-disable-next-line <rule> -- <reason>`. `lint:ox` fails on a
  directive that suppresses nothing, and the gauge fails on one with no
  reason, and on more suppressions than its target.
- **What tsgo can't see.** `scripts/effect-gauge.ts` counts `Effect.run*`
  and `runtime.run*` sites, `throw` and `try`, and the retired APIs. Run
  sites, `throw` and `try` are allowed only in the files
  `scripts/effect-gauge-allowlist.ts` names, each with a reason and a count.
  `src/runtime/**` is the one run boundary. A new edge needs an entry there,
  and a removed one needs its entry lowered or dropped; `--check` fails
  either way until the list matches.

## Battery packages from texteater

`common-utils`, `dumling`, `dumrel`, `dumcorpus`, `dumdict` and `dumgen` come
from [clockblocker/texteater](https://github.com/clockblocker/texteater) at
the commit pinned in `batteries.lock`. They are read from its
`battery/*/src`, with no `dist`. Nothing is copied. The plugin never builds
against a texteater working checkout, such as `~/work/textfresser-batteries`,
because those hold local commits and lag origin.

- **The lock.** `batteries.lock` holds one full texteater commit SHA. It is
  committed, so each plugin commit names the batteries it builds against.
  Bump it in its own commit, or in the PR that needs the new batteries.
- **The worktrees.** Each locked SHA gets a git worktree of the shared clone
  `~/work/texteater-clones/plugin`, detached at that SHA, at
  `~/work/texteater-clones/plugin@<sha>`. When that worktree is missing, the
  scripts clone the shared clone if needed and fetch it if it lacks the
  commit. They add the worktree under a staging name, run `bun install` in
  it, and only then move it into place. Branches locked to different SHAs
  therefore build side by side, and bumping one branch's lock never moves
  another branch's batteries. The shared clone's own checkout is never
  touched. Old worktrees stay until you remove them with
  `git -C ~/work/texteater-clones/plugin worktree remove <path>`.
- **The link.** `bun install` runs `scripts/link-texteater.ts --warn-only` as
  `postinstall`. It makes the locked worktree when missing and points the
  gitignored `.texteater` symlink at it. When it cannot, for example offline,
  it only warns. `bun run link:texteater` does the same and fails instead. A
  fresh worktree, or one that rebased onto a new lock, therefore needs only
  `bun install`.
- **Bumping.** `bun run batteries:sync` (`scripts/sync-texteater.ts`) makes
  and links the locked worktree. `bun run batteries:sync --bump` first
  fetches the shared clone and moves `batteries.lock` to texteater's
  `origin/main`. Run it to pick up merged battery PRs, then commit
  `batteries.lock`.
- **The override.** To build against another texteater, set
  `TEXTEATER_DIR=/path/to/texteater` and run `bun run link:texteater`. The
  directory is linked as is. Nothing fetches it, adds a worktree to it,
  installs in it or writes into it.
- **The pinned commit.** `bun run build`, `build:full` and `dev` start with
  `bun run batteries:report`. It prints the locked SHA and the texteater path
  and commit `.texteater` resolves to, and marks a dirty tree. It fails when
  the link is not at the locked SHA, unless `TEXTEATER_DIR` is set, so run
  `bun install` after a rebase that moves the lock. The build log, including
  the one from `test:obsidian-e2e`, records which batteries were bundled.
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
