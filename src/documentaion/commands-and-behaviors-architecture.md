# Commands & Behaviors — Architecture

> **Scope**: This document covers `command-executor/` and `behavior-manager/` — the layer between raw user events and the two commanders (Librarian, Textfresser). For the event detection layer, see `UserEventInterceptor`. For the file system layer, see `vam-architecture.md`.

---

## 1. Purpose

These two sibling modules bridge **user intent** (menu clicks, keyboard shortcuts, DOM events) to **commander logic** (Librarian tree ops, Textfresser vocabulary ops):

1. **`command-executor/`** — palette/menu-triggered actions dispatched by `CommandKind` to the right commander.
2. **`behavior-manager/`** — DOM-event-driven handlers registered with `UserEventInterceptor`, implementing the two-phase `doesApply` / `handle` protocol.

The two modules have zero cross-references — they are fully independent concerns.

---

## 2. Directory Structure

```
src/managers/obsidian/
├── command-executor/
│   ├── index.ts                   (barrel)
│   ├── types.ts                   (CommandKind, CommandContext)
│   └── create-command-executor.ts (factory → executeCommand closure)
├── behavior-manager/
│   ├── index.ts                   (barrel)
│   ├── create-handlers.ts         (HandlerDef[] factory for main.ts registration)
│   ├── chain-utils.ts             (chainHandlers — first-match combinator)
│   ├── clipboard-behavior.ts      (strip metadata from clipboard copy)
│   ├── select-all-behavior.ts     (smart select-all excluding frontmatter/metadata)
│   ├── checkbox-behavior.ts       (frontmatter property checkbox → Librarian)
│   ├── codex-checkbox-behavior.ts (codex task checkbox → Librarian)
│   ├── wikilink-complition-behavior.ts (wikilink auto-completion → Librarian)
│   ├── tag-line-copy-embed-behavior.ts (tag line with block ID, copy embed)
│   └── pick-closest-leaf.ts       (helper: disambiguate multiple wikilink targets by path proximity)
├── user-event-interceptor/        (unchanged — event detection layer)
├── vault-action-manager/          (unchanged — FS abstraction layer)
└── workspace-navigation-event-interceptor/ (unchanged)
```

---

## 3. Commands

**Source**: `command-executor/`

### 3.1 CommandKind

`CommandKind` is a Zod enum merging all Librarian and Textfresser command kind strings:

```
Librarian:   GoToPrevPage, GoToNextPage, MakeText, SplitToPages, SplitInBlocks
Textfresser: TranslateSelection, Generate, Lemma
```

### 3.2 CommandContext

Collected once per invocation by `collectContext()`:

| Field | Type | Source |
|-------|------|--------|
| `activeFile` | `{ splitPath, content } \| null` | `vam.mdPwd()` + `vam.getOpenedContent()` |
| `selection` | `SelectionInfo \| null` | `vam.selection.getInfo()` |

### 3.3 createCommandExecutor

Factory that closes over `{ librarian, textfresser, vam }` and returns an `executeCommand(kind)` function. Internally:

1. Calls `collectContext()` to snapshot active file + selection.
2. Switches on `CommandKind`, delegating to the appropriate commander's `executeCommand(kind, context, notify)`.
3. Exhaustive `never` check on default branch.

**Consumers**: `main.ts` (creates executor at init), `OverlayManager` (holds executor ref for toolbar/menu clicks).

---

## 4. Behaviors

**Source**: `behavior-manager/`

Behaviors implement the `EventHandler<P>` protocol from `UserEventInterceptor`:

```typescript
interface EventHandler<P> {
    doesApply(payload: P): boolean;       // SYNC — gates preventDefault
    handle(payload: P, ctx): HandleResult; // ASYNC — performs the action
}
```

Three possible outcomes: `Handled` (consumed), `Passthrough` (native behavior), `Modified` (transform payload).

### 4.1 Handler Registration

