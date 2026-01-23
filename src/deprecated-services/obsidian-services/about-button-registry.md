# Button Registry System

Central system for managing toolbar buttons based on context. Buttons appear/disappear dynamically based on current file, selection state, and platform.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    ButtonRegistry                    │
│  - subscribes to active-leaf-change, selection       │
│  - evaluates ActionConfig.isAvailable predicates     │
│  - computes final action sets per placement          │
│  - emits: onBottomActionsChanged, onSelectionChanged │
└───────────────┬─────────────────────┬───────────────┘
                │                     │
     ┌──────────▼──────────┐   ┌──────▼──────────┐
     │ AboveSelectionSvc   │   │  BottomSvc      │
     │ (floating toolbar)  │   │  (+ edge btns)  │
     └─────────────────────┘   └─────────────────┘
```

## Key Components

### ButtonContext

Context built from current app state, passed to `isAvailable` predicates:

```ts
type ButtonContext = {
  path: AnySplitPath | null;  // Current file path
  fileType: FileType | null;  // Page, Scroll, Codex, etc.
  hasSelection: boolean;       // Text selected in editor
  isMobile: boolean;           // Running on mobile device
  isInLibrary: boolean;        // File inside library folder
};
```

### ActionConfig

Each action defines visibility via `isAvailable` predicate:

```ts
type ActionConfig = {
  id: UserAction;
  label: string;
  execute: (services) => void;
  placement: "AboveSelection" | "Bottom" | "ShortcutOnly";
  priority: number;  // Lower = higher priority (1-10)
  isAvailable: (ctx: ButtonContext) => boolean;
};
```

### ButtonRegistry

Location: `src/services/obsidian-services/button-registry.ts`

Responsibilities:
1. Build `ButtonContext` from current active file
2. Filter `ACTION_CONFIGS` by `isAvailable(ctx)`
3. Sort by priority
4. Group by placement
5. Notify subscribers when actions change

```ts
buttonRegistry.subscribeBottom((actions) => {
  bottomToolbarService.setActions(actions);
});

buttonRegistry.subscribeSelection((actions) => {
  selectionToolbarService.setActions(actions);
});
```

## Action Predicates

| Action | Predicate | Placement |
|--------|-----------|-----------|
| `SplitToPages` | `isInLibrary && fileType === Scroll && !hasSelection` | Bottom |
| `NavigatePage` | `fileType === Page` | Bottom (edge on desktop) |
| `PreviousPage` | `fileType === Page` | Bottom (edge on desktop) |
| `TranslateSelection` | `hasSelection` | AboveSelection |
| `ExplainGrammar` | `hasSelection && isInLibrary` | AboveSelection |
| `Generate` | `hasSelection && isInLibrary` | Bottom |
| `MakeText` | `isInLibrary && fileType === null` | Bottom |

## UI Components

### Bottom Toolbar

- Shows up to 4 buttons
- Overflow menu ("⋯") for additional actions
- On desktop: navigation actions (←/→) appear as edge buttons instead

### Edge Buttons (Desktop Only)

- Previous/Next page buttons on left/right edges
- Hidden on mobile and narrow viewports (<600px)
- Semi-transparent, full opacity on hover

### Selection Toolbar

- Floats above text selection
- Appears immediately when text selected
- Shows selection-specific actions (Translate, Explain Grammar)

## Event Flow

1. User opens file or changes selection
2. `active-leaf-change` / `mouseup` / `keyup` fires
3. `ButtonRegistry.recompute()` called
4. Context built from current state
5. Actions filtered by `isAvailable(ctx)`
6. Subscribers notified with new action lists
7. Toolbars re-render with updated buttons

## Adding New Actions

1. Add action ID to `UserAction` enum in `types.ts`
2. Add config to `ACTION_CONFIGS` in `actions-config.ts`:

```ts
[UserAction.MyAction]: {
  id: UserAction.MyAction,
  label: "My Action",
  execute: (services) => { /* handler */ },
  placement: UserActionPlacement.Bottom,
  priority: 5,
  isAvailable: (ctx) => ctx.isInLibrary && ctx.hasSelection,
},
```

3. Implement `execute` handler or link to existing command

## Files

- `src/services/wip-configs/actions/types.ts` - Types, ButtonContext
- `src/services/wip-configs/actions/actions-config.ts` - Action definitions
- `src/services/obsidian-services/button-registry.ts` - Registry
- `src/services/obsidian-services/atomic-services/bottom-toolbar-service.ts` - Bottom bar + edge buttons
- `src/services/obsidian-services/atomic-services/above-selection-toolbar-service.ts` - Selection toolbar
- `styles.css` - Button styles (.edge-nav-btn, .bottom-overflow-menu)
