# E2E Testing — Architecture

> **Scope**: This document covers the end-to-end testing infrastructure for the Textfresser plugin, including the WDIO-based test harness, synchronization primitives, assertion framework, and test suite organization. For the file system abstraction layer, see `vam-architecture.md`. For vocabulary/dictionary commands, see `textfresser-architecture.md`.

---

## 1. Purpose

The E2E test suite validates the Textfresser plugin **running inside real Obsidian instances**. It exercises the full stack: DOM events → plugin code → Obsidian Vault API → file system → event pipeline → healing/codex generation. The suite solves three core problems:

1. **Deterministic synchronization** — the plugin's async pipeline (action queue → dispatch → Obsidian events → bulk accumulation → healing) completes non-deterministically. The idle tracker + polling engine provide reliable "wait until done" primitives.
2. **Rich failure diagnostics** — when assertions fail, the framework collects folder chain checks, vault samples, plugin internal state (tree, healer, VAM debug), and writes structured log files — keeping console output minimal.
3. **Mutation chain testing** — tests run as sequential state mutations on a shared vault, validating incremental healing at each step without per-test vault resets.

**Test targets**: Librarian (healing, codex generation, status propagation), Bookkeeper/Text Spitter (scroll-to-section conversion), Page metadata preservation.

---

## 2. Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  WDIO Layer                                                                    │
│    wdio.conf.mts · wdio-obsidian-service · obsidian-launcher                  │
│    tldr-reporter.cjs · noise filter · worker lifecycle hooks                  │
├────────────────────────────────────────────────────────────────────────────────┤
│  Test Spec Files (*.e2e.ts)                                                    │
│    ├─ librarian-suit.e2e.ts        → 0-chain + 1-chain mutation tests         │
│    ├─ page-metadata.e2e.ts         → 2-chain page navigation bug tests        │
│    └─ text-spitter.e2e.ts          → 2-chain scroll-to-section tests          │
├────────────────────────────────────────────────────────────────────────────────┤
│  Chain Files (per-test decomposition)                                          │
│    ├─ index.ts                     → re-exports mutation + assertion           │
│    ├─ mutation.ts                  → vault ops (create, rename, delete, click) │
│    ├─ assertions.ts                → createTestContext + expectPostHealing     │
│    └─ vault-expectations.ts        → expected codexes, files, content checks   │
├────────────────────────────────────────────────────────────────────────────────┤
│  Public API (support/api/)                                                     │
│    ├─ vault-ops.ts                 → file CRUD via browser.executeObsidian()  │
│    ├─ files.ts                     → polling assertions, content validation    │
│    ├─ idle.ts                      → plugin init + idle waiting               │
│    ├─ debug.ts                     → plugin state snapshot for diagnostics    │
│    └─ index.ts                     → exports + createTestContext() factory     │
├────────────────────────────────────────────────────────────────────────────────┤
│  Internal Infrastructure (support/internal/)                                   │
│    ├─ poll.ts                      → generic polling engine                    │
│    ├─ obsidian.ts                  → low-level executeObsidian wrappers       │
│    ├─ types.ts                     → PollOptions, PollResult, FileWaitStatus  │
│    ├─ errors.ts                    → E2ETestError hierarchy                   │
│    └─ format.ts                    → two-tier error message formatting        │
├────────────────────────────────────────────────────────────────────────────────┤
│  Plugin-Side (src/)                                                            │
│    ├─ utils/idle-tracker.ts        → pendingCount + whenIdle() + grace period │
│    └─ main.ts                      → plugin.whenIdle() hook                   │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The Synchronization Problem

The plugin's async pipeline has multiple time-variable stages:

```
Mutation (create/rename/delete)
    ↓
Obsidian emits vault events (timing: ~0-50ms)
    ↓
BulkEventAccumulator buffers (quiet: 250ms, max: 2000ms)
    ↓
Processing chain (collapse + reduce roots)
    ↓
Librarian.onBulkEvent → buildTreeActions → Healer → dispatch healing actions
    ↓
ActionQueue → Dispatcher pipeline → execute → Obsidian API
    ↓
Obsidian emits events for healing changes → filtered by SelfEventTracker
    ↓
Vault reaches steady state
```

Fixed delays (`setTimeout(5000)`) are fragile — too short on slow CI, too long on fast machines. The E2E framework uses two complementary mechanisms instead.

### 3.1 Idle Tracker (Plugin-Side)

**Source**: `src/utils/idle-tracker.ts`

A module-level counter tracking in-flight async work:

```typescript
let pendingCount = 0;
```

**E2E-only activation**: `isE2E()` checks `process.env.E2E === "1"` or `window.__E2E_MODE === true`. In production, `incrementPending()` / `decrementPending()` are no-ops.

