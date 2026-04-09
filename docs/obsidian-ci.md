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
