# OverlayManager

## Responsibility Boundary

OverlayManager is a **pure UI reactor**. It responds to user behavior and places UI elements accordingly.

### What OverlayManager Does

- Reads user settings (`ParsedUserSettings`) to determine which actions appear in which toolbar
- Listens to selection change events and workspace events
- Shows/hides selection toolbar above text selection
- Shows/hides bottom toolbar with contextual actions
- Manages toolbar lifecycles per leaf (create on open, destroy on close)
- Hides selection toolbar on scroll

### What OverlayManager Does NOT Do

- **Does NOT modify vault state** - Actions handle their own side effects via `commandExecutor`
- **Does NOT clear selection after actions** - Actions decide whether to clear selection
- **Does NOT execute business logic** - Routes action clicks to handlers in `main.ts`
- **Does NOT persist state** - Reads settings from global state, does not write

## Architecture

```
User Settings (ParsedUserSettings)
         │
         ▼
┌─────────────────────────────────────────────┐
│              OverlayManager                 │
│                                             │
│  ┌──────────────┐    ┌──────────────────┐  │
│  │ Selection    │    │ Workspace        │  │
│  │ Events       │    │ Events           │  │
│  └──────┬───────┘    └────────┬─────────┘  │
│         │                     │            │
│         ▼                     ▼            │
│  ┌────────────────────────────────────┐    │
│  │       computeAllowedActions()      │    │
│  │  (reads settings, splits actions)  │    │
│  └────────────────────────────────────┘    │
│         │                     │            │
│         ▼                     ▼            │
│  ┌──────────────┐    ┌──────────────────┐  │
│  │ Selection    │    │ Bottom           │  │
│  │ Toolbar      │    │ Toolbar          │  │
│  │ (per leaf)   │    │ (per leaf)       │  │
│  └──────────────┘    └──────────────────┘  │
└─────────────────────────────────────────────┘
         │
         │ Button clicks emit ActionElementClicked events
         ▼
    main.ts handlers → commandExecutor
```

## Placement Settings

Each action has a placement setting in `TextEaterSettings`:

| Action | Setting Key | Values |
|--------|-------------|--------|
| Translate | `translatePlacement` | "selection" / "bottom" / "shortcut-only" |
| Split in Blocks | `splitInBlocksPlacement` | "selection" / "bottom" / "shortcut-only" |
| Explain Grammar | `explainGrammarPlacement` | "selection" / "bottom" / "shortcut-only" |
| Generate | `generatePlacement` | "selection" / "bottom" / "shortcut-only" |

- `"selection"` → Button appears in selection toolbar (above selection)
- `"bottom"` → Button appears in bottom toolbar
- `"shortcut-only"` → Button appears in neither toolbar (keyboard shortcut only)

## Event Flow

1. User selects text
2. `UserEventInterceptor` emits `SelectionChanged` event
3. `OverlayManager.handleSelectionChanged()` receives event
4. Calls `computeAllowedActions()` to read settings
5. Updates selection toolbar with "selection" actions
6. Updates bottom toolbar with "bottom" actions
7. User clicks action button
8. `UserEventInterceptor` emits `ActionElementClicked` event
9. Handler in `main.ts` routes to `commandExecutor`
