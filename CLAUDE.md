# Textfresser - German Vocabulary Dictionary Plugin for Obsidian

Obsidian plugin for building a German vocabulary dictionary with AI-powered translations via Gemini API.

## Commands

```bash
# Build
bun run build        # production
bun run dev          # watch mode
bun run build:dev    # dev + typecheck

# Test
bun test             # all (unit + e2e)
bun run test:unit    # unit only
bun run test:e2e     # e2e (builds first, launches Obsidian)
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
| ActionsManager | `actions-manager/` | Command executor factory |

### Commanders (src/commanders/)
| Commander | Files | Purpose |
|-----------|-------|---------|
| Librarian | ~270 files | Tree management, healing, codex generation |
| Textfresser | ~17 files | Vocabulary commands (Generate, Translate) |

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
- `librarian-architrecture.md` - Main architecture doc
- `librarian-pieces.md` - Refactoring details
- `e2e-architecture.md` - E2E test architecture

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
- **Handler registration**: `createHandlers()` in `actions-manager/behaviors/` maps `PayloadKind` → handler
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

### Logging
- Use `logger` from `src/utils/logger`, NOT console.*
- Stringify objects: `logger.info("data:", JSON.stringify(obj))`

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

