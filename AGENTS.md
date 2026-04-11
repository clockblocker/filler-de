```bash
# Build
bun run build        # production
bun run dev          # watch mode
bun run build:dev    # dev + typecheck

# Test
bun test             # unit tests
bun run test:unit    # unit only (same as above)
bun run test:cli-e2e # CLI-based E2E (requires running Obsidian + .env.cli-e2e)
bun test path/to/test.test.ts  # single file

# Code quality
bun run lint         # check only
bun fix              # fix lint + format
bun run typecheck    # full tsgo typecheck
bun run typecheck:changed  # typecheck vs master (RUN BEFORE FINISHING WORK)

# CLI E2E (requires running Obsidian + .env.cli-e2e)
bun run test:cli-e2e                                          # full suite
CLI_E2E_VAULT=cli-e2e-test-vault CLI_E2E_VAULT_PATH=... bun run tests/cli-e2e/textfresser/edge-case-runner.ts  # edge cases
```

### Obsidian CLI

The project uses Obsidian's built-in CLI (macOS binary at `/Applications/Obsidian.app/Contents/MacOS/Obsidian`) for E2E tests.

**Usage**: `"/Applications/Obsidian.app/Contents/MacOS/Obsidian" vault=<vaultName> <command>`

Key commands:
- `create name="path" content="..." silent` — create a file
- `read path="path"` — read file content
- `files [folder="..."] [ext=md]` — list files
- `plugin:reload id=<pluginId>` — reload a plugin
- `eval code=<js>` — execute JavaScript in the running Obsidian context (accesses `app.*`)

The `eval` command is the workhorse for E2E: it calls plugin methods directly via `app.plugins.plugins['cbcr-text-eater-de']`.

**Important**: The test vault (`cli-e2e-test-vault`) has its **own copy** of `main.js` at `.obsidian/plugins/cbcr-text-eater-de/main.js`. After building, you must copy the build output to the test vault and reload:
```bash
cp main.js /path/to/cli-e2e-test-vault/.obsidian/plugins/cbcr-text-eater-de/main.js
"/Applications/Obsidian.app/Contents/MacOS/Obsidian" vault=cli-e2e-test-vault plugin:reload id=cbcr-text-eater-de
```

Wrapper utilities: `tests/cli-e2e/utils/` — `cli.ts` (obsidian/obsidianEval), `vault-ops.ts` (CRUD), `idle.ts` (waitForIdle).
