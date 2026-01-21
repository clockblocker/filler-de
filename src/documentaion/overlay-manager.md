# OverlayManager Architecture

UI overlay system with commander-based action providers.

## Purpose

Unified facade for all UI overlays (bottom toolbar, selection toolbar, edge zones). Replaces the old ButtonManager with a commander-query architecture.

## Architecture

```
User Behavior (select, navigate, resize)
           ↓
    OverlayManager
           ↓
    builds OverlayContext
           ↓
    queries CommanderActionProviders
           ↓
    CommanderAction[]
           ↓
    renders UI (toolbars, edge zones)
           ↓
    user clicks
           ↓
    ActionExecutorRegistry[kind](params, services)
```

## Key Components

### OverlayManager
`src/services/obsidian-services/overlay-manager/overlay-manager.ts`

- Subscribes to user behaviors (selection, navigation, resize, layout changes)
- Builds `OverlayContext` from app state
- Queries registered `CommanderActionProvider`s for actions
- Delegates rendering to toolbar services
- Handles clicks → dispatches to executor registry

### CommanderActionProvider Interface
```typescript
interface CommanderActionProvider {
  id: string;           // "librarian", "futureCommander"
  priority: number;     // 1 = highest (processed first)
  getAvailableActions(context: OverlayContext): CommanderAction[];
}
```

Commanders implement this to provide UI actions. Lower priority = processed first.

### CommanderAction
```typescript
type CommanderAction<K extends ActionKind> = {
  kind: K;                    // Action type
  params: ActionParams[K];    // Typed params per kind
  label: string;
  priority: number;           // 1-10, within commander
  placement: ActionPlacement; // "bottom" | "selection" | "edge"
  disabled?: boolean;
  id: string;                 // Unique identifier
}
```

### ActionKind & ActionParams
```typescript
const ActionKind = {
  NavigatePage: "NavigatePage",
  MakeText: "MakeText",
  SplitToPages: "SplitToPages",
  TranslateSelection: "TranslateSelection",
  ExplainGrammar: "ExplainGrammar",
  SplitInBlocks: "SplitInBlocks",
  Generate: "Generate",
  Custom: "custom",           // Escape hatch for inline callbacks
} as const;

type ActionParams = {
  NavigatePage: { direction: "next" | "prev" };
  MakeText: {};
  SplitToPages: {};
  // ... each kind has typed params
  custom: { execute: () => void };  // Inline callback
}
```

### ActionExecutorRegistry
`src/services/obsidian-services/overlay-manager/executor-registry.ts`

Maps action kinds to execution logic:
```typescript
const executors = {
  [ActionKind.NavigatePage]: (params, services) => navigatePageAction(services, params.direction),
  [ActionKind.MakeText]: (params, services) => makeTextAction(services),
  // ...
  [ActionKind.Custom]: (params) => params.execute(),  // Escape hatch
}
```

### OverlayContext
```typescript
type OverlayContext = {
  path: AnySplitPath | null;
  fileType: FileType | null;
  hasSelection: boolean;
  isMobile: boolean;
  isInLibrary: boolean;
  wouldSplitToMultiplePages: boolean;
  pageIndex: number | null;
  hasNextPage: boolean;
  viewportWidth: number;
  isSourceMode: boolean;
}
```

## LibrarianActionProvider

`src/services/obsidian-services/overlay-manager/librarian-action-provider.ts`

Default provider implementing all current actions:

| Action | Placement | Condition |
|--------|-----------|-----------|
| PreviousPage | bottom | Page file, disabled if first |
| NavigatePage | bottom | Page file, disabled if no next |
| SplitToPages | bottom | Scroll file, no selection |
| MakeText | bottom | No type OR Scroll with multi-page |
| Generate | bottom | Selection + in library |
| TranslateSelection | selection | Has selection |
| SplitInBlocks | selection | Selection + in library |
| ExplainGrammar | selection | Selection + in library |

## Hybrid Action Design

Standard actions use typed `kind` + `params` for observability (logging, analytics, serialization).

Custom actions use inline `execute()` callback as escape hatch for commander-specific one-offs.

Gradual migration: start with `custom`, promote to named `kind` when stable.

## Toolbar Services (Reused)

OverlayManager delegates rendering to existing services:
- `BottomToolbarService` - Bottom bar with overflow menu
- `AboveSelectionToolbarService` - Floating selection toolbar
- `EdgePaddingNavigator` - Edge zone navigation (readable-line-width mode)
- `NavigationLayoutCoordinator` - Coordinates edge zones vs bottom buttons

## Adding New Actions

1. Add to `ActionKind` enum in `types.ts`
2. Add typed params to `ActionParams` type
3. Add executor to `executor-registry.ts`
4. Add availability logic to relevant `CommanderActionProvider`

Or use `ActionKind.Custom` for quick prototyping:
```typescript
actions.push({
  kind: ActionKind.Custom,
  params: { execute: () => doSomething() },
  label: "My Action",
  // ...
});
```

## Adding New Commanders

```typescript
class MyCommanderProvider implements CommanderActionProvider {
  readonly id = "my-commander";
  readonly priority = 2;  // After Librarian (priority 1)

  getAvailableActions(ctx: OverlayContext): CommanderAction[] {
    if (!ctx.someCondition) return [];
    return [{
      kind: ActionKind.MyAction,
      params: { /* typed */ },
      label: "Do Thing",
      priority: 1,
      placement: ActionPlacement.Bottom,
      id: "MyAction",
    }];
  }
}

// In main.ts:
overlayManager.registerProvider(new MyCommanderProvider());
```

## Relation to UserEventInterceptor

**OverlayManager** = UI button overlays (user clicks toolbar buttons)
**UserEventInterceptor** = DOM/editor events (checkboxes, clipboard, wikilinks)

These are separate systems:
- OverlayManager handles explicit UI actions
- UserEventInterceptor handles implicit user interactions for Librarian

## Files

```
src/services/obsidian-services/overlay-manager/
├── index.ts                      # Exports
├── types.ts                      # OverlayContext, CommanderAction, ActionKind, etc.
├── overlay-manager.ts            # Main facade
├── executor-registry.ts          # Action execution
└── librarian-action-provider.ts  # Default Librarian actions
```
