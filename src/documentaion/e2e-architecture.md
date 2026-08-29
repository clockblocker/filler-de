# End-to-end test architecture

Textfresser has three test lanes. Each lane owns a different source of
uncertainty; none is a cheaper imitation of another.

| Lane | Owns | Command |
| --- | --- | --- |
| Deterministic | Library interpretation/healing, Librarian composition, Textfresser orchestration | `bun run test:unit`, `bun run test:integration` |
| Obsidian desktop | Real plugin lifecycle, vault/file-manager callbacks, event timing, official CLI transport | `bun run test:obsidian-e2e` |
| Provider acceptance | Live Gemini prompt and schema quality | `bun run test:provider-acceptance --suite=<budget>` |

The former shared-vault chain, duplicate fast harness, arbitrary renderer-eval
RPC, per-test reloads, and fixed wait ladders have been deleted. The completed
behavior map is in `tests/obsidian-e2e/scenarios/COVERAGE.md`.

## Desktop topology

```text
tests/obsidian-e2e/runner.ts
  acquire exclusive lease
  resolve official obsidian-cli
  disable both plugins
  deploy Textfresser + test driver once
  establish one renderer/session boundary
  enable driver, then Textfresser
  await versioned readiness
  run independent Bun scenarios serially
  collect diagnostics on failure
  clean session and owned host in finally
              |
              | serialized official CLI calls
              v
Obsidian desktop + dedicated vault
  production Textfresser artifact
  test-only driver plugin
    textfresser-e2e request=<base64url JSON>
```

Obsidian Headless is not used: it does not host community plugins. Managed E2E
therefore needs a logged-in macOS desktop session. Attached mode borrows one
dedicated test vault but still holds the repository-wide lease and owns plugin
deployment for the duration of the run.

## Control plane

The driver registers one CLI command through Obsidian's awaited
`registerCliHandler` API. Requests and responses use a versioned JSON envelope
with a session ID, request ID, Textfresser instance ID, and generation.

Mutations are fenced. If Textfresser reloads or the generation changes, the
request fails rather than silently continuing against a replacement instance.
The driver caches bounded responses by request ID, but the controller never
replays an ambiguous create, rename, delete, or modify operation.

Supported protocol methods are `status`, `ready`, `beginScenario`, `act`,
`settle`, `snapshot`, `diagnostics`, and `cleanupSession`. Scenario authors do
not call those methods directly; `withObsidianScenario` is the public seam.

## Scenario lifecycle

Every scenario is one independent story:

```ts
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

		expect((await snapshot()).files).toContainEqual({
			kind: "md",
			path: "Soup/Ramen/NewScroll-Ramen-Soup.md",
		});
	},
);
```

The driver allocates `E2E/<session>/<scenario>/Library`, seeds the fixture
through Obsidian's Vault API, reinitializes the Librarian against that root,
and waits for real pending work to settle. Fixture/action paths are Library
relative. `snapshot` returns a sorted view of files plus all Markdown contents.
The scenario root is removed in `finally`, including when assertions fail.

Available actions are `createFile`, `createBinary`, `modifyFile`, `renamePath`,
and `deletePath`. Add a new typed action only for a genuine host boundary that
cannot be tested in-process. Never expose raw `app`, `eval`, VAM, Librarian, or
a plugin instance to scenario code.

## Completion and isolation

The runner deploys only while both plugins are disabled and performs one
session-boundary reload in attached mode. Ordinary scenarios never reload.

`act` awaits Textfresser's owned idle barrier after the Obsidian mutation.
Tests do not sleep or poll individual files. This barrier includes active
Textfresser work and VAM settlement; a timeout is a failure with diagnostics,
not permission to retry the mutation.

Normal runs are quiet. On failure the harness preserves the session manifest,
structured driver status/snapshot, Obsidian errors, recent warning/error
console messages, screenshot, and the runner error. Temporary artifacts from a
successful run are removed.

## Attached mode

Create `.env.obsidian-e2e`:

```dotenv
OBSIDIAN_E2E_VAULT=dedicated-test-vault
OBSIDIAN_E2E_VAULT_PATH=/absolute/path/to/dedicated-test-vault
```

Open that vault in Obsidian, enable the official CLI in Obsidian settings, and
run:

```bash
bun run test:obsidian-e2e
bun run test:obsidian-e2e --scenario=folder-rename-healing
```

An existing local `.env.cli-e2e` is loaded only as a configuration
compatibility fallback. New setup uses the `OBSIDIAN_E2E_*` names.

## Managed mode

```bash
bun run test:obsidian-e2e:managed
```

Managed mode is the reference CI topology. It refuses to run while Obsidian is
already open, creates/restores the dedicated test vault before launch, installs
both plugins before startup, registers the disposable folder in Obsidian's vault
map, opens it by vault ID, owns the process it starts, and removes the
registration after Obsidian exits. It then cleans the vault afterward.
`OBSIDIAN_E2E_KEEP_VAULT=1` retains a failed vault;
`OBSIDIAN_E2E_VAULT_TEMPLATE=/absolute/path` supplies an immutable starting
template.

The host needs Obsidian 1.12.2 or newer with its current installer and CLI
enabled. `OBSIDIAN_CLI_PATH` may select the official binary. The runner rejects
`/Applications/Obsidian.app/Contents/MacOS/Obsidian`; that GUI executable does
not provide the required awaited async contract.

## Deterministic integration

Use an in-process public module boundary when the uncertainty is domain logic,
not Obsidian. Current examples include:

- Bulk Vault Event to Tree Action to Healing policy;
- repeated Core Name changes and Codex rendering;
- `Librarian.handleCodexCheckboxClick` status propagation;
- `Textfresser.executeCommand("Lemma", context)` source transformation;
- background Generate scheduling and cleanup.

These tests use deterministic adapters and assert semantic actions/output.
They must not reproduce Obsidian objects, CLI process behavior, or private
implementation call order.

## Provider acceptance

Provider tests call the public lexical-generation module without starting
Obsidian. A run requires all three explicit inputs: the opt-in flag, provider
key, and suite budget.

```bash
bun run test:provider-acceptance:preflight

TEXTFRESSER_PROVIDER_ACCEPTANCE=1 \
GEMINI_API_KEY=... \
bun run test:provider-acceptance --suite=smoke
```

`--suite=edge` and `--suite=all` are larger budgets; `--case=<id>` focuses one
case and automatically includes its ordered sense prerequisites. Reports are
written beneath `tests/provider-acceptance/artifacts/textfresser` unless
`TEXTFRESSER_PROVIDER_ARTIFACT_DIR` overrides the destination.

Provider acceptance owns canonical lemma, lexical classification,
disambiguation, and schema-valid generation. It does not own source rewriting,
wikilink idempotency, or note persistence; deterministic Textfresser tests do.

## Adding coverage

1. Identify the uncertainty before choosing a lane.
2. Put Library/Textfresser semantics at a public deterministic seam.
3. Use desktop E2E only when real Obsidian behavior is part of the claim.
4. Use provider acceptance only when model output itself is the claim.
5. Make every desktop story independent and minimal.
6. Verify locally with the narrow command, then the relevant aggregate suite.

The architectural rule is simple: one lifecycle owner, one typed control
plane, independent scenarios, and no synchronization by accident.
