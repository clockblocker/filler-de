## E2E refresh plan

### Pain today
- wdio-obsidian-service launches many Obsidians (versions + mobile emulation); startup dominates.
- Each spec runs `resetVault` and re-exposes testing globals; lots of `executeObsidian` roundtrips with `unknown`.
- No fast way to read vault/note state after user actions; no typed bridge; ad-hoc commands.
- Tests duplicate unit/integration coverage; flakiness risk; CI time high.

### Goals
- Read vault/note/plugin state quickly after user actions.
- Run commands programmatically and capture results/errors.
- Reuse one Obsidian per run; avoid relaunch between specs.
- Keep only thin smoke E2E; push logic to unit/integration.

### Stack today
- WebdriverIO 9 + wdio-obsidian-service + mocha; bun runner.
- Fixtures: `tests/simple`; `obsidianPage.resetVault` in `beforeEach`.
- Hidden commands expose `window.__textfresserTesting` (manager, reader) but remain untyped.

### Options / tradeoffs
- Keep wdio; add strong bridge + deterministic reset (picked). Real app fidelity; minimal infra. Must police state leaks.
- Headless integration via obsidian-launcher only. Faster, but less realistic; misses UI wiring.
- Switch driver (Playwright/Electron). More churn; wdio-obsidian-service already solves app boot.

### Proposed helper/framework
- Plugin-side `TestBridge` (zod-validated)
  - Hidden command `textfresser-testing:bridge` attaches `window.__textfresserTesting`.
  - API: `resetSandbox(fixture?)`, `snapshotVault` (paths, mtimes, sizes, content for md), `readNote`, `writeNote`, `list`, `exists`, `open`, `pwd`, `runCommand(id|name, args)`, `dispatch(actions)`, `events()` (workspace/vault ring buffer), `pluginState()` (feature flags, settings).
  - Uses `vaultActionManager` + `OpenedFileService` to stay consistent with prod path logic.
- WDIO-side `E2EClient`
  - `ensureBridge()` once per session (no relaunch). Wraps `browser.executeObsidian` with typed results.
  - `useFixture(name)` -> copies fixture into run temp dir, calls `resetSandbox`.
  - `scenario()` helper: run user action (UI or command), then pull `snapshotVault` / `events()` for assertions.
  - Built-in asserts: `expectNoteContent`, `expectExists`, `expectTreeDiff`.
- Vault fixtures / reset
  - Store fixtures under `tests/fixtures/vaults/<name>`.
  - Suite `before`: copy fixture to `.tmp/vault-<run>`; set `wdio:obsidianOptions.vault` to that path.
  - Test `beforeEach`: `bridge.resetSandbox(fixture)` (delete new files, restore fixture content) instead of relaunch.
- Session policy
  - Default: single capability `latest desktop`, `maxInstances=1`; optional mobile job separate.
  - `afterTest` on failure: dump `events()` and `snapshotVault` to `tests/tracing`.
  - Keep UI steps minimal; prefer command/bridge calls; only smoke one real UI flow.

### Migration plan
- Implement `TestBridge` + `E2EClient`.
- Add fixtures + temp vault bootstrap in `wdio.conf`.
- Rewrite E2E to 2–3 smokes: plugin boots, command toggle works, manager write/read round-trip, reader pwd/list ok.
- Drop/skip current E2E after smokes verified; move logic to unit/integration with fixtures.

### Decisions (updated)
- Settings: shared across tests (no per-test reset; rely on bridge reset for content only).
- Event buffer size/shape: don't care; minimal ring buffer fine.
- Coverage: desktop-only; mobile job skipped.
