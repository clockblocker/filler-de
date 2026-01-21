# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read the high-level descripton of the project in docs/**

If you change anything maningful, modify the files for those who come after.

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.

## Project Overview

Textfresser is an Obsidian plugin for building personal German vocabulary dictionaries. 
It: 
- maintans a currated folder for user library of texts
- generates structured dictionary entries with conjugations/declensions, maintains bidirectional links between word forms, and integrates with Google Gemini API for language processing.

## Build & Development Commands

### Building
```bash
# Production build
bun run build

# Development build with watch mode
bun run dev

# Development build with type checking
bun run build:dev
```

### Testing
```bash
# Run all tests (unit + e2e)
bun test

# Unit tests only
bun run test:unit

# E2E tests only (builds plugin first)
bun run test:e2e

# Coverage report
bun run coverage

# Clear test logs
bun run clearTestLogs
```

### Code Quality
```bash
# Lint
bun run lint

# Lint with auto-fix
bun run lint:fix

# Format code
bun run format
```

### Running Single Tests
```bash
# Run specific test file
bun test path/to/test.test.ts

# Run with pattern
bun test --test-name-pattern "pattern"
```

## Architecture

### Core Components

**VaultActionManager** (`src/managers/obsidian/vault-action-manager/`)
- Abstraction layer over Obsidian's file system API
- **Actions**: Declarative file operations (create, write, rename, trash, process content)
- **Dispatcher**: Queues, collapses, and topologically sorts actions before execution
- **Event System**: Emits bulk vault events after dispatching actions; filters self-generated events
- **SplitPath**: Internal path representation separating directory segments and basename
- Manages dependencies between file operations to ensure correct execution order
- **ActionHelpers** (`helpers/action-helpers.ts`): Utility functions eliminating switch statements over VaultAction types

**Managers** (`src/managers/`)
- `obsidian/`: Obsidian-specific services (vault, clicks, files)
- `pure/`: Framework-agnostic business logic (metadata parsing)

**Interceptors** (`src/managers/obsidian/`)
- Pub-sub event emitters for UI interactions; Librarian subscribes to handle business logic
- **ClickInterceptor**: Detects checkbox clicks in codex files, emits events for status toggling
- **WikilinkAliasInterceptor**: Detects wikilink completion (`[[...]]`), emits events; Librarian adds `|alias` for library files (files with suffix parts)

**NoteMetadataManager** (`src/managers/pure/note-metadata-manager/`)
- See `src/documentaion/librarian-architrecture.md` → Metadata → NoteMetadataManager

**Librarian System** (`src/commanders/librarian-new/`)
- The central orchestrator managing a hierarchical library tree structure
- `Librarian`: Main class that initializes tree from vault, processes user events, and coordinates healing actions
- `LibraryTree`: In-memory tree representation with nodes, codexes (index files), and status tracking
- **Healing**: Reconciles discrepancies between vault state and tree state through healing actions
- **Codex**: Special index files that track children nodes and their completion status via clickable checkboxes
- **PathFinder** (`paths/path-computer.ts`): Single source of truth for all suffix/path computation logic
- **HealingError** (`errors/healing-error.ts`): Unified error types for healing operations

**Services** (`src/services/`)
- `prompts/`: LLM prompt definitions for German word processing (verbs, nouns, adjectives, morphemes)
- `dto-services/`: Data transformation for notes and quotes
- `obsidian-services/`: UI toolbars and selection handling
- `wip-configs/`: Action configurations and event listeners

### Key Patterns

**Result Types**: Uses `neverthrow` for error handling (`Result<T, E>`)

**Event-Driven**: Components subscribe to vault events and bulk events for reactive updates

**Tree Navigation**: Nodes use segment IDs (`NodeSegmentId`) with separators; paths canonicalized using locators

**Type Safety**: Zod schemas validate LLM outputs and metadata structures

## TypeScript Patterns

### Type Safety Rules (.cursor/rules/avoid-as.mdc)
- Avoid `as` and `any` except for undocumented Obsidian APIs
- Each exception must be commented
- Use Zod for runtime validation

### Logging Rules (.cursor/rules/logging.mdc)
- **Use** `log` from `src/utils/logger`, not `console.*`
- **No object logging**: Always stringify with `JSON.stringify()`
- Log levels: `debug()`, `info()`, `warn()`, `error()`
- Example:
```typescript
// ❌ BAD
console.log("event", event);

// ✅ GOOD
log.debug("event", JSON.stringify({ kind: event.kind }));
log.error("Failed:", error instanceof Error ? error.message : String(error));
```

## Testing Infrastructure

**Unit Tests** (`tests/unit/`): Pure business logic tests using Bun's test runner

