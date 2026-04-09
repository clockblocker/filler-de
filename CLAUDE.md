```bash
# Build
bun run build        # production
bun run dev          # watch mode
bun run build:dev    # dev + typecheck

# Test
bun test             # unit tests
bun run test:unit    # unit only (same as above)
bun run test:cli-e2e # CLI-based E2E (requires running Obsidian + .env.cli-e2e)
bun test path/to/test.test.ts  # single file

# Code quality
bun run lint         # check only
bun fix              # fix lint + format
bun run typecheck:changed  # typecheck vs master (RUN BEFORE FINISHING WORK)

# CLI E2E (requires running Obsidian + .env.cli-e2e)
bun run test:cli-e2e                                          # full suite
CLI_E2E_VAULT=cli-e2e-test-vault CLI_E2E_VAULT_PATH=... bun run tests/cli-e2e/textfresser/edge-case-runner.ts  # edge cases
```
