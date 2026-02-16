# E2E Testing — Architecture (CLI-Based)

> **Scope**: This document covers the CLI-based end-to-end testing infrastructure for the Textfresser plugin. For the file system abstraction layer, see `vam-architecture.md`. For vocabulary/dictionary commands, see `textfresser-architecture.md`.

---

## 1. Purpose

The E2E test suite validates the Textfresser plugin **running inside a real Obsidian instance**, exercising the full stack: vault mutations → plugin event pipeline → healing/codex generation → file system state. The suite uses Obsidian's CLI interface (`Obsidian --vault=X command`) to drive operations from an external Bun test process.

**Test targets**: Librarian healing, codex generation, suffix healing, status propagation, file/folder deletion cleanup.

**Current coverage**: 16 tests across 8 chain steps (000–007), covering init healing, file creation, folder rename, create+rename, single file delete, folder delete, corename rename, and basename healing.

**Not yet ported** (deferred):
- Checkbox clicking (old chain-0/004) — requires `eval`-based DOM manipulation
- Page metadata preservation — requires separate vault fixture
- Text spitter — was deprecated in the old suite

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  Bun Test Runner                                                     │
│    bun test --env-file=.env.cli-e2e tests/cli-e2e/ --timeout 60000  │
├──────────────────────────────────────────────────────────────────────┤
│  Test Suite (librarian.test.ts)                                      │
│    beforeAll → setupTestVault()                                      │
│    it() blocks: mutation → waitForIdle → assertions                  │
├──────────────────────────────────────────────────────────────────────┤
│  Chain Files (per-step decomposition)                                │
│    ├─ mutations.ts         → vault ops (create, rename, delete)      │
│    ├─ assertions.ts        → expectPostHealing()                     │
│    └─ vault-expectations.ts → expected codexes, files, content       │
├──────────────────────────────────────────────────────────────────────┤
│  Utils Layer (tests/cli-e2e/utils/)                                  │
│    ├─ cli.ts       → obsidian() + obsidianEval() CLI wrappers       │
│    ├─ vault-ops.ts → file CRUD via CLI + eval                        │
│    ├─ idle.ts      → waitForIdle() + reloadPlugin()                  │
│    ├─ assertions.ts → polling assertions, content checks             │
│    ├─ types.ts     → CliResult, PostHealingExpectations              │
│    └─ index.ts     → re-exports                                      │
├──────────────────────────────────────────────────────────────────────┤
│  Setup (tests/cli-e2e/setup.ts)                                      │
│    deployBuildArtifacts → ensureVaultOpen → reloadPlugin             │
│    → clean Library/Outside → create fixtures → reload → waitForIdle  │
├──────────────────────────────────────────────────────────────────────┤
│  Plugin-Side (src/)                                                   │
│    ├─ utils/idle-tracker.ts  → pendingCount + whenIdle()             │
│    └─ main.ts                → plugin.whenIdle() hook                │
└──────────────────────────────────────────────────────────────────────┘
```

### How it works

1. **Bun test** spawns as a normal test process (no Electron, no WDIO)
2. **CLI wrapper** (`cli.ts`) invokes Obsidian's CLI binary via `Bun.spawn` to run commands in the running Obsidian instance
3. **Vault ops** use either CLI commands (for files) or `eval` (for folders and complex operations)
4. **Synchronization** via `waitForIdle()` — calls `plugin.whenIdle()` inside Obsidian via `eval`
5. **Assertions** poll the vault state until expectations are met or timeout

---

## 3. CLI Interface

### 3.1 `obsidian(command)` — Shell-Based CLI

Runs a CLI command via `sh -c` for commands that don't contain special characters:

```typescript
obsidian('create name="Library/Foo.md" content="" silent')
obsidian('files folder="Library" ext=md')
obsidian('read path="Library/Foo.md"')
obsidian('plugin:reload id=cbcr-text-eater-de')
```

### 3.2 `obsidianEval(code)` — Direct Spawn (No Shell)

Runs JavaScript code inside Obsidian via `eval`. Uses `Bun.spawn` with array args (no shell) to avoid zsh special character mangling:

```typescript
obsidianEval(`(async()=>{
  await app.vault.createFolder('Library/New');
  return 'ok'
})()`)
```

**Why two modes**: `sh -c` is convenient for simple CLI commands, but zsh mangles `!`, `$`, and other special characters inside double quotes. `eval` code goes through `Bun.spawn` array args to bypass the shell entirely.

---

## 4. Key Gotchas

### 4.1 Obsidian CLI Always Returns Exit 0

The CLI returns exit code 0 for **all** outcomes — success, "file not found", eval errors. Error detection must parse stdout:

```typescript
// eval errors are prefixed with "Error:"
if (meaningful.startsWith("Error:")) {
    throw new Error(`eval failed: ${meaningful}`);
}
```

### 4.2 macOS `sh -c` Mangles Special Characters

Bash/zsh inside `sh -c "..."` expands `!` (history expansion) and `$` (variable expansion). Example:

```bash
# ❌ This breaks: ! gets expanded by zsh
sh -c '/path/to/Obsidian vault=X eval code="if(!x){...}"'

