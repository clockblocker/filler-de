# Obsidian desktop E2E

This is the greenfield desktop-host harness. It uses the official
`obsidian-cli`, deploys once per run, talks to a test-only driver through one
versioned command, and gives every test its own Library root. Scenario tests do
not reload plugins, inject JavaScript, sleep, or know where the test vault
lives.

## Run it

For the existing dedicated local test vault, keep `OBSIDIAN_E2E_VAULT_PATH` in
`.env.obsidian-e2e` and run:

```bash
bun run test:obsidian-e2e
```

Run one scenario by filename while developing it:

```bash
bun run test:obsidian-e2e --scenario=basename-healing
```

The command builds Textfresser, takes the exclusive E2E lock, disables both
plugins, installs the current Textfresser build and E2E driver, enables the
driver before Textfresser, waits for the versioned readiness response, and
runs scenarios serially. Attached mode resolves the registered vault ID from
the configured path and opens or focuses it as a second window in the existing
Obsidian process. It never closes the user's current vault and leaves the
dedicated test window open after the run. It performs one runner-owned reload
of only that test window at the session boundary to discard stale renderer
callbacks. There is no manual copy or per-test reload step.

Managed mode is the clean reference environment:

```bash
bun run test:obsidian-e2e:managed
```

Managed mode requires macOS and refuses to run while any Obsidian process is
already open. It creates a temporary vault, installs both plugins before app
startup, temporarily registers that folder with Obsidian, opens it by vault ID,
owns the resulting process, and removes both the registration and vault
afterward. This is necessary because an `obsidian://open?path=...` URI can find
content only inside an already registered vault; it cannot register a new
folder. Set `OBSIDIAN_E2E_KEEP_VAULT=1` to retain a failed vault, or
`OBSIDIAN_E2E_VAULT_TEMPLATE=/absolute/path` to start from a template.

Run the driver and transport tests without opening Obsidian:

```bash
bun run test:obsidian-e2e:infra
```

Prerequisites are Obsidian 1.12.2 or newer, CLI enabled in Obsidian settings,
and the official `obsidian-cli` executable on `PATH`. An explicit
`OBSIDIAN_CLI_PATH` may point to that binary. The harness rejects the GUI
`.../MacOS/Obsidian` executable because it does not provide the required async
CLI contract.

## Write a scenario

Put one complete, independent story in `scenarios/`:

```ts
import { expect, test } from "bun:test";
import { withObsidianScenario } from "../harness";

test("a new scroll is healed", async () => {
	await withObsidianScenario(
		{
			id: "new-scroll-healing",
			fixture: [{ path: "Soup/Ramen/Anchor.md", content: "# Anchor" }],
		},
		async ({ act, snapshot }) => {
			await act({
				kind: "createFile",
				path: "Soup/Ramen/NewScroll.md",
				content: "# NewScroll",
			});

			const vault = await snapshot();
			expect(vault.files.map((file) => file.path)).toContain(
				"Soup/Ramen/NewScroll-Ramen-Soup.md",
			);
		},
	);
});
```

Fixture and action paths are relative to that scenario's logical `Library`.
`act()` returns only after Textfresser and its Obsidian/VAM event pipeline have
settled. `snapshot()` returns one sorted, normalized view of the Library:
Markdown contents are in `markdown`, and file kinds are `md` or `file`.

Available actions are `createFile`, `createBinary`, `modifyFile`,
`renamePath`, and `deletePath`. If a test needs raw `app`, `eval`, VAM,
Librarian, timing controls, or network monkey-patches, it belongs at an
in-process integration seam or in the explicit provider-acceptance suite—not
in desktop E2E.

## Failure behavior

Normal runs print only Bun's test output. A failed scenario writes its driver
status and final snapshot beneath the run artifact directory. The outer runner
also captures Obsidian errors, warning/error console output, and a screenshot.
The temporary artifact path is printed on failure and contains `session.json`;
successful runs remove their temporary artifact directory.

The runner never retries a mutation. Every mutation carries a request ID plus
the expected Textfresser instance and generation; a reload or ambiguous
lifecycle transition fails the story instead of replaying it.

## Coverage ownership

The former reload/eval harnesses have been removed. `scenarios/COVERAGE.md`
records where every former case now lives: representative Obsidian behavior in
this suite, deterministic Library and Textfresser behavior in in-process tests,
and live model quality in `tests/provider-acceptance`.

Do not recreate a second desktop harness. If the existing `act` vocabulary
cannot express a story honestly, place it at the public in-process seam that
owns the behavior or propose one intentional typed driver action.
