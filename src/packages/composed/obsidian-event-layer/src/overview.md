# obsidian-event-layer

## Purpose

Intercept DOM and editor events, ask whether a handler takes each, and run the handler on the host's Effect runtime. Enables plugin features (metadata stripping, smart select-all, wikilink landing, Codex checkboxes, toolbars) without modifying Obsidian core.

## Flow

```
DOM / editor event → Detector → Codec.encode() → Payload → handler.doesApply()?   (plain, inside the event)
                                                     │
                                       no: native behaviour proceeds
                                       yes: preventDefault where the event needs it
                                                     │
                       host.fork(kind) ── one fiber, under user-event.<kind> ──┐
                       │ payload read (a completed link: VAM resolves it)      │
                       │ handler.handle(payload)  → UserEventResult            │
                       │ result applied: clipboard, selection, editor, link    │
                       │ handler.afterwards?(payload)                          │
                       └────────────────────────────────────────────────────────┘
```

The fork starts at once, inside the event, so a program that never waits is applied before the event's dispatch ends. A copy needs that: the clipboard is writable only during the event. A copy handler that waits finds the selection already copied as it is, and its answer is logged and dropped.

## Key Concepts

| Concept | Role |
|---------|------|
| **Detector** | Listens through the host while the layer's scope is open; reads the DOM and the active note, plain and synchronous |
| **Codec** | Encodes the raw event into a payload; applies a result to the DOM or editor |
| **Payload** | Typed event data with a `kind` and the note it came from |
| **Handler** | Plain `doesApply`, an Effect `handle`, and an optional Effect `afterwards` |
| **UserEventResult** | `handled`, `passthrough`, or `effect` with the change to apply |

## Outcomes

- `handled`: the event is consumed; nothing more is applied.
- `passthrough`: native behaviour, where the layer can still give it: a clipboard gets the selection as it is, and a clicked link is opened through the host's workspace.
- `effect`: a clipboard text, a selection, or an editor change.

## Events

| Event | Trigger | Traced | Use |
|-------|---------|--------|-----|
| ClipboardCopy | copy / cut with a selection | yes | Strip metadata from copied text |
| (block reference) | copy with no selection | — | A line ending in `^id` copies its embed; no handler |
| CheckboxClicked | task checkbox | yes | Codex status |
| CheckboxFrontmatterClicked | property checkbox | yes | No handler today; Obsidian toggles the property |
| SelectAll | Cmd/Ctrl+A in source mode | yes | Select a note's body only; native when there is nothing to exclude |
| WikilinkCompleted | `]]` typed, or a selection wrapped in `[[ ]]` | yes | Land a word on its Crossroad note, or a Library alias |
| WikilinkClicked | internal link, no modifier | yes | Reopen a Reading note once its Knowledge lands |
| SelectionChanged | mouseup / keyup / dragend | no: frequent | Toolbar visibility |
| ActionElementClicked | `[data-action]` | no: its command is its own root | Toolbar buttons |

## Host

`makeObsidianEventLayer(host)` is an Effect in a scope. `host` (`UserEventsHost`) gives:

- `listen` and `editorExtension`, the plugin host's, held in the scope: closing it removes every listener and switches the extension off;
- `fork`, which runs a handled event's program on the runtime, counted as pending work, its failure logged at its edge;
- `readSync`, for the selection a copy reads;
- `vam`, for that selection and for where a completed link resolves;
- `openLink`, for a clicked link a handler passes through;
- `app` and `document`, for the synchronous reads that decide an event.

The plugin builds it as the `UserEvents` Layer (`src/plugin/user-events.ts`).

## Handler Registration

One handler per kind; `setHandler` replaces the one before it and answers a teardown.

```typescript
layer.setHandler(UserEventKind.ClipboardCopy, {
  doesApply: () => true,                              // plain, inside the event
  handle: (payload) =>
    Effect.sync(() => {
      const stripped = strip(payload.originalText);
      return stripped === payload.originalText
        ? { outcome: "passthrough" }
        : { effect: { modifiedText: stripped }, outcome: "effect" };
    }),
});
```