**`whenIdle(waitForObsidian?)` algorithm**:

```
1. While pendingCount > 0: poll every 100ms
2. Start grace period (1000ms):
     Poll every 100ms
     If pendingCount > 0: wait for it to reach 0, restart grace period
     If grace period elapses with count at 0: break
3. If waitForObsidian callback provided: call it
```

The 1000ms grace period catches cascading work — healing may dispatch more actions that trigger more events, which trigger more healing. The grace period resets each time new work appears.

**Integration**: The plugin exposes `whenIdle()` on its instance, wired through `idle-tracker.whenIdle(() => this.vam.waitForObsidianEvents())`. Tests call this via `browser.executeObsidian`.

### 3.2 Polling Engine (Test-Side)

**Source**: `support/internal/poll.ts`

Generic polling function for waiting on eventual conditions:

```typescript
async function poll<T>(
  fn: () => Promise<T>,
  predicate: (v: T) => boolean,
  opts: PollOptions = {},
): Promise<PollResult<T>>
```

**Termination conditions**: `Date.now() - start < timeoutMs && attempts < maxAttempts`.

**Defaults** (from `config.ts`):

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `timeoutMs` | 15,000ms | Max wall-clock wait |
| `intervalMs` | 200ms | Sleep between polls |
| `maxAttempts` | 10 | Max poll iterations |

**`PollResult<T>`** always returns metadata: `{ ok, value, attempts, waitedMs, timeoutMs, intervalMs, label }`. This feeds into error formatting — failure messages include "waited 3200ms over 16 attempts" for debugging.

**Offset system**: `PollOptions` supports `timeoutOffset` / `intervalOffset` for per-action tuning without overriding the base defaults. Currently all offsets are 0.

### 3.3 Combined Flow

```
Test mutation (createFile, renamePath, etc.)
    ↓
waitForIdle()
    ├─ waitForPluginInitialized() — polls plugin.initialized every 100ms, 10s timeout
    └─ obsidianWhenIdle() — calls plugin.whenIdle() inside Obsidian
         ├─ idle-tracker waits for pendingCount === 0 + 1000ms grace
         └─ waitForObsidianEvents() — waits for SelfEventTracker to drain
    ↓
Assertion phase (poll-based)
    ├─ expectFilesToExist() — polls obsidianFileExists() per path
    ├─ expectFilesToBeGone() — polls until file disappears
    ├─ expectExactCodexes() — lists __-*.md files, checks for orphans
    └─ expectPostHealingFiles() — combines all above + content validation
```

---

## 4. Vault Operations API

**Source**: `support/api/vault-ops.ts`

All operations execute inside Obsidian's process via `browser.executeObsidian()`, which serializes a callback + arguments to the Electron main process. Return values must be JSON-serializable.

### 4.1 File/Folder CRUD

| Function | Behavior |
|----------|----------|
| `createFile(path, content)` | Validates path, creates parent folders iteratively, calls `app.vault.create()` |
| `createFiles(files[])` | Collects unique parent folders → creates serially (race fix) → creates files in parallel |
| `renamePath(old, new)` | `app.vault.rename(abstractFile, newPath)`. Returns error if source not found |
| `deletePath(path)` | `app.vault.trash(abstractFile, true)`. No-op if not found |
| `createFolder(path)` | Idempotent: returns ok if folder already exists |
| `openFile(path)` | Gets workspace leaf, calls `leaf.openFile(tfile)` |
| `readFile(path)` | `app.vault.read(tfile)`. Checks `"extension" in file` to reject folders |
| `modifyFile(path, content)` | `app.vault.modify(tfile, content)` |
| `listAllFiles()` | `app.vault.getFiles().map(f => f.path)` |
| `listFilesUnder(prefix)` | Filters `getFiles()` by path prefix |

**Path validation**: `validatePath()` rejects empty paths, normalizes leading `/`, blocks `../` segments.

**Result types**: All functions return `Result<T, string>` from neverthrow. Errors are caught and wrapped — no uncaught exceptions escape to the test runner.

### 4.2 Checkbox Click

`clickCodexCheckbox(codexPath, linkTarget, displayName?)` simulates a user clicking a status checkbox in a codex file. This is the most complex vault operation:

```
1. Close any existing view of the codex file (force fresh DOM render)
2. Pause 100ms
3. Open codex file fresh via openFile()
4. Pause 500ms (rendering time)
5. Verify active file matches codexPath
6. Search for checkbox using 3 strategies:
     S1: Internal link with data-href matching target (reading mode)
     S2: Raw text containing [[target| or [[target]] (edit mode)
     S3: Display name match in rendered text (reading mode with aliases)
7. Dispatch MouseEvent("mousedown", { bubbles: true, button: 0 })
```

