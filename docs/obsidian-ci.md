# Obsidian desktop-host testing

The supported E2E harness is `tests/obsidian-e2e`. It uses Obsidian's official
`obsidian-cli` executable and a test-only driver plugin. The former reload,
raw-eval, shared-chain, and fast-wait harnesses have been removed.

Local attached run:

```bash
bun run test:obsidian-e2e
```

Clean managed run on a dedicated macOS desktop host:

```bash
bun run test:obsidian-e2e:managed
```

Managed mode is the authoritative CI shape. Obsidian CLI controls the desktop
application; Obsidian Headless does not load community plugins and cannot run
this suite. The host therefore needs a logged-in graphical session, Obsidian
1.12.2 or newer, and CLI enabled. Managed mode refuses to take over an already
running Obsidian process.

The outer runner owns the entire session: exclusive lock, disposable vault,
artifact deployment before launch, process startup, readiness, serialized Bun
tests, failure diagnostics, and teardown. It installs only Textfresser and the
E2E driver in the generated vault. Every scenario then owns
`E2E/<session>/<scenario>/Library` and accesses it through fixture, `act`,
`snapshot`, and `status` operations.

See `tests/obsidian-e2e/README.md` for setup, authoring examples, and
diagnostics. `tests/obsidian-e2e/scenarios/COVERAGE.md` records the completed
cutover. Live model-quality checks run separately through the opt-in
`tests/provider-acceptance/textfresser` suite. The CLI behavior and architecture
decisions behind the harness are recorded in
`docs/e2e-obsidian-cli-research.md`.
