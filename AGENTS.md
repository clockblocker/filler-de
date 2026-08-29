```bash
# Build
bun run build        # production
bun run dev          # watch mode
bun run build:dev    # dev + typecheck

# Test
bun test             # unit tests
bun run test:unit    # unit only (same as above)
bun run test:obsidian-e2e # new isolated desktop E2E; attached test vault
bun run test:obsidian-e2e:managed # disposable vault; Obsidian must be closed
bun run test:obsidian-e2e:infra # no Obsidian required
bun run test:cli-e2e # CLI-based E2E (requires running Obsidian + .env.cli-e2e)
bun test path/to/test.test.ts  # single file

# Code quality
bun run lint         # check only
bun fix              # fix lint + format
bun run typecheck    # full TypeScript 7 typecheck
bun run typecheck:changed  # typecheck vs master (RUN BEFORE FINISHING WORK)

# Legacy CLI E2E (migration only; requires running Obsidian + .env.cli-e2e)
bun run test:cli-e2e                                          # full suite
CLI_E2E_VAULT=cli-e2e-test-vault CLI_E2E_VAULT_PATH=... bun run tests/cli-e2e/textfresser/edge-case-runner.ts  # edge cases
```

# Learning more about Effect

This repository uses the Effect Typescript library.

Before writing any Effect code, first read `node_modules/effect/AGENTS.md`
**completely**, and follow the links in the file when required.

If you need to learn more about particular Effect apis and concepts that the
guide doesn't cover, search through the source code in `node_modules/effect/src`.

### Obsidian CLI

New E2E tests use Obsidian's official CLI binary, normally
`/Applications/Obsidian.app/Contents/MacOS/obsidian-cli` or the registered
`obsidian` command. Never substitute the GUI executable
`/Applications/Obsidian.app/Contents/MacOS/Obsidian`: it returns before async
renderer work settles.

Run `bun run test:obsidian-e2e`; the runner builds, deploys while plugins are
disabled, enables the E2E driver before Textfresser, waits for explicit
readiness, and cleans up. Do not manually copy or reload artifacts between
scenarios.

Scenario authors use only `withObsidianScenario({ id, fixture }, callback)`
from `tests/obsidian-e2e/harness.ts`. The callback receives `act`, `snapshot`,
and `status`; raw `eval`, plugin internals, sleeps, and reloads are forbidden in
new desktop scenarios. See `tests/obsidian-e2e/README.md`.
