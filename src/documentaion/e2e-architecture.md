# End-to-end test architecture

Textfresser uses three test lanes. Choose the lane that owns the risk.

| Lane | Use it for | Command |
| --- | --- | --- |
| Deterministic | Library policy, healing, Librarian composition, and Textfresser orchestration | `bun run test:unit`, `bun run test:integration` |
| Obsidian desktop | Plugin lifecycle, Obsidian callbacks, event timing, and CLI transport | `bun run test:obsidian-e2e` |
| Provider acceptance | Live Gemini output and schema quality | `bun run test:provider-acceptance --suite=<budget>` |

See `tests/obsidian-e2e/scenarios/COVERAGE.md` for the desktop behavior map.

## Desktop harness

The runner owns one test session:

```text
runner
  -> acquire the repository lease
  -> resolve the official Obsidian CLI
  -> deploy Textfresser and the test driver
  -> enable both plugins
  -> wait for versioned readiness
  -> run independent scenarios in series
  -> collect diagnostics on failure
  -> clean owned state
```

The runner uses Obsidian desktop because Obsidian Headless does not load community plugins. The host must have a logged-in macOS desktop session.

The runner must use the official CLI binary. It must reject `/Applications/Obsidian.app/Contents/MacOS/Obsidian`. The GUI executable does not provide the awaited CLI contract.

The test driver registers one awaited CLI handler. The protocol uses a versioned request envelope with session, request, plugin instance, and generation IDs. A request fails if the plugin reloads or the generation changes. The controller does not retry an ambiguous mutation.

Scenario code uses only:

```ts
withObsidianScenario({ id, fixture }, async ({ act, snapshot, status }) => {
	// one user story
});
```

Supported actions are `createFile`, `createBinary`, `modifyFile`, `renamePath`, and `deletePath`. Do not expose raw `app`, `eval`, VAM, Librarian, or plugin objects to a scenario.

## Isolation and completion

Each scenario gets `E2E/<session>/<scenario>/Library`. Fixture paths and action paths are relative to that Library root.

The harness:

1. Seeds the fixture through Obsidian.
2. Reinitializes the Librarian for the scenario root.
3. Runs one typed action at a time.
4. Waits for Textfresser and VAM to become idle.
5. Returns a sorted file and Markdown snapshot.
6. Removes the scenario root in `finally`.

Tests must not use sleeps or file-specific polling. A settlement timeout is a test failure. The harness must return diagnostics instead of retrying the action.

On failure, the harness keeps the session manifest, status, snapshot, Obsidian errors, recent warning and error messages, screenshot, and runner error. Successful runs remove temporary artifacts.

## Attached mode

Create `.env.obsidian-e2e`:

```dotenv
OBSIDIAN_E2E_VAULT_PATH=/absolute/path/to/dedicated-test-vault
```

Register that folder as an Obsidian vault and enable the official CLI. Then run:

```bash
bun run test:obsidian-e2e
bun run test:obsidian-e2e --scenario=folder-rename-healing
```

Attached mode opens or focuses the dedicated vault as another window. It targets all CLI calls by vault ID. It does not use or close the user's current vault.

`.env.cli-e2e` is a compatibility fallback. New configuration must use the `OBSIDIAN_E2E_*` names.

## Managed mode

```bash
bun run test:obsidian-e2e:managed
```

Managed mode owns a disposable vault and the Obsidian process. Obsidian must be closed before the run. The runner registers the vault, starts Obsidian, runs the scenarios, removes the registration, and cleans the vault.

Use these options only when required:

- `OBSIDIAN_E2E_KEEP_VAULT=1` keeps a failed vault.
- `OBSIDIAN_E2E_VAULT_TEMPLATE=/absolute/path` supplies a read-only starting template.
- `OBSIDIAN_CLI_PATH=/absolute/path` selects the official CLI.

## Lane rules

- Test domain rules through a public in-process boundary.
- Use desktop E2E only when the claim depends on real Obsidian behavior.
- Use provider acceptance only when the claim depends on model output.
- Keep each desktop scenario independent and small.
- Run the narrow test before its aggregate suite.

Provider acceptance requires an explicit opt-in flag, provider key, and suite budget:

```bash
bun run test:provider-acceptance:preflight

TEXTFRESSER_PROVIDER_ACCEPTANCE=1 \
GEMINI_API_KEY=... \
bun run test:provider-acceptance --suite=smoke
```

Provider acceptance does not test source rewrites, wikilink idempotency, or note persistence. Deterministic tests own those contracts.
