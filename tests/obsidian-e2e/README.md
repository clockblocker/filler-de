# Obsidian E2E Tests

New e2e tests for librarian-new implementation.

## Structure

```
obsidian-e2e/
├── librarian-new/           # Tests for new Librarian
│   └── folder-rename-healing.e2e.ts
├── vaults/                  # Test vault fixtures (1 per test suite)
│   └── folder-rename-healing/
│       └── Library/...
└── helpers/                 # Shared test utilities
    └── polling.ts           # waitForFile, waitForFileGone, waitFor
```

## Test Organization

### Vaults
- **1 vault per test suite** at `vaults/<test-file-basename>/`
- Reset via `obsidianPage.resetVault()` in `beforeEach`
- Keep minimal - only files needed for that suite

### Pure Functions
- Internal librarian funcs are pure → unit tests
- E2E tests interact via Obsidian API only (rename folder, check files)

### Helpers
- `helpers/polling.ts` - poll for file existence instead of `setTimeout`
- Add more shared utils here as needed

### Instances
- `maxInstances: 4` in wdio.conf.mts
- Each test suite = fresh librarian-new instance
- No shared state between specs

## Running

```bash
bun run test:e2e
```