**Display name extraction**: `extractDisplayName("Steps-Berry-Pie-Recipe")` → `"Steps"`. For codex links: `extractDisplayName("__-Berry-Pie-Recipe")` → `"Berry"`.

**Debug output**: On failure, returns all checkbox line contents + their internal links for diagnostics.

### 4.3 Other Operations

| Function | Behavior |
|----------|----------|
| `clickButton(actionId)` | `document.querySelector('[data-action="${id}"]').click()` |

---

## 5. Assertion Framework

**Source**: `support/api/files.ts`

### 5.1 Wait Primitives

Low-level building blocks, return boolean:

```typescript
waitForFile(path, opts?)     → polls obsidianFileExists() until true
waitForFileGone(path, opts?) → polls obsidianFileExists() until false
waitForFiles(paths, opts?)   → parallel waitForFile per path
```

### 5.2 Expect Functions

High-level assertions that throw on failure:

```typescript
expectFilesToExist(paths, opts?)    → throws E2ETestError with 2-tier message
expectFilesToBeGone(paths, opts?)   → throws E2ETestError
```

On failure, each missing file collects `FileWaitStatus`:
- `waitedMs`, `attempts` — polling metrics
- `finalObsidianSeesFile` — one last check after timeout
- `folderChainCheck` — which parent folder is missing, or tree of parent contents
- `vaultSample` — first N files in vault (opt-in via `includeVaultSample`)

### 5.3 PostHealingExpectations

The primary assertion for healing tests:

```typescript
type PostHealingExpectations = {
  codexes: readonly string[];                                          // __-*.md files
  files: readonly string[];                                            // all expected files
  goneFiles?: readonly string[];                                       // files that must NOT exist
  contentChecks?: readonly [path: string, expectedLines: string[]][];  // substring match
  contentMustNotContain?: readonly [path: string, forbidden: string[]][]; // negative checks
};
```

`expectPostHealingFiles(expectations, opts)` runs in order:
1. `expectFilesToExist([...codexes, ...files])` — all files present
2. `expectFilesToBeGone(goneFiles)` — deleted files absent
3. Content validation: for each `[path, lines]`, reads file, checks `actualContent.includes(line)` for each line
4. Negative content validation: for each `[path, forbidden]`, ensures none of the forbidden strings appear

### 5.4 Orphan Codex Detection

`expectExactCodexes(expectedCodexes, opts)` lists all `__-*.md` files under `Library/` and fails if any exist that aren't in the expected list. This catches codex files that should have been cleaned up after folder deletion.

### 5.5 Test Context Factory

```typescript
const t = createTestContext("testPostHealing001");
await t.expectPostHealing(expectations, opts);
```

`createTestContext(testName)` returns an object with bound `callerContext: "[testName]"` — all error messages include the test name for log correlation.

---

## 6. Error Architecture

### 6.1 Two-Tier Messages

Every assertion failure produces two messages:

| Tier | Purpose | Destination |
|------|---------|-------------|
| **Short** (`message`) | 1-2 lines, file names only | Console output via TL;DR reporter |
| **Long** (`details`) | Full diagnostics with timing, folder chain, vault sample | Log file via `afterTest` WDIO hook |

Example short: `[testPostHealing001] Missing 2 files: Library/Recipe/Pie/Steps-Pie-Recipe.md, ...`

Example long:
```
Caller: [testPostHealing001]
Polling: timeout=15000ms, interval=200ms

- Missing: Library/Recipe/Pie/Steps-Pie-Recipe.md
  waited: 15000ms, attempts: 10
  final check: getAbstractFileByPath => false
  file Steps-Pie-Recipe.md not found among:
  Library/Recipe/Pie/
  ├── Ingredients-Pie-Recipe.md
  ├── Result_picture-Pie-Recipe.jpg
  └── __-Pie-Recipe.md
```

### 6.2 Error Classes

**Source**: `support/internal/errors.ts`

```
E2ETestError(message, details?)          ← base: .details field for long diagnostics
  ├─ FilesExpectationError(msg, missing[])  ← .missing: FileWaitStatus[]
  └─ FilesNotGoneError(msg, notGone[])      ← .notGone: per-file wait status[]
```

### 6.3 Stack Trace Trimming

`finalizeE2EError(err)` strips stack traces unless `E2E_DEBUG=1`. Since WDIO prints stacks by default (noisy), trimming keeps console clean. Set `E2E_DEBUG=1` to see full stacks.

---

## 7. Obsidian Integration Layer

