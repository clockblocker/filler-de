# Command and behavior architecture

This document describes the boundary between user input and the Librarian or Textfresser commanders.

## Entry paths

| Path | Trigger | Responsibility |
| --- | --- | --- |
| Command executor | Command palette, menu, or toolbar | Collect one context snapshot and route a `CommandKind`. |
| Behavior manager | Editor or DOM event | Check whether a handler applies and process the event. |

The two paths do not call each other.

## Commands

`createCommandExecutor({ librarian, textfresser, vam })` returns `executeCommand(kind)`.

For each command, the executor:

1. Reads the active Markdown path and content from VAM.
2. Reads the current selection from VAM.
3. Routes Librarian commands to `Librarian.executeCommand`.
4. Routes vocabulary commands to `Textfresser.executeCommand`.
5. Runs the returned Effect at the Obsidian boundary.

The context is a snapshot. A commander must not read the editor again to reconstruct the same input.

| Owner | Commands |
| --- | --- |
| Librarian | `GoToPrevPage`, `GoToNextPage`, `SplitToPages`, `SplitInBlocks` |
| Textfresser | `TranslateSelection`, `Generate`, `Lemma` |

## Behaviors

`createHandlers(librarian, textfresser?)` creates the handlers that `main.ts` registers with `UserEventInterceptor`.

| Event | Handler behavior |
| --- | --- |
| `ClipboardCopy` | Remove Librarian metadata from copied text. |
| `SelectAll` | Exclude frontmatter, go-back links, and metadata. |
| `WikilinkCompleted` | Ask the Librarian to resolve a Library target. |
| `CheckboxFrontmatterClicked` | Route the status change to the Librarian. |
| `CheckboxClicked` | Route a Codex status change to the Librarian. |
| `WikilinkClicked` | Let Textfresser track attestation and deferred navigation. |

A handler has two stages:

```ts
doesApply(payload): boolean
handle(payload, context): HandleResult
```

`doesApply` must be synchronous because it controls event cancellation. `handle` returns an outcome of `handled`, `effect`, or `passthrough`. An `effect` outcome carries a typed editor change.

`chainHandlers` uses the first handler for which `doesApply` returns `true`. A handler must return `passthrough` when it cannot make a safe choice. For example, wikilink completion must not select an ambiguous Library leaf.

## Boundaries

- `@textfresser/obsidian-event-layer` detects events. It does not own application policy.
- The command executor and behavior manager only collect input and route it.
- Librarian and Textfresser own domain decisions.
- VAM owns vault and active-editor access.

## Source map

| Area | Location |
| --- | --- |
| Command routing | `src/managers/obsidian/command-executor/` |
| Behavior routing | `src/managers/obsidian/behavior-manager/` |
| Event detection | `src/packages/composed/obsidian-event-layer/` |
| Plugin wiring | `src/main.ts` |