**Spec Tests** (`tests/specs/`): Integration tests for VaultActionManager, dispatcher, librarian healing, and file helpers

**E2E Tests** (`tests/obsidian-e2e/`): WebdriverIO tests running against real Obsidian instances
- Uses `wdio-obsidian-service` to launch Obsidian
- Tests both desktop and mobile (emulated) modes
- Vault: `tests/simple`

**Test Utilities**:
- `tests/unit/setup.ts`: Preload setup for unit tests
- `tests/tracing/`: Test logging infrastructure

## Important Files

- `src/main.ts`: Plugin entry point; initializes services and commanders
- `src/global-state/global-state.ts`: Plugin-wide state and settings access
- `src/settings.ts`: Settings UI and schema
- `src/types/`: Shared type definitions and linguistic models
- `manifest.json`: Plugin metadata for Obsidian
- `biome.json`: Linter/formatter configuration

## Development Notes

### Plugin Initialization
- Deferred init via `initWhenObsidianIsReady()` waits for layout and metadata
- Services initialized in specific order due to dependencies
- Librarian auto-starts healing on init

### VaultActionManager Dispatch Flow
1. Actions submitted to dispatcher
2. Dependency detection and topological sort
3. Action collapsing (merge redundant operations)
4. Sequential execution with Obsidian API
5. Bulk event emission (filtered to exclude self-generated events)

### Librarian Healing Flow
1. Tree built from vault files during init
2. Mismatches detected (missing nodes, incorrect status, moved files)
3. Healing actions generated (create, write, rename operations)
4. Actions dispatched via VaultActionManager
5. Tree updated with new state

### Path Handling
- Use `SplitPath` types for internal paths
- Convert to system paths via `makeSystemPathForSplitPath()` when needed
- Library-scoped paths use special codecs for tree operations

### LLM Integration
- Prompts in `src/services/prompts/` define structured outputs
- Zod schemas validate LLM responses
- Handles German linguistic structures (verbs, nouns, adjectives, morphemes)

## Refactoring Infrastructure

### New Modules Added
These modules consolidate duplicated logic and improve error handling:

**PathFinder** (`src/commanders/librarian-new/paths/path-finder.ts`)
- Single source of truth for suffix/path computation
- Key functions: `computeCodexSuffix()`, `buildCodexSplitPath()`, `sectionChainToPathParts()`, `parseSectionChainToNodeNames()`

**HealingError** (`src/commanders/librarian-new/errors/healing-error.ts`)
- Unified error type for all healing operations
- Discriminated union with error constructors and utilities
- Use with `Result<T, HealingError>` instead of throwing

**ActionHelpers** (`src/managers/obsidian/vault-action-manager/helpers/action-helpers.ts`)
- Eliminates switch statements over VaultAction types
- Use `isCreateAction()`, `getActionPath()`, `asRenameAction()` etc.

**TreeReader/TreeWriter/TreeFacade** (`src/commanders/librarian-new/healer/library-tree/tree-interfaces.ts`)
- Clean separation of read/write concerns for LibraryTree
- `TreeReader`: Read-only access (`findSection`, `getRoot`)
- `TreeWriter`: Mutation access (`apply`, `ensureSectionChain`)
- `TreeFacade`: Combined interface (Tree class implements this)

**HealingTransaction** (`src/commanders/librarian-new/healer/healing-transaction.ts`)
- Wraps healing operations with verification and audit
- Collects healing actions, tracks errors, logs audit info
- Use `executeHealingTransaction()` for automatic commit/rollback

**HealingAuditLog** (`src/commanders/librarian-new/healer/healing-audit-log.ts`)
- In-memory rolling log for debugging healing issues
- Tracks success/failure rates, error types, durations
- Use `getHealingAuditLog()` for singleton access

**OrphanCodexScanner** (`src/commanders/librarian-new/healer/orphan-codex-scanner.ts`)
- Scans vault for codexes with wrong suffixes
- Generates cleanup and recreation actions
- Use `scanAndGenerateOrphanActions()` for full scan

### Codex Module (`src/commanders/librarian-new/healer/library-tree/codex/`)
- `tree-collectors.ts`: Tree traversal (`collectDescendantSectionChains`, `collectTreeData`)
- `section-chain-utils.ts`: `dedupeByKey<T>`, `chainToKey`, `dedupeChains`
- `transforms/`: Subdirectory with `codex-transforms.ts`, `scroll-transforms.ts`, `transform-utils.ts`
- All path/suffix computation delegated to PathFinder

### Test Coverage
Tests added in `tests/unit/paths/`, `tests/specs/healing/`, `tests/specs/vault-actions/`, `tests/specs/tree/`