**Source**: `support/internal/obsidian.ts`

Low-level wrappers around `browser.executeObsidian()`:

| Function | Purpose |
|----------|---------|
| `obsidianFileExists(path)` | `!!app.vault.getAbstractFileByPath(p)` |
| `obsidianVaultSample(limit)` | `app.vault.getFiles()` → first N paths (for error diagnostics) |
| `obsidianWaitForPluginInitialized(id, timeout)` | Polls `plugin.initialized === true` every 100ms |
| `obsidianWhenIdle(id)` | Calls `plugin.whenIdle()` — resolves when plugin is idle |
| `obsidianCheckFolderChainAndListParent(filePath)` | Walks folder chain, finds missing segment, builds tree of parent contents |

**Undocumented Obsidian APIs used** (marked with `@ts-ignore`):
- `app.plugins.plugins[id]` — plugin registry (not typed)
- `plugin.initialized` — custom init flag
- `plugin.whenIdle()` — custom E2E hook
- `TFolder.children` — folder listing (exists at runtime)
- `app.vault.getFiles()` — returns `TFile[]` (not fully typed)

**Folder chain check**: On failure, builds ASCII tree of the parent folder's contents using `├──`/`└──` connectors — shows what files ARE there when the expected one is missing.

---

## 8. Debug State Gathering

**Source**: `support/api/debug.ts`

`gatherPluginDebugInfo(options)` captures a comprehensive snapshot of plugin internal state. Used for post-mortem analysis of test failures.

**Gathered state**:

| Field | Source |
|-------|--------|
| `vaultFolders` | `app.vault.getAllLoadedFiles()`, optionally filtered by prefix |
| `fullTree` | Custom `serializeNode()` walks tree: kind, nodeName, status, extension, children |
| `selfTracker` | `vam._getDebugSelfTrackerState()` — tracked paths and prefixes |
| `lastBulkEvent` | `librarian._debugLastBulkEvent` — serialized events and roots |
| `lastTreeActions` | Action type, target locator, new node name |
| `lastHealingActions` | Kind + payload |
| `lastVaultActions` | Kind + payload |
| `executionTrace` | `vam.getDebugState().executionTrace` — per-action ok/err |
| `allBatches` | Sorted actions per dispatcher batch |
| `dispatcherErrors` | Errors from latest batch |
| `rawRenameEvents` / `rawCreateEvents` | Filtered from `vam._getDebugAllRawEvents()` |

**Timing**: Default 3s delay before gathering (`delayMs`) to let healing complete. Configurable.

**Output**: Optionally writes JSON to `logPath` for offline analysis.

---

## 9. WDIO Configuration

**Source**: `wdio.conf.mts`

### 9.1 Core Settings

| Setting | Value | Notes |
|---------|-------|-------|
| Framework | Mocha (BDD) | `timeout: 60000` per test |
| Specs | `./tests/obsidian-e2e/**/*.e2e.ts` | All .e2e.ts files |
| Max instances | 8 | Env: `WDIO_MAX_INSTANCES` |
| Log level | `silent` | Noise handled by custom filter |
| Wait timeout | 5000ms | Browser wait operations |
| Wait interval | 250ms | Browser poll interval |
| Runner | `local` | Electron-based |
| Service | `obsidian` | `wdio-obsidian-service` |

### 9.2 Capabilities

**Desktop**: `{ browserName: "obsidian", "wdio:obsidianOptions": { appVersion, installerVersion, plugins: ["."], vault: "tests/simple" } }`

Obsidian versions resolved via `parseObsidianVersions("latest/latest")` — always tests against latest stable.

**Mobile** (opt-in): Adds Chrome mobile emulation at 390×844px. Enabled via `WDIO_MOBILE=1` or `CI=1`.

### 9.3 Noise Filtering

`installStdIoNoiseFilter()` patches `process.stdout.write` / `process.stderr.write` at module load time:

**Denied patterns**: Worker prefixes (`[0-1] ...`), error class names (`E2ETestError:`, `FilesExpectationError:`), stack frames (`at ...`), reporter headers, build noise, blank lines.

**Buffer**: Denied lines collected in memory, flushed to `wdio-noise-launcher.log` on process exit.

**Error block tracking**: Stateful — tracks whether we're inside an error block to add proper spacing after error blocks end.

### 9.4 Reporter

**Source**: `support/reporters/tldr-reporter.cjs`

Extends `@wdio/reporter`. Prints only:

```
Librarian Full Suit
  ✓ creates all codex files on init
  ✓ all files are healed to canonical suffixes on init
  ✖ codex should reflect renamed file
   Logs: file:///tests/tracing/logs/fail_codex_should_reflect_renamed_file.log
```

