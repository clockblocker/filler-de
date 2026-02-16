# Textfresser - German Vocabulary Dictionary Plugin for Obsidian

Obsidian plugin for building a German vocabulary dictionary with AI-powered translations via Gemini API.

## Core Rules

- Always read files before editing them. Never attempt to edit a file you haven't read in the current session.
- For multi-part requests, complete each part fully before moving to the next. If a session may end, prioritize finishing the current subtask over starting the next one.

## Commands

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
```

## Architecture

### Entry Point
`src/main.ts` → `TextEaterPlugin` → deferred init via `initWhenObsidianIsReady()`

### Managers (src/managers/)
| Manager | Path | Purpose |
|---------|------|---------|
| VaultActionManager | `obsidian/vault-action-manager/` | FS abstraction, action dispatch, bulk events |
| UserEventInterceptor | `obsidian/user-event-interceptor/` | DOM/editor events (click, clipboard, select-all, wikilink) |
| WorkspaceEventInterceptor | `obsidian/workspace-navigation-event-interceptor/` | Workspace events (file open, layout, scroll) |
| OverlayManager | `overlay-manager/` | UI overlays (toolbars, edge zones, context menu) |
| CommandExecutor | `obsidian/command-executor/` | CommandKind dispatch to commanders |
| BehaviorManager | `obsidian/behavior-manager/` | DOM-event handlers (checkbox, clipboard, select-all, wikilink) |

### Commanders (src/commanders/)
| Commander | Files | Purpose |
|-----------|-------|---------|
| Librarian | ~170 files | Tree management, healing, codex generation |
| Textfresser | ~48 files | Vocabulary commands (Generate, Translate) |

### Stateless Helpers (src/stateless-helpers/)
- `note-metadata/` - Format-agnostic metadata read/write
- `go-back-link/` - Go-back link helpers
- `api-service.ts` - Gemini API wrapper
- `block-id.ts`, `wikilink.ts`, `markdown-strip.ts`

#### Stateless Helpers Philosophy
- Consolidate small/generally applicable formatting and utils under `xxxHelper` facade
- Access methods via `xxxHelper.methodName()` pattern
- If functionality related to xxx is needed, implement it in the xxxHelper - don't scatter logic
- Avoid magic casts and regexes in main codebase - encapsulate them in helpers

Example - `wikilinkHelper` encapsulates wikilink regex parsing:
```typescript
// ❌ BAD - regex scattered in main code
const match = text.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g);

