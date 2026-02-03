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
# Check lint/format (no fix)
bun run lint

# Fix lint + format
bun fix

# Typecheck only changed files (vs master)
bun run typecheck:changed
```

### Before Finishing Work
Run `bun run typecheck:changed` before calling it a day. Fix any type errors in files you touched.

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

**UserEventInterceptor** (`src/managers/obsidian/user-event-interceptor/`)
- Unified facade for DOM/editor events; Librarian subscribes to single stream
- **Detectors**: ClickDetector, ClipboardDetector, SelectAllDetector, WikilinkDetector
- **Events**: CheckboxClicked, PropertyCheckboxClicked, ClipboardCopy, SelectAll, WikilinkCompleted
- Events include callbacks (`insertAlias`, `setClipboardData`, `setSelection`) for action delegation

**NoteMetadataManager** (`src/managers/pure/note-metadata-manager/`)
- See `src/documentaion/librarian-architrecture.md` → Metadata → NoteMetadataManager

**Librarian System** (`src/commanders/librarian/`)
- The central orchestrator managing a hierarchical library tree structure
- `Librarian`: Thin orchestrator + state holder; delegates to extracted modules
- `LibraryTree`: In-memory tree representation with nodes, codexes (index files), and status tracking
- **Healing**: Reconciles discrepancies between vault state and tree state through healing actions
- **Codex**: Special index files that track children nodes and their completion status via clickable checkboxes
- **Extracted Modules**:
  - `VaultActionQueue` (`vault-action-queue/`): Serializes async processing of TreeActions
  - `UserEventRouter` (`user-event-router/`): Routes user events to handlers (checkbox, clipboard, select-all, wikilink)
  - `SectionHealingCoordinator` (`section-healing/`): Coordinates section healing for split-to-pages
- **PathFinder** (`paths/path-finder.ts`): Single source of truth for all suffix/path computation logic
- **HealingError** (`errors/healing-error.ts`): Unified error types for healing operations

**OverlayManager** (`src/services/obsidian-services/overlay-manager/`)
- Unified facade for UI overlays (bottom toolbar, selection toolbar, edge zones)
- **CommanderActionProvider interface**: Commanders provide actions via `getAvailableActions(context)`
- **ActionExecutorRegistry**: Maps action kinds to typed execution logic
- **LibrarianActionProvider**: Default provider for library-related actions
- See `src/documentaion/overlay-manager.md` for full architecture

### Key Patterns

**Result Types**: Uses `neverthrow` for error handling (`Result<T, E>`)

**Result Chaining**: Prefer `andThen` over if-chains for pipelines. Log errors once at the end.
```typescript
// ❌ BAD - verbose, logs at each step
const aResult = stepA(ctx);
if (aResult.isErr()) { logger.warn(...); return aResult; }
const bResult = stepB(aResult.value);
if (bResult.isErr()) { logger.warn(...); return bResult; }

// ✅ GOOD - chain with single error log
const result = await stepA(ctx)
    .andThen(stepB)
    .asyncAndThen(stepC);  // use asyncAndThen for async steps

if (result.isErr()) {
    logger.warn("[fn] Failed:", result.error);
    return result;
}
```

**Event-Driven**: Components subscribe to vault events and bulk events for reactive updates

**Tree Navigation**: Nodes use segment IDs (`NodeSegmentId`) with separators; paths canonicalized using locators

**Type Safety**: Zod schemas validate LLM outputs and metadata structures

## TypeScript Patterns

### Type Safety Rules (.cursor/rules/avoid-as.mdc)
- Avoid `as` and `any` except for undocumented Obsidian APIs
- Each exception must be commented
- Use Zod for runtime validation
- **Before writing `as`, hover first** — TS may have already narrowed the type via switch/if/guards

### Prefer Overloads Over `as` Casts for Discriminated Returns
For core functions returning discriminated types based on input, use overloads instead of `as` casts:
```typescript
// ❌ BAD - casts in implementation
function splitPath<T extends TAbstractFile>(file: T): DiscriminatedSplitPath<T> {
    if (file instanceof TFolder) {
        return { kind: "Folder", ... } as DiscriminatedSplitPath<T>;  // cast
    }
    return { kind: "File", ... } as DiscriminatedSplitPath<T>;  // cast
}

// ✅ GOOD - overloads provide type safety, implementation uses broad type
function splitPath<T extends TAbstractFile>(file: T): DiscriminatedSplitPath<T>;
function splitPath(file: TFolder): SplitPathToFolder;
function splitPath(file: TFile): SplitPathToAnyFile;
function splitPath(file: TAbstractFile): AnySplitPath;

function splitPath(file: TAbstractFile): AnySplitPath {
    if (file instanceof TFolder) {
        return { kind: "Folder", ... };  // no cast needed
    }
    return { kind: "File", ... };  // no cast needed
}
```
Overload order: generic first, then specific types, then fallback.

### Don't Lie with `as`
When `as` is necessary, cast to what the value *actually* is — never to what you wish it were:
```typescript
// ❌ BAD - lying: undefined is not FromSplitPathFor<K> when K is a rename kind
if (isRenameEvent(event)) {
    return event.from as FromSplitPathFor<K>;
}
return undefined as FromSplitPathFor<K>;  // lie

