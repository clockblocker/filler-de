# UserEventInterceptor Overview

## Purpose

Intercept DOM/editor events, check if a handler applies, then execute transformations. Enables plugin features (metadata stripping, smart selection) without modifying Obsidian core.

## Flow

```
DOM Event → Detector → Codec.encode() → Payload → Handler.doesApply()?
                                                      ↓
                                            yes: preventDefault → Handler.handle()
                                            no:  native behavior proceeds
                                                      ↓
                                            HandleResult → Codec.decode() / apply
```

## Key Concepts

| Concept | Role |
|---------|------|
| **Detector** | Captures raw DOM events (clicks, keyboard, clipboard) |
| **Codec** | Encodes raw event → structured payload; decodes result → DOM mutation |
| **Payload** | Typed event data with `kind` discriminator and file context |
| **Handler** | Sync `doesApply()` check + async `handle()` that returns result |
| **HandleResult** | `handled` / `passthrough` / `modified` with optional data |

## HandleResult Outcomes

- `handled` — event consumed, no further action
- `passthrough` — let native behavior happen (or do nothing if already prevented)
- `modified` — apply transformed payload (e.g., modified clipboard text, custom selection)

## Events Handled

| Event | Trigger | Use Case |
|-------|---------|----------|
| ClipboardCopy | copy/cut | Strip metadata from copied text |
| CheckboxClicked | task checkbox | Update codex completion status |
| CheckboxInFrontmatterClicked | property checkbox | Toggle node completion |
| SelectAll | Cmd+A | Exclude frontmatter from selection |
| WikilinkCompleted | `]]` typed | Auto-insert display alias |
| SelectionChanged | mouse/keyboard | Toolbar visibility |
| ActionElementClicked | [data-action] | Button handlers |

## Handler Registration

One handler per event type. Handler decides whether to intercept.

```typescript
interceptor.setHandler(PayloadKind.ClipboardCopy, {
  doesApply: (payload) => isInLibrary(payload.splitPath),  // SYNC
  handle: (payload, ctx) => {
    const stripped = stripMetadata(payload.originalText);
    if (stripped === payload.originalText) {
      return { outcome: "Passthrough" };
    }
    return { outcome: "Modified", data: { ...payload, modifiedText: stripped } };
  }
});
```

## Handler Interface

```typescript
type EventHandler<P extends AnyPayload> = {
  doesApply: (payload: P) => boolean;  // SYNC - checked before preventDefault
  handle: (payload: P, ctx: HandlerContext) => HandleResult<P> | Promise<HandleResult<P>>;
};

type HandleResult<P> =
  | { outcome: "Handled" }
  | { outcome: "Passthrough" }
  | { outcome: "Modified"; data: P };
```

## Architecture

```
UserEventInterceptor
├── setHandler(kind, handler) — register ONE handler per event kind
├── startListening() / stopListening()
└── Detectors (receive invoker callback)
    ├── ClipboardDetector
    ├── CheckboxClickedDetector
    ├── CheckboxFrontmatterDetector
    ├── SelectAllDetector
    ├── SelectionChangedDetector
    ├── WikilinkDetector
    └── ActionElementDetector
```

Consumers (e.g., Librarian) register handlers; interceptor is pure detection layer.
