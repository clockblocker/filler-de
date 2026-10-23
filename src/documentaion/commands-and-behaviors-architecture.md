# Command and behavior architecture

This document describes the boundary between user input and the Librarian, Classify, and Textfresser commanders.

## Entry paths

| Path | Trigger | Responsibility |
| --- | --- | --- |
| Command executor | Command palette, menu, or toolbar | Collect one context snapshot and route a `CommandKind`. |
| Behavior manager | Editor or DOM event | Check whether a handler applies and process the event. |

The two paths do not call each other.

## Commands

The palette commands are one table in `src/plugin/register-commands.ts`: each entry is an id, a name, whether it needs a Markdown editor, and its Effect. The launch registers them through `PluginHost.command` (`src/managers/obsidian/host/`), in the scope it builds the services in, so unloading removes them: `launchCommands` (Restart Librarian, Copy recent trace) before it builds the services, so a build that fails still leaves them, and `serviceCommands` once it built them. Each invocation runs on the plugin runtime under a `command.<id>` root span, such as `command.classify-selection`. An editor command reads the editor through VAM, not from Obsidian's callback.

`createCommandExecutor({ classify, librarian, notices, textfresser, vam })` returns `commandProgram(kind)`, the Effect of a `CommandKind`. The table's editor commands run it, and so do the toolbars and the editor menu, under `command.<kind>` (`src/runtime/plugin-runtime.ts`).

For each command, the executor:

1. Reads the active Markdown path and content from VAM.
2. Reads the current selection from VAM.
3. Routes Librarian commands to `Librarian.executeCommand`.
4. Routes `Classify` to `ClassifyCommander.execute` and `TranslateSelection` to `Textfresser.executeCommand`.
5. Returns the command's Effect; the plugin runtime runs it at the Obsidian boundary.

The context is a snapshot. A commander must not read the editor again to reconstruct the same input.

Page navigation (`GoToPrevPage`, `GoToNextPage`) needs only the note, so its context comes from `mdPwd` and `readContent`, with no selection; it works in reading view, where the bottom toolbar's page buttons also show. The other commands read the editor's context, which reading view does not have: there the executor shows a Notice asking to switch to editing view.

| Owner | Commands |
| --- | --- |
| Librarian | `GoToPrevPage`, `GoToNextPage`, `SplitToPages`, `SplitInBlocks` |
| Classify | `Classify` |
| Textfresser | `TranslateSelection` |

## Behaviors

`createHandlers(librarian, userEvent, onWikilinkClicked?)` creates the handlers that `main.ts` registers with `UserEventInterceptor`. A handler that runs an Effect hands it to `userEvent`, which runs it on the plugin runtime under a `user-event.<kind>` root span.

| Event | Handler behavior |
| --- | --- |
| `ClipboardCopy` | Remove Librarian metadata from copied text. |
| `SelectAll` | Exclude frontmatter, go-back links, and metadata. |
| `WikilinkCompleted` | Land a bare word typed outside `Worter/` on its Crossroad note's path (ADR-0015); otherwise ask the Librarian to resolve a Library target. |
| `CheckboxFrontmatterClicked` | Route the status change to the Librarian. |
| `CheckboxClicked` | Route a Codex status change to the Librarian. |
| `WikilinkClicked` | Tell Classify the clicked target, so a link to a Reading whose Knowledge is still generating scrolls to it once it lands. |

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
| Obsidian host services (`PluginHost`, `Notices`, `HttpTransport`) | `src/managers/obsidian/host/` |
| Behavior routing | `src/managers/obsidian/behavior-manager/` |
| Event detection | `src/packages/composed/obsidian-event-layer/` |
| Plugin wiring | `src/main.ts` |
| Plugin lifecycle (launch, Librarian restarts, unload) | `src/lifecycle/` |
| Palette commands, settings reactions | `src/plugin/` |
