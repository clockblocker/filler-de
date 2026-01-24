# UserEventInterceptor Overview

## Purpose

Intercept DOM/editor events, transform them through a behavior chain, then execute default actions. Enables plugin features (metadata stripping, smart selection) without modifying Obsidian core.

## Flow

```
DOM Event → Detector → Codec.encode() → Payload → Behavior Chain → Default Action
                                            ↓
                              [proceedWithDefault | continue | skip | replace]
```

## Key Concepts

| Concept | Role |
|---------|------|
| **Detector** | Captures raw DOM events (clicks, keyboard, clipboard) |
| **Codec** | Encodes raw event → structured payload; decodes payload → DOM mutation |
| **Payload** | Typed event data with `kind` discriminator and file context |
| **Behavior** | Sync `isApplicable()` check + async `transform()` that returns chain instruction |
| **Chain** | Runs behaviors by priority; stops on `skip`/`replace`, passes data on `continue` |

## Transform Results

- `proceedWithDefault` — no change, next behavior
- `continue` — pass transformed payload to next behavior
- `skip` — stop chain, prevent default, do nothing
- `replace` — stop chain, run custom action instead

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

## Registration

```typescript
const registry = interceptor.getBehaviorRegistry();
registry.register(PayloadKind.ClipboardCopy, {
  id: "librarian:strip-metadata",
  priority: 10,  // 1-50 core, 50-100 plugins
  isApplicable: (p) => isInLibrary(p.splitPath),  // SYNC
  transform: (ctx) => ({
    kind: "continue",
    data: { ...ctx.data, modifiedText: stripped }
  })
});
```

## Legacy Support

`subscribe()` method bridges old event pattern via `LegacyBridge`. Behaviors registered at priority 100 convert new payloads to old `UserEvent` format.