// ✅ GOOD - let TS infer the union, cast only where narrowing is lost
if (isRenameEvent(event)) {
    return event.from as FromSplitPathFor<K>;  // TS loses K correlation
}
return undefined;  // inferred as FromSplitPathFor<K> | undefined
```

### Trust Switch Narrowing
Switch cases narrow union types — no cast needed when passing to functions expecting a subset:
```typescript
// ❌ BAD - unnecessary cast
case CommandKind.Generate:
case CommandKind.Lemma:
case CommandKind.TranslateSelection: {
    const textfresserKind = kind as TextfresserCommandKind;  // redundant
    await textfresser.executeCommand(textfresserKind, context);
}

// ✅ GOOD - switch already narrowed kind to "Generate" | "Lemma" | "TranslateSelection"
case CommandKind.Generate:
case CommandKind.Lemma:
case CommandKind.TranslateSelection: {
    await textfresser.executeCommand(kind, context);  // TS knows
}
```

### Type Inference
- Prefer inference over explicit annotations; annotate only when:
  - Inference fails
  - Public API clarity requires it
  - Return type provides inference for callback params (see below)
- Omit redundant generics when return type provides inference:
```typescript
// ❌ BAD
return err<void, CommandError>({ kind: ... });

// ✅ GOOD - inferred from return type
return err({ kind: ... });
```
- Let callees infer types from arguments; don't annotate variables passed to generic functions:
```typescript
// ❌ BAD - redundant, executeCommand<K> infers K from input
const input: CommandInput<"Generate"> = { kind: TextfresserCommandKind.Generate, ... };
return this.executeCommand("Generate", input, generateCommand);

// ✅ GOOD - K inferred from literal "Generate" and generateCommand's type
const input = { kind: TextfresserCommandKind.Generate, ... };
return this.executeCommand("Generate", input, generateCommand);
```
- Use generic params in signatures for better inference (e.g., `commandName: K` not `commandName: string`)

### Design for Hover Clarity
Design function signatures so hovering at call sites shows narrow, specific types — not wide unions. This aids readability and debugging.
```typescript
// ❌ BAD - commandName: string loses inference anchor
private executeCommand<K extends CommandKind>(
    commandName: string,  // hover shows union of all CommandInput variants
    input: CommandInput<K>,
    commandFn: CommandFn<K>,
)

// ✅ GOOD - commandName: K anchors inference
private executeCommand<K extends CommandKind>(
    commandName: K,  // hover shows exact literal, e.g. "Generate"
    input: CommandInput<K>,
    commandFn: CommandFn<K>,
)
```
General principle: if hovering shows a union where you expect a specific type, find an inference anchor (literal arg, const assertion, or explicit generic) to narrow it.

### Keep Return Types for Callback Inference
When a return type provides inference for callback parameters, keep the explicit annotation:
```typescript
// ❌ BAD - payload becomes `any`, inference doesn't flow into callbacks
createHandler() {
    return {
        handle: (payload) => { ... }  // payload: any
    };
}

// ✅ GOOD - return type flows into callback param
createHandler(): EventHandler<WikilinkClickPayload> {
    return {
        handle: (payload) => { ... }  // payload: WikilinkClickPayload
    };
}
```

### Keep Return Types for Alias Clarity
When a type alias exists for a union, keep the explicit return type — inference expands to structural noise:
```typescript
// ❌ BAD - inferred type expands alias into structural union
function getEventFromSplitPath(event: VaultEvent) {
    // hover shows:
    // { basename: string; pathParts: string[]; kind: "Folder"; }
    // | { basename: string; pathParts: string[]; extension: string; kind: "File"; }
    // | { basename: string; pathParts: string[]; extension: "md"; kind: "MdFile"; }
    // | undefined
}

// ✅ GOOD - alias preserves readability
function getEventFromSplitPath(event: VaultEvent): AnySplitPath | undefined {
    // hover shows: AnySplitPath | undefined
}
```

### Logging Rules (.cursor/rules/logging.mdc)
- **Use** `logger` from `src/utils/logger`, not `console.*`
- **No manual stringify**: Logger handles object serialization internally
- Log levels: `info()`, `warn()`, `error()`
- Example:
```typescript
// ❌ BAD
console.log("event", event);
logger.info("event", JSON.stringify(event));  // redundant stringify

// ✅ GOOD
logger.info("[myFn] event:", event);
logger.error("Failed:", error instanceof Error ? error.message : String(error));
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

## Refactoring Infrastructure

### New Modules Added
These modules consolidate duplicated logic and improve error handling:

### Test Coverage
Tests added in `tests/unit/paths/`, `tests/specs/healing/`, `tests/specs/vault-actions/`, `tests/specs/tree/`