`createHandlers(librarian, textfresser?)` builds the `HandlerDef[]` array that `main.ts` registers with `UserEventInterceptor`. Each def maps a `PayloadKind` to its handler.

### 4.2 Stateless Behaviors (no commander dependency)

| Behavior | PayloadKind | What it does |
|----------|-------------|-------------|
| **clipboard** | `ClipboardCopy` | Strips go-back links and metadata sections from copied text. Returns `Modified` with `modifiedText` if anything was stripped, `Passthrough` otherwise. |
| **select-all** | `SelectAll` | Computes a "smart" selection range excluding YAML frontmatter, go-back links, and the metadata section. Returns `Modified` with `customSelection: { from, to }`. |

### 4.3 Librarian Behaviors (thin routing)

| Behavior | PayloadKind | Guard (`doesApply`) | Delegation |
|----------|-------------|---------------------|------------|
| **codex-checkbox** | `CheckboxClicked` | `librarian.isCodexInsideLibrary(splitPath)` | `librarian.handleCodexCheckboxClick(payload)` |
| **checkbox-frontmatter** | `CheckboxInFrontmatterClicked` | Always applies | `librarian.handlePropertyCheckboxClick(payload)` |
| **wikilink-completion** | `WikilinkCompleted` | Always applies | Three-step resolution: suffix alias → Obsidian resolve → corename tree lookup (uses `pickClosestLeaf` for disambiguation) |

### 4.4 Textfresser Behavior

| Behavior | PayloadKind | Source |
|----------|-------------|--------|
| **wikilink-click** | `WikilinkClicked` | Registered only if `textfresser` is provided. `textfresser.createHandler()` delegates to `orchestration/handlers/wikilink-click-handler.ts`. Tracks wikilink clicks for attestation context and triggers deferred scroll via background-generate coordinator when the clicked target matches the in-flight Generate target. |

### 4.5 Standalone Behavior

| Behavior | Trigger | What it does |
|----------|---------|-------------|
| **tag-line-copy-embed** | Command palette (not a `PayloadKind` handler) | Adds a `^blockId` marker to the current line if missing, copies `![[basename#^blockId]]` embed to clipboard. |

### 4.6 Utilities

| Utility | Purpose |
|---------|---------|
| `chainHandlers(...handlers)` | Combines multiple `EventHandler<P>` into one — first handler whose `doesApply` returns true wins. |
| `pickClosestLeaf(matches, currentPathParts)` | Picks the best wikilink target from multiple tree matches by longest common path prefix. Tie-break: shallower depth. |

---

## 5. Data Flow

```
                          ┌──────────────────────────────┐
                          │        main.ts (init)        │
                          │                              │
                          │  executor = createCommand-   │
                          │    Executor({librarian,      │
                          │     textfresser, vam})       │
                          │                              │
                          │  handlers = createHandlers(  │
                          │    librarian, textfresser)   │
                          └──────┬──────────┬────────────┘
                                 │          │
              ┌──────────────────┘          └──────────────────┐
              ▼                                                ▼
   ┌─────────────────────┐                     ┌──────────────────────────┐
   │   Commands path     │                     │   Behaviors path         │
   │  (command-executor/) │                     │  (behavior-manager/)     │
   │                     │                     │                          │
   │ Menu/palette click  │                     │ DOM event detected by    │
   │        │            │                     │ UserEventInterceptor     │
   │        ▼            │                     │        │                 │
   │ executor(kind)      │                     │        ▼                 │
   │   collectContext()  │                     │ handler.doesApply(p)     │
   │   switch(kind)      │                     │   │ true → handle(p)    │
   │        │            │                     │   │ false → next handler │
   │   ┌────┴────┐       │                     │        │                 │
   │   ▼         ▼       │                     │   ┌────┴────┐            │
   │ librarian textfresser                     │ Handled  Modified        │
   └─────────────────────┘                     │         Passthrough      │
                                               └──────────────────────────┘
```