No error blocks, no stack traces. Green `✓` / red `✖` via ANSI codes. Written in CJS for WDIO compatibility.

### 9.5 Lifecycle Hooks

| Hook | Output |
|------|--------|
| `afterTest` | On failure: writes `fail_<safeName>.log` with DETAILS + MESSAGE + STACK |
| `onWorkerStart` | `worker-start_<cid>.json` — capabilities, specs |
| `onWorkerEnd` | `worker-end_<cid>.json` — exit code, retries |
| `onComplete` | `run-summary.json` — exit code, results |

All logs written to `tests/tracing/logs/`.

---

## 10. Test Runner Script

**Source**: `scripts/run-e2e.sh`

Isolates test settings from developer's local plugin configuration:

```
1. Backup data.json → data.json.e2e-bak (if exists)
2. Remove data.json (tests use default plugin settings)
3. bun run build && bun x wdio run ./wdio.conf.mts
4. trap EXIT → restore data.json from backup
```

**Why**: Plugin settings (e.g., custom library root, API keys) can alter behavior. Tests must run with reproducible defaults.

---

## 11. Test Suite Organization

### 11.1 Mutation Chain Pattern

Tests run as **sequential state mutations** on one Obsidian vault. State carries forward — each test's mutation becomes the baseline for the next test's assertions. No vault reset between `it()` blocks.

```
before()
    ↓ obsidianPage.resetVault(path) × 2 + waitForIdle()
    ↓
it("mutation-001")  →  performMutation001() + waitForIdle()
it("assert-001")    →  testPostHealing001()   [validates 001 state]
it("mutation-002")  →  performMutation002() + waitForIdle()
it("assert-002")    →  testPostHealing002()   [validates 001+002 cumulative state]
    ...
```

**Double vault reset**: The `before()` hook calls `obsidianPage.resetVault()` twice. The first reset loads the plugin (triggering init healing). The second reset reverts to a clean baseline after healing completes.

### 11.2 Chain File Decomposition

Each test step is a directory with 4 files:

```
chains/0-chain/001-create-more-files/
├── index.ts              → re-exports: { performMutation001, testPostHealing001 }
├── mutation.ts           → async function performing vault operations
├── assertions.ts         → async function running expectPostHealing()
└── vault-expectations.ts → static data: expected codexes, files, content checks
```

Optional 5th file: `vault-structure-expectations.md` — human-readable specification (not used by tests, serves as documentation).

### 11.3 Vault Expectations Inheritance

Each step's `vault-expectations.ts` imports from the previous step and appends:

```typescript
// 001 imports from 000
import { EXPECTED_CODEXES_AFTER_000, EXPECTED_FILES_AFTER_000 } from "../000-init/vault-expectations";

const EXPECTED_CODEXES_AFTER_001 = [...EXPECTED_CODEXES_AFTER_000, ...NEW_CODEXES];
const EXPECTED_FILES_AFTER_001   = [...EXPECTED_FILES_AFTER_000, ...NEW_FILES];

export const VAULT_EXPECTATIONS_001 = {
    initial:     { codexes: EXPECTED_CODEXES_AFTER_000, files: EXPECTED_FILES_AFTER_000 },
    postHealing: { codexes: EXPECTED_CODEXES_AFTER_001, files: EXPECTED_FILES_AFTER_001 },
};
```

This forms a chain where each step builds on the previous — adding files, removing `goneFiles`, adding content checks.

### 11.4 Chain Organization

Tests are grouped into chains that share a vault:

| Chain | Vault | Tests | Focus |
|-------|-------|-------|-------|
| **0-chain** | `librarian-chain-0` | 000–004 | Init healing, file creation, rename, checkbox status |
| **1-chain** | `librarian-chain-0` (continued) | 004-delete–007 | File/folder deletion, corename rename, basename healing |
| **2-chain** (librarian) | `page-metadata-test` | 007 | Page navigation metadata preservation |
| **2-chain** (text-spitter) | `text-spitter` | setup + make-text | Scroll-to-section conversion |

0-chain and 1-chain are a single linear sequence within `librarian-suit.e2e.ts`. The 2-chain tests run in separate `.e2e.ts` files with their own vaults.

---

## 12. Test Suites

### 12.1 Librarian Full Suit (`librarian-suit.e2e.ts`)

**Vault**: `tests/obsidian-e2e/vaults/librarian-chain-0`

20 test cases covering the Librarian's core healing and codex management:

| Step | Mutation | Validates |
|------|----------|-----------|
| **000-init** | None (plugin init) | Codex files created, files renamed to canonical suffixes |
| **001-create-more-files** | Create 8 files (3 in new folder, 2 outside Library, 3 with suffix implying nested path) | New codexes created, suffix-implied files moved to correct folders |
| **002-rename-files** | Rename 2 folders | Suffix healing cascades to all descendants, codex content updated |
| **003-create-and-rename** | Create file then rename it | Codex reflects final name (not intermediate) |
| **004-s1** through **004-s4** | Click status checkboxes (4 scenarios) | Scroll status, section aggregation, cascading toggle/untoggle |
| **004-delete** | Delete single file | Codex no longer references deleted file |
| **005-delete-folder** | Delete folder | Folder's codex + all descendants gone, parent codex updated |
| **006-rename-corename** | Create file, rename 3 times (Untitled → Draft → Review → Final) | Codex shows final name, no traces of intermediate names |
| **007-basename-healing** | Create file without suffix | File renamed to include suffix, go-back link added (no duplicates) |

### 12.2 Page Metadata Preservation (`page-metadata.e2e.ts`)

**Vault**: `tests/obsidian-e2e/vaults/page-metadata-test`

6 test cases targeting two specific bugs:

- **Bug 1**: Page navigation indices (`prevPageIdx`/`nextPageIdx`) not healed on init
- **Bug 2**: Page metadata stripped when toggling status via codex checkbox

Validates that page files retain their navigation metadata (`prevPageIdx`, `nextPageIdx`, `noteKind`) both after init healing and after status toggle/untoggle.

### 12.3 Text Spitter (`text-spitter.e2e.ts`)

**Vault**: `tests/obsidian-e2e/vaults/text-spitter`

Tests the "Make this a text" flow (scroll → section with pages). Setup tests (enabled) validate scroll healing after move to Library. Button-clicking tests (4 tests) are **skipped** (`it.skip`) — marked as deprecated due to unreliable UI interaction. Recommended to use unit/spec tests instead.

---

## 13. Test Vault Fixtures

Located at `tests/obsidian-e2e/vaults/`:

| Vault | Structure | Used By |
|-------|-----------|---------|
| `librarian-chain-0/` | `Library/Recipe/{Pie,Soup/Pho_Bo}/` with files + `Outside/` | Librarian Full Suit |
| `page-metadata-test/` | `Library/Märchen/Aschenputtel/` with 3 page files | Page Metadata Preservation |
| `text-spitter/` | `Library/Märchen/` (empty) | Text Spitter |
| `simple/` | `Welcome.md` | Default vault (WDIO config fallback) |

Each vault includes `.obsidian/app.json` for Obsidian configuration.

---

## 14. Key Design Decisions

### Idle Tracker as Primary Sync

The idle tracker (`whenIdle()`) is the primary synchronization mechanism. Unlike polling assertions (which check final state), the idle tracker waits for the plugin's **internal work to complete**. This catches cascading healing — where healing actions trigger further events that trigger further healing. The 1000ms grace period ensures no late-arriving work is missed.

### Double Vault Reset

`before()` calls `resetVault()` twice. The first reset loads the test vault and triggers plugin initialization (codex creation, initial healing). The second reset reverts the vault to its clean state AFTER healing is done — so test assertions start from a known baseline. Without the double reset, the first test would see partially-healed state.

### Two-Tier Error Messages

Short messages go to console (via TL;DR reporter), long messages go to log files (via `afterTest` hook). This keeps CI output readable while preserving full diagnostics. The `E2ETestError.details` field bridges the two — the `afterTest` hook checks `err.details` and writes it to the log file.

### Mutation ↔ Assertion Separation

Each chain step separates the mutation (`performMutationNNN`) from the assertion (`testPostHealingNNN`). These run as **separate `it()` blocks** in Mocha. If the mutation fails, Mocha marks only the mutation test as failed — the assertion test is skipped (because Mocha stops after a failure within a describe block if `bail` is set, or marks subsequent tests as failed due to broken state). This gives more granular failure information.

### Expectations as Cumulative Chains

Each `vault-expectations.ts` imports and extends the previous step's expected state. This makes it explicit that tests are cumulative — step 005's expectations include everything from 000–004 minus deleted files. It also prevents copy-paste divergence: changing an expectation in step 000 automatically propagates to all subsequent steps.

### Result Types for Vault Ops

All vault operations return `Result<T, string>` instead of throwing. This is consistent with the plugin's codebase (neverthrow everywhere) and makes error handling explicit in test code. Mutations check `result.isErr()` and throw with context — keeping the actual error message from Obsidian.

### Content Checks as Substring Match