# ✅ obsidianEval uses Bun.spawn array args — no shell involved
Bun.spawn([OBSIDIAN_BIN, 'vault=X', 'eval', 'code=if(!x){...}'])
```

### 4.3 CLI `create`/`move`/`delete` Only Work for Files

CLI file commands don't handle folders. Folder operations must use `eval`:

```typescript
// Create folder
obsidianEval("app.vault.createFolder('Library/New')")

// Delete folder
obsidianEval("const f=app.vault.getAbstractFileByPath('Library/Old'); app.vault.trash(f,true)")

// Rename folder (uses fileManager for proper event emission)
obsidianEval("const f=app.vault.getAbstractFileByPath('Library/Old'); app.fileManager.renameFile(f,'Library/New')")
```

### 4.4 `file path=X` Returns Exit 0 on "Not Found"

Can't use CLI `file` command to check existence. Use eval instead:

```typescript
const result = await obsidianEval(
    `app.vault.getAbstractFileByPath('${path}') ? 'yes' : 'no'`
);
return result === "yes";
```

---

## 5. Synchronization

### 5.1 Plugin-Side: Idle Tracker

`src/utils/idle-tracker.ts` tracks in-flight async work via a `pendingCount` counter. `whenIdle()` waits for the counter to reach 0, then applies a 1000ms grace period to catch cascading work (healing → more events → more healing).

### 5.2 Test-Side: `waitForIdle()`

Calls `plugin.whenIdle()` inside Obsidian via `eval`:

```typescript
export async function waitForIdle(timeoutMs = 15_000): Promise<void> {
    const code = `(async()=>{await app.plugins.plugins['${PLUGIN_ID}'].whenIdle();return 'idle'})()`;
    await obsidianEval(code, timeoutMs);
}
```

### 5.3 Combined Flow

```
Test mutation (createFile, renamePath, deletePath)
    ↓
waitForIdle()
    ├─ eval → plugin.whenIdle()
    │   ├─ idle-tracker: wait for pendingCount === 0
    │   ├─ 1000ms grace period (resets on new work)
    │   └─ waitForObsidianEvents() drain
    ↓
Assertion phase (poll-based)
    ├─ expectFilesToExist(paths)
    ├─ expectFilesToBeGone(paths)
    ├─ expectExactCodexes(expected)
    └─ content checks (substring match)