// ✅ GOOD - clean facade method
const links = wikilinkHelper.parse(text);  // returns ParsedWikilink[]
const link = wikilinkHelper.findByTarget(text, "MyNote");
```

### Documentation (src/documentaion/)
- `librarian-architecture.md` - Main architecture doc
- `e2e-architecture.md` - E2E test architecture
- `vam-architecture.md` - VAM dispatch, event pipeline, self-event tracking
- `textfresser-architecture.md` - Textfresser commands, generate pipeline
- `commands-and-behaviors-architecture.md` - Command executor + behavior manager
- `linguistics-and-prompt-smith-architecture.md` - Linguistics pipeline, prompt-smith

**Keep these docs up to date**: when changing behavior documented in `src/documentaion/`, update the relevant doc in the same PR.

## Non-Obvious Flows

### 1. Event Flow: Interceptor → Handler → Commander

**TLDR**: DOM events get encoded into typed payloads, handlers decide sync if they apply, then async delegate to commanders.

```
DOM Event → Detector (encode) → Handler.doesApply (SYNC gate) → Handler.handle (ASYNC) → Commander
```

**Key mechanics:**
- **Detectors** (`user-event-interceptor/events/`) capture raw events, encode into `Payload` via `Codec`
- **Two-phase handler**: `doesApply()` is SYNC (for `preventDefault`), `handle()` is ASYNC
- **Three outcomes**: `Handled` (consumed), `Passthrough` (native + clipboard), `Modified` (transform payload)
- **Handler registration**: `createHandlers()` in `managers/obsidian/behavior-manager/` maps `PayloadKind` → handler
- **Stateless handlers**: clipboard, select-all (pure transforms, no commander)
- **Stateful handlers**: route to Librarian (checkbox, wikilink) or Textfresser (wikilink click tracking)

**Example - Checkbox click**:
1. `CheckboxClickedDetector` captures mousedown, extracts line content + checkbox state
2. `CheckboxCodec.encode()` → `CheckboxPayload { kind, checked, lineContent, splitPath }`
3. `createCodexCheckboxHandler.doesApply()` checks `librarian.isCodexInsideLibrary()`
4. If applies: `preventDefault()`, then `librarian.handleCodexCheckboxClick(payload)`
5. Librarian parses line, builds `ChangeStatusAction`, enqueues to `actionQueue`

### 2. VAM Dispatch Processing

**TLDR**: Actions go through queue → ensure requirements → collapse → dependency sort → execute → filter self-events.

```
dispatch(actions) → ActionQueue → Dispatcher Pipeline → Execute → SelfEventTracker filters echoes
```

**Dispatcher pipeline stages:**
1. **Ensure requirements**: Auto-insert `CreateFolder` for missing parents, filter invalid deletes
2. **Collapse**: Dedupe by path, compose multiple `ProcessMdFile` transforms, "trash wins" semantics
3. **Dependency graph**: `ProcessMdFile` depends on `UpsertMdFile`, files depend on parent folders
4. **Topological sort**: Kahn's algorithm, tie-break by path depth (shallow first)
5. **Execute**: Sequential execution respecting sort order, collect errors

**Event coalescing (BulkEventAccumulator):**
- Quiet window: 250ms (flush when no new events)
- Max window: 2000ms (force flush)
- Collapse rename chains: A→B + B→C = A→C
- Reduce roots: folder rename covers descendant renames, folder delete covers descendant deletes

**Self-event filtering:**
- Register all paths before execution with TTL=5s
- On Obsidian event: check `shouldIgnore()` → exact match (pop) or prefix match (for folders)
- Prevents feedback loops from our own dispatches

### 3. Librarian Healing & Codex Generation

**TLDR**: Healing enforces filename⇄path invariant. Codex = auto-generated section index with checkboxes.

```
BulkVaultEvent → TreeActions → Healer.apply() → HealingActions + CodexImpact → VaultActions
```

**What is healing?**
- **Invariant**: File basename suffix must match folder path chain
- Example: `Library/A/B/Note.md` → canonical name `Note-B-A.md`
- User renames/moves file → system computes canonical path → generates rename action

**Healing flow:**
1. `buildTreeActions()` converts vault events with **policy inference**:
   - **NameKing**: suffix defines path (flat files)
   - **PathKing**: folder path defines suffix (nested files)
2. `Healer.getHealingActionsFor(action)` returns `{ healingActions, codexImpact }`
3. For rename/move: compute descendant suffix healing recursively
4. `HealingTransaction` wraps operations, collects actions atomically

**What is a codex?**
- Auto-generated markdown index for each section folder
- Filename: `__-SectionSuffix.md` (e.g., `__-Pie-Recipe.md`)
- Content: checkbox list of children (scrolls, files, nested sections)
- Status aggregation: section checkbox = all descendants done?

**Codex generation:**
1. `EnsureCodexFileExists` - create if missing
2. `ProcessCodex` - regenerate children list via `generateCodexContent()`
3. `WriteScrollStatus` - update descendant scroll metadata on status change
4. Backlink healing (separate phase) - adds `[[__suffix|← Parent]]` go-back links

**Incremental updates**: Only impacted sections regenerated (O(k) not O(n))

## Key Patterns

### Result Types (neverthrow)
```typescript
// Chain with andThen, single error log at end
const result = await stepA(ctx)
    .andThen(stepB)
    .asyncAndThen(stepC);
if (result.isErr()) {
    logger.warn("[fn] Failed:", result.error);
    return result;
}
```

### Type Safety
- Avoid `as`/`any` except undocumented Obsidian APIs (must comment why)
- Use Zod for runtime validation
- Trust switch narrowing - no redundant casts

### Avoiding Non-Null Assertions (`!`)
Never use `!` — the linter bans `noNonNullAssertion`. Patterns to use instead:
- **Array after length check**: accept `NonEmptyArray<T>` (from `types/helpers`) so `arr[0]` is `T` not `T | undefined`. Callers use `nonEmptyArrayResult()` (from `types/utils`) to narrow.
- **Array index in loop**: `const x = arr[i]; if (!x) continue;` — truthiness guard.
- **Regex capture groups**: `match?.[1] ?? null` instead of `match[1]!`.
- **Pipeline-guaranteed state**: narrow the type at the validation step's return type (e.g. `checkLemmaResult` returns `CommandStateWithLemma` where `latestLemmaResult: LemmaResult` is non-optional). Downstream steps accept the narrowed type — no `!` needed.

### Zod: Use v3 Import
The project uses Zod v4, but all application code imports **v3** compat:
```typescript
import { z } from "zod/v3";  // ✅ always use this
import { z } from "zod";     // ❌ this is v4 — don't use
```
Reason: `prompt-smith` / AI API code relies on v3 semantics (e.g. `z.record(valueSchema)` takes one arg for value, `.passthrough()` not deprecated).

### Logging
- Use `logger` from `src/utils/logger`, NOT console.*
- **No manual stringify**: Logger handles object serialization internally
- Log levels: `info()`, `warn()`, `error()`

## Plan Mode

When entering plan mode for implementation tasks:
- Keep plans concise - bullet points, not essays
- List unresolved questions explicitly before exiting
- Reference specific files that will be modified



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

## TypeScript / Refactoring

When refactoring across module boundaries, verify type compatibility at integration points before committing. Pay special attention to version mismatches (e.g., Zod v3 vs v4 types) and add explicit type assertions with comments when bridging version boundaries.

## Implementation Guidelines

When implementing algorithms with numeric thresholds (e.g., merge distances, similarity scores), default to more aggressive/generous values and note the threshold as a tunable parameter with a TODO comment. Ask the user for sample data to calibrate if possible.