`contentChecks` uses `actualContent.includes(line)` — not regex, not exact equality. This is deliberately forgiving: tests care that a codex contains `[[Steps-Berry-Pie-Recipe|Steps]]` somewhere, not at a specific line number. Content ordering changes (e.g., children sorted differently) don't cause false failures.

---

## 15. Key File Index

| File | Purpose |
|------|---------|
| **Configuration** | |
| `wdio.conf.mts` | WDIO configuration: capabilities, reporters, hooks, noise filter |
| `scripts/run-e2e.sh` | E2E runner with data.json isolation |
| `tests/obsidian-e2e/support/config.ts` | Constants: PLUGIN_ID, timeouts, polling options |
| **Test Suites** | |
| `tests/obsidian-e2e/librarian/librarian-suit.e2e.ts` | Main librarian test suite (20 tests) |
| `tests/obsidian-e2e/librarian/page-metadata.e2e.ts` | Page metadata preservation tests (6 tests) |
| `tests/obsidian-e2e/text-spitter/text-spitter.e2e.ts` | Text spitter tests (4 enabled + 4 skipped) |
| **Chain Files** | |
| `tests/obsidian-e2e/librarian/chains/0-chain/` | Init, create, rename, checkbox tests |
| `tests/obsidian-e2e/librarian/chains/1-chain/` | Delete, corename rename, basename healing |
| `tests/obsidian-e2e/librarian/chains/2-chain/` | Page metadata preservation |
| `tests/obsidian-e2e/text-spitter/chains/2-chain/` | Text spitter chain |
| **Public API** | |
| `tests/obsidian-e2e/support/api/index.ts` | Exports + `createTestContext()` factory |
| `tests/obsidian-e2e/support/api/vault-ops.ts` | File CRUD, checkbox click, path validation |
| `tests/obsidian-e2e/support/api/files.ts` | Polling assertions, content validation, orphan detection |
| `tests/obsidian-e2e/support/api/idle.ts` | `waitForIdle()`, `waitForPluginInitialized()` |
| `tests/obsidian-e2e/support/api/debug.ts` | Plugin state snapshot for diagnostics |
| **Internal** | |
| `tests/obsidian-e2e/support/internal/poll.ts` | Generic polling engine |
| `tests/obsidian-e2e/support/internal/obsidian.ts` | `browser.executeObsidian()` wrappers |
| `tests/obsidian-e2e/support/internal/types.ts` | PollOptions, PollResult, FileWaitStatus |
| `tests/obsidian-e2e/support/internal/errors.ts` | E2ETestError, FilesExpectationError |
| `tests/obsidian-e2e/support/internal/format.ts` | Two-tier error message formatting |
| **Reporter** | |
| `tests/obsidian-e2e/support/reporters/tldr-reporter.cjs` | TL;DR console reporter |
| **Plugin-Side** | |
| `src/utils/idle-tracker.ts` | E2E idle tracking: pendingCount + grace period |
| **Compatibility (deprecated)** | |
| `tests/obsidian-e2e/helpers/polling.ts` | Re-exports from support/api (backward compat) |
| `tests/obsidian-e2e/helpers/assertions.ts` | Re-exports from support/api (backward compat) |
| **Vault Fixtures** | |
| `tests/obsidian-e2e/vaults/librarian-chain-0/` | Library/Recipe structure for librarian tests |
| `tests/obsidian-e2e/vaults/page-metadata-test/` | Library/Märchen with split pages |
| `tests/obsidian-e2e/vaults/text-spitter/` | Empty Library/Märchen for text spitter |
| `tests/obsidian-e2e/vaults/simple/` | Minimal vault (WDIO default) |

---

## 16. Running Tests

```bash
# Full suite (unit + e2e)
bun test

# E2E only (with data.json isolation)
bun run test:e2e

# E2E raw (no data.json isolation, no build)
bun run test:e2e:raw

# Desktop only (skip mobile emulation)
WDIO_MOBILE=0 bun run test:e2e

# Keep full stack traces on failure
E2E_DEBUG=1 bun run test:e2e

# Reduce parallelism
WDIO_MAX_INSTANCES=4 bun run test:e2e
```

**Logs**: `tests/tracing/logs/` — failure diagnostics, WDIO noise, worker metadata, run summary.

---

## 17. Issues & Concerns

### 17.1 Polling Engine: `maxAttempts` vs `timeoutMs` — Dual Termination

`poll()` terminates on **either** `maxAttempts` (default 10) **or** `timeoutMs` (default 15,000ms), whichever comes first. With the default interval of 200ms, 10 attempts × 200ms = 2,000ms — so `maxAttempts` will typically terminate the loop at ~2s, well before the 15s timeout. This means the effective timeout for most polling calls is **~2 seconds**, not 15 seconds. The 15s `timeoutMs` only kicks in if callers override `maxAttempts` to a higher value. This dual termination is potentially confusing and could cause flaky tests on slow machines where healing takes longer than 2 seconds.