```

---

## 6. Assertion Framework

### 6.1 Polling Engine

All assertions use `pollUntilPass()` — retries the assertion function every 300ms until it passes or 15s timeout:

```typescript
async function pollUntilPass(fn: () => Promise<void>, timeoutMs = 15_000)
```

### 6.2 PostHealingExpectations

The primary assertion type for healing tests:

```typescript
type PostHealingExpectations = {
    codexes: readonly string[];           // __-*.md files that must exist
    files: readonly string[];             // all expected file paths
    goneFiles?: readonly string[];        // files that must NOT exist
    contentChecks?: readonly [path, lines][]; // each file must contain these lines
    contentMustNotContain?: readonly [path, forbidden][]; // negative checks
};
```

`expectPostHealing(expectations)` runs checks in order: existence → gone → content → negative content.

### 6.3 Orphan Codex Detection

`expectExactCodexes(expected)` lists all `__-*.md` files under `Library/` and fails if any unexpected ones exist.

---

## 7. Test Vault Setup

### 7.1 Environment Variables

Set in `.env.cli-e2e` (gitignored):

| Variable | Purpose | Example |
|----------|---------|---------|
| `CLI_E2E_VAULT` | Obsidian vault name (for CLI commands) | `cli-e2e-test` |
| `CLI_E2E_VAULT_PATH` | Absolute path to vault folder on disk | `/Users/me/vaults/cli-e2e-test` |
| `OBSIDIAN_CLI_PATH` | Path to Obsidian binary (optional) | `/Applications/Obsidian.app/Contents/MacOS/Obsidian` |

### 7.2 One-Time Setup

1. Create a vault in Obsidian (e.g., `cli-e2e-test`)
2. Install the plugin in that vault (create `.obsidian/plugins/cbcr-text-eater-de/` with `manifest.json`)
3. Enable the plugin in Obsidian settings
4. Create `.env.cli-e2e` with the vault name and path

### 7.3 Per-Run Setup (`setupTestVault()`)

Runs in `beforeAll`:

```
1. Deploy build artifacts (main.js, manifest.json) → vault's plugin dir
2. Ensure vault is open (try CLI health check; if fail, open via obsidian:// URI)
3. Reload plugin to pick up new code
4. Delete Library/ and Outside/ (clean slate)
5. Create fixture files (7 files matching librarian-chain-0 structure)
6. Reload plugin again (discovers new vault from scratch)
7. Wait for initial healing to complete
```

The fixture vault structure:
```
Library/
  Recipe/
    Pie/
      Ingredients.md
      Steps.md
      Result_picture.jpg
    Soup/
      Pho_Bo/
        Ingredients.md
        Steps.md
        Result_picture.jpg
Outside/
  Avatar-S1-E1.md
```

---

## 8. Test Organization

### 8.1 Mutation Chain Pattern

Tests run as sequential state mutations on one vault. State carries forward — each test's mutation becomes the baseline for the next test's assertions.

```
beforeAll → setupTestVault() (clean + fixtures + init healing)
    ↓
it("assert 000")   → validate init healing state
it("mutation 001") → createFiles() + waitForIdle()
it("assert 001")   → validate cumulative state after 001
it("mutation 002") → renamePath() + waitForIdle()
it("assert 002")   → validate cumulative state after 000+001+002
    ...
```

### 8.2 Chain File Structure

Each step is a directory with 3 files:

```
chains/0-chain/001-create-more-files/
├── index.ts              → re-exports { performMutation001, testPostHealing001 }
├── mutations.ts          → async function performing vault operations
└── vault-expectations.ts → static data: expected codexes, files, content checks
```

Assertions live inline or import from vault-expectations. Each step's expectations import from the previous step and append new files/remove deleted ones:

```typescript
import { EXPECTED_FILES_AFTER_000 } from "../000-init/vault-expectations";
const EXPECTED_FILES_AFTER_001 = [...EXPECTED_FILES_AFTER_000, ...NEW_FILES];
```

### 8.3 Current Chain Steps

| Step | Chain | Mutation | Validates |
|------|-------|----------|-----------|
| 000 | 0 | None (init) | Codex files created, files renamed to canonical suffixes |
| 001 | 0 | Create 8 files | New codexes, suffix-implied files moved correctly |
| 002 | 0 | Rename 2 folders | Suffix healing cascades to all descendants |
| 003 | 0 | Create + rename file | Codex reflects final name |
| 004 | 1 | Delete single file | Codex no longer references deleted file |
| 005 | 1 | Delete folder | Folder's codex + descendants gone, parent codex updated |
| 006 | 1 | Create + rename ×3 | Codex shows final corename, no intermediate traces |
| 007 | 1 | Create file without suffix | File renamed with suffix, go-back link added |

---

## 9. How to Add a New Chain Step

1. Create a new directory under the appropriate chain:
   ```
   tests/cli-e2e/librarian/chains/1-chain/008-my-new-test/
   ```

2. Create `vault-expectations.ts` — import previous step's expectations, add/remove:
   ```typescript
   import { EXPECTED_FILES_AFTER_007, EXPECTED_CODEXES_AFTER_007 } from "../007-.../vault-expectations";

   export const EXPECTED_FILES_AFTER_008 = [...EXPECTED_FILES_AFTER_007, "Library/New/File-New.md"];
   export const EXPECTED_CODEXES_AFTER_008 = [...EXPECTED_CODEXES_AFTER_007, "Library/New/__-New.md"];

   export const VAULT_EXPECTATIONS_008: PostHealingExpectations = {
       codexes: EXPECTED_CODEXES_AFTER_008,
       files: EXPECTED_FILES_AFTER_008,
       contentChecks: [["Library/New/__-New.md", ["[[File-New|File]]"]]],
   };
   ```

3. Create `mutations.ts`:
   ```typescript
   import { createFile } from "../../../utils";
   export async function performMutation008(): Promise<void> {
       await createFile("Library/New/File.md", "# Content");
   }
   ```

4. Create `index.ts`:
   ```typescript
   export { performMutation008 } from "./mutations";
   export { VAULT_EXPECTATIONS_008 } from "./vault-expectations";
   import { expectPostHealing } from "../../../utils";
   import { VAULT_EXPECTATIONS_008 } from "./vault-expectations";
   export async function testPostHealing008(): Promise<void> {
       await expectPostHealing(VAULT_EXPECTATIONS_008);
   }
   ```

5. Add to `librarian.test.ts`:
   ```typescript
   import { performMutation008, testPostHealing008 } from "./chains/1-chain/008-my-new-test";

   it("mutation description for 008", async () => {
       await performMutation008();
       await waitForIdle();
   });
   it("assertion description for 008", testPostHealing008);
   ```

---

## 10. Running Tests

```bash
# Run CLI E2E suite (builds first)
bun run test:cli-e2e

# Run with verbose output
bun test --env-file=.env.cli-e2e tests/cli-e2e/ --timeout 60000

# Run just unit tests (no E2E)
bun run test:unit
```

**Prerequisites**: Obsidian must be running with the test vault open. The test suite will attempt to open the vault via URI scheme if it's not already open, but Obsidian itself must be running.

---

## 11. Key File Index

| File | Purpose |
|------|---------|
| **Setup** | |
| `tests/cli-e2e/setup.ts` | Vault setup: deploy artifacts, clean, create fixtures, reload |
| `.env.cli-e2e` | Env vars: vault name, vault path (gitignored) |
| **Utils** | |
| `tests/cli-e2e/utils/cli.ts` | `obsidian()` + `obsidianEval()` CLI wrappers |
| `tests/cli-e2e/utils/vault-ops.ts` | File CRUD: create, read, rename, delete, list, exists |
| `tests/cli-e2e/utils/idle.ts` | `waitForIdle()` + `reloadPlugin()` |
| `tests/cli-e2e/utils/assertions.ts` | Polling assertions: existence, content, orphan codex |
| `tests/cli-e2e/utils/types.ts` | `CliResult`, `PostHealingExpectations` |
| `tests/cli-e2e/utils/index.ts` | Re-exports |
| **Test Suite** | |
| `tests/cli-e2e/librarian/librarian.test.ts` | Main test suite (16 tests) |
| `tests/cli-e2e/librarian/chains/0-chain/` | Steps 000–003: init, create, rename, create+rename |
| `tests/cli-e2e/librarian/chains/1-chain/` | Steps 004–007: delete, folder delete, corename, basename |
| **Plugin-Side** | |
| `src/utils/idle-tracker.ts` | `pendingCount` + `whenIdle()` + grace period |
