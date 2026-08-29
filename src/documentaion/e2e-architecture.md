# End-to-end test architecture

Textfresser uses three test lanes. Choose the lane that owns the risk.

Decision: [ADR-0009: Use the official Obsidian CLI for desktop E2E](../../docs/adr/0009-use-the-official-obsidian-cli-for-desktop-e2e.md).

| Lane | Use it for | Command |
| --- | --- | --- |
| Deterministic | Library policy, Healing, Librarian composition, and Textfresser orchestration | `bun run test:unit`, `bun run test:integration` |
| Obsidian desktop | Plugin lifecycle, Obsidian callbacks, event timing, and CLI transport | `bun run test:obsidian-e2e` |
| Provider acceptance | Live Gemini output and schema quality | `bun run test:provider-acceptance --suite=<budget>` |

## Desktop invariants

The desktop harness must:

- use the official Obsidian CLI;
- target a registered dedicated vault by ID;
- deploy the production plugin and one test-only driver;
- use one typed, versioned driver protocol;
- run independent scenarios in series;
- wait for Textfresser and VAM to become idle;
- collect diagnostics before cleanup;
- remove owned state in `finally`.

The harness must not:

- use the Obsidian GUI executable as a CLI;
- use Obsidian Headless, which does not load community plugins;
- close or use the user's current vault;
- expose raw `app`, `eval`, VAM, Librarian, or plugin objects to scenarios;
- retry an ambiguous create, modify, rename, or delete;
- use fixed sleeps as a completion signal.

The protocol includes session, request, plugin-instance, and generation IDs. A request fails if the plugin reloads or the generation changes.

## Scenario seam

Scenario authors use only:

```ts
withObsidianScenario({ id, fixture }, async ({ act, snapshot, status }) => {
	// one user story
});
```

Each scenario gets `E2E/<session>/<scenario>/Library`. Paths are relative to that Library root.

`act` supports `createFile`, `createBinary`, `modifyFile`, `renamePath`, and `deletePath`. It waits for the owned idle barrier after the Obsidian mutation.

`snapshot` returns sorted files and Markdown content. The harness removes the scenario root even when an assertion fails.

A settlement timeout is a failure. The failure output must include driver status, vault snapshot, Obsidian errors, recent warning and error messages, screenshot, and the runner error.

## Host modes

Attached mode opens or focuses a registered dedicated test vault as another window. It does not close the user's current vault.

Managed mode owns a disposable vault and the Obsidian process. Obsidian must be closed before this mode starts.

Use:

```bash
bun run test:obsidian-e2e
bun run test:obsidian-e2e --scenario=<id>
bun run test:obsidian-e2e:managed
```

See `tests/obsidian-e2e/README.md` for setup, environment variables, diagnostics, and infrastructure tests. See `tests/obsidian-e2e/scenarios/COVERAGE.md` for the behavior map.

## Lane rules

- Test domain rules through a public in-process boundary.
- Use desktop E2E only when the claim depends on real Obsidian behavior.
- Use provider acceptance only when the claim depends on model output.
- Keep each desktop scenario independent and small.
- Run the narrow test before its aggregate suite.

Provider acceptance does not test source rewrites, wikilink idempotency, or note persistence. Deterministic tests own those contracts.
