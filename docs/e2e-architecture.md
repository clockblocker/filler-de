# E2E Testing Architecture

## Purpose

Tests Librarian healing behavior in real Obsidian instances. Validates file operations → healing → vault state invariants.

## Pipeline

```
Test Suite
    ↓
before(): resetVault + waitForIdle
    ↓
mutation.ts → file ops via vault-ops
    ↓
waitForIdle() → plugin sync
    ↓
assertions.ts → expectPostHealing()
    ↓
On fail: gatherDebugInfo → log file
```

## Mutation Chain Pattern

Tests run as sequential state mutations on one vault:
- State carries forward (no reset between steps)
- Each step validates incremental changes
- Uses `VAULT_EXPECTATIONS_NNN` for expected state

```typescript
VAULT_EXPECTATIONS_NNN = {
  initial: { codexes: [...], files: [...] },
  postHealing: {
    codexes: [...],
    files: [...],
    contentChecks?: [["path", ["required", "lines"]]]
  }
}
```

## Key Components

### Support APIs

**vault-ops.ts** - File operations
- `createFile(path, content)`, `createFiles(files[])`
- `renamePath(old, new)`, `deletePath(path)`
- All return `Result<T, string>`; execute via `browser.executeObsidian()`

**files.ts** - Polling assertions
- `expectFilesToExist(paths)` - throws with diagnostics on timeout
- `expectPostHealingFiles(expectations)` - validates files + content
- `expectExactCodexes(expected)` - lists all `__-*.md` under Library, fails if orphans found

**idle.ts** - Plugin synchronization
- `waitForPluginInitialized(id)` - polls `plugin.initialized`
- `whenIdle(id)` - calls `plugin.whenIdle()` hook
- `waitForIdle()` - combines both

**debug.ts** - Failure diagnostics
- Collects: tree state, healing actions, vault events, dispatcher batches
- Writes to log file on test failure

### Polling Engine (`poll.ts`)

```typescript
{
  timeoutMs: 15000,     // HEALING_POLL_OPTIONS default
  intervalMs: 200,
}
```

Returns: `{ok, attempts, waitedMs, value}`

### Error Handling

**E2ETestError**: base class with `details` field for long diagnostics

**FilesExpectationError**: includes per-file wait status, folder chain validation, vault sample

Short message → test output; details → log file

### Reporter (`tldr-reporter.cjs`)

- Shows `✓`/`✖`/`-` per test
- No error blocks in console
- Writes: `tests/tracing/logs/fail_<testname>.log`

## Obsidian Integration (`obsidian.ts`)

**Undocumented APIs used:**
- `app.plugins.plugins[id]` - plugin registry
- `plugin.initialized` - init state flag
- `plugin.whenIdle()` - custom sync hook
- `TFolder.children` - folder listing

## WDIO Config (`wdio.conf.mts`)

**Parallel execution**: `maxInstances: 8` (env: `WDIO_MAX_INSTANCES`)

**Mobile testing**: enabled in CI (skip: `WDIO_MOBILE=0`)

**Noise filter**: intercepts stdout/stderr, writes to `wdio-noise-launcher.log`

**Log hooks**:
- `onWorkerStart`: capability/spec metadata
- `onWorkerEnd`: exit code, retry info
- `onComplete`: run summary

## Known Issues

### Codex Not Updated After File Rename
- **Location**: `003-create-and-rename-a-file`
- User renames suffixed file → parent codex still references old name
- Status: documented, test reproduces it

### New Files with Suffix Not Indexed
- Files created with correct suffix directly bypass codex registration
- Only healing-processed files added to parent codex

### Timing Sensitivity
- Healing has variable completion time
- Use `waitForIdle()` after mutations, not fixed delays
- `HEALING_POLL_OPTIONS.timeoutMs = 15000` for healing-heavy ops

### Test Isolation
- Vault reset in `before()` only, not between `it()` blocks
- Chain tests intentionally share state
- Parallel test files use separate Obsidian instances

## Running Tests

```bash
bun run test:e2e                   # Full suite
WDIO_MOBILE=0 bun run test:e2e     # Desktop only
E2E_DEBUG=1 bun run test:e2e       # Keep stack traces
WDIO_MAX_INSTANCES=4 bun run test:e2e
```

Logs: `tests/tracing/logs/`
