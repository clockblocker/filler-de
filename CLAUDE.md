```bash
# Build
bun run build
bun run dev
bun run build:dev

# Test
bun run test:unit
bun run test:integration
bun run test:obsidian-e2e
bun run test:obsidian-e2e --scenario=basename-healing
bun run test:obsidian-e2e:managed
bun run test:obsidian-e2e:infra
bun run test:provider-acceptance:preflight

# Code quality
bun run lint
bun fix
bun run typecheck
bun run typecheck:changed
```

# Effect

Before writing Effect code, read `node_modules/effect/AGENTS.md` completely and
follow its required references. Search `node_modules/effect/src` for APIs not
covered there.

# Obsidian E2E

Use only `tests/obsidian-e2e` and the official `obsidian-cli` executable. The
runner owns build deployment, plugin lifecycle, readiness, scenario isolation,
failure diagnostics, and cleanup. Scenario code uses
`withObsidianScenario()` with `fixture`, `act`, `snapshot`, and `status`; do not
use arbitrary renderer `eval`, sleeps, reloads, or plugin internals.

Attached configuration belongs in `.env.obsidian-e2e` as
`OBSIDIAN_E2E_VAULT_PATH`. The runner resolves the registered vault ID and
opens or focuses it as a second window without closing the user's existing
vault. Provider acceptance is a separate opt-in suite under
`tests/provider-acceptance` and must never be folded into desktop E2E.