### 17.2 Checkbox Click: Hardcoded Pauses

`clickCodexCheckbox()` uses `browser.pause(100)` after closing the file and `browser.pause(500)` after opening it. These are timing heuristics — too short on slow machines, wasted time on fast ones. A more robust approach would be to poll for the expected DOM state (e.g., wait for checkbox elements to appear), but the current approach works in practice since the total budget is 600ms.

### 17.3 No `waitForIdle()` Inside Assertion Phase

The pattern is: mutation → `waitForIdle()` → assertions. But content validation in `expectPostHealingFiles()` reads files directly via `readFile()` without a preceding `waitForIdle()`. If healing completes but Obsidian's file index lags (eventual consistency), content reads could see stale data. The `waitForObsidianEvents()` call inside `whenIdle()` partially addresses this, but there's no explicit file content polling — only existence polling.

### 17.4 `createFiles()` Serializes Folder Creation

`createFiles()` creates all parent folders serially (one `browser.executeObsidian` call per folder) before creating files in parallel. For a batch creating files in N folders, this is N serial round-trips to Obsidian. Each round-trip involves IPC between the WDIO process and the Electron main process. A single `executeObsidian()` call that creates all folders at once would be faster, but the current approach is simpler and race-condition-free.

### 17.5 `gatherPluginDebugInfo` Uses Hardcoded Plugin ID

The `browser.executeObsidian()` callback inside `gatherPluginDebugInfo()` hardcodes `"cbcr-text-eater-de"` (line 68 of `debug.ts`) instead of using the passed `pluginId` parameter. This works because the plugin ID is constant, but it's an inconsistency — the outer function accepts a configurable ID via options, but the inner callback ignores it.

### 17.6 Deprecated Compatibility Layer Still Present

`tests/obsidian-e2e/helpers/polling.ts` and `helpers/assertions.ts` are deprecated shims that re-export from `support/api`. They still exist for backward compatibility but add confusion — new test code might import from the wrong location. No tests currently import from these files (all use `support/api` directly), so they could be removed.

### 17.7 Text Spitter Button Tests Permanently Skipped

4 of 8 text spitter tests are `it.skip()` — marked as deprecated due to unreliable UI interaction. These tests validate the "Make this a text" button flow (the core feature of the text spitter). If this functionality has unit test coverage, the skipped tests are harmless dead code. If not, there's a coverage gap for the end-to-end button-click → page-split → codex-update flow.

### 17.8 `obsidianWaitForPluginInitialized` — Manual Polling Loop

`obsidianWaitForPluginInitialized()` implements its own polling loop (`while (Date.now() < timeout) { ... await setTimeout(100) }`) instead of using the existing `poll()` engine. This means it doesn't benefit from `PollResult` metadata (attempts, waitedMs) and has slightly different semantics (no `maxAttempts` limit). It could be refactored to use `poll()` for consistency.

### 17.9 No Guard Against Test Ordering Assumptions

The mutation chain pattern assumes tests run in declaration order and sequentially. Mocha's BDD mode runs `it()` blocks in order by default, so this works. However, there's no explicit Mocha configuration (`--sort`, `--parallel`) guard — if someone accidentally enables parallel execution within a spec file, the chain would break silently. The WDIO `maxInstances` parallelism is at the **file** level (each `.e2e.ts` gets its own Obsidian instance), not the test level, so this is safe in practice.

### 17.10 Noise Filter Patches Global `process.stdout.write`

`installStdIoNoiseFilter()` monkey-patches `process.stdout.write` and `process.stderr.write` at module load time. This is a side effect of importing `wdio.conf.mts` and affects all output from all WDIO workers in the launcher process. The filter's deny patterns are broad (e.g., `/^\s*$/` catches all blank lines, `/^\s+at\s/` catches any indented text starting with "at"). If a future change adds legitimate console output matching these patterns, it would be silently swallowed.

### 17.11 `extractDisplayName` Assumes Hyphen-Separated Naming

`extractDisplayName("Steps-Berry-Pie-Recipe")` → `"Steps"` by splitting on `-` and taking the first part. This assumes the first hyphen-separated segment is always the display name. For file names containing hyphens in the core name (e.g., `Pho-Bo-Soup-Recipe`), this would return `"Pho"` instead of `"Pho-Bo"`. The function is only called as a fallback when `displayName` is not explicitly provided, and the codex wikilink alias system usually handles display names correctly, so this is a latent edge case rather than an active bug.
