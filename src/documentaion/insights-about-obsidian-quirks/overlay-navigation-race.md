# Overlay Missing After Navigation

## Problem
After navigation via plugin nav buttons, the bottom toolbar overlay sometimes doesn't appear until user clicks the screen.

## Root Causes

### 1. Race Condition Between Events
When `cd()` opens a file, Obsidian fires multiple events:
- `file-open`
- `layout-change`
- `active-leaf-change`
- Custom `textfresser:file-ready`

All of these were trying to reattach the overlay, causing race conditions.

### 2. Fire-and-Forget Async Operations
`tryReattachWithRetry()` used `void waitForDomCondition()` - the promise wasn't awaited, so recompute could happen out of order.

### 3. Early Return Optimization Bug
`bottom-toolbar.ts` had an optimization that skipped reattachment if "same view":
```typescript
if (view && sameView && isConnected && sameParent) return;
```
This failed because DOM may have changed even when the view object is the same.

## Solution: NavigationState State Machine

### Key Insight
Plugin-initiated navigation (nav buttons) and external navigation (wikilinks, file explorer) need different handling.

### Implementation

1. **NavigationState class** (`coordination/navigation-state.ts`)
   - Tracks: `idle` vs `navigating`
   - Distinguishes: plugin nav vs external nav
   - Methods: `startPluginNav()`, `startExternalNav()`, `complete()`

2. **Event Coordination**
   - `cd()` calls `startPluginNav()` BEFORE opening file
   - `file-open` calls `startExternalNav()` (no-op if plugin nav in progress)
   - `layout-change` SKIPS if plugin nav (file-ready handles it)
   - `active-leaf-change` SKIPS if any nav in progress
   - `textfresser:file-ready` is SINGLE AUTHORITY for plugin nav completion

3. **Proper Async/Await**
   - `tryReattachWithRetry()` is now async and awaits everything
   - `completeNavigation()` awaits recompute before reattach

4. **No Early Return**
   - `bottom-toolbar.reattachToView()` always detaches and reattaches

## Event Flow After Fix

**Plugin nav:**
```
cd() -> startPluginNav() -> [layout-change SKIPPED] -> file-ready -> completeNavigation()
```

**External nav:**
```
click wikilink -> startExternalNav() -> layout-change -> tryReattachWithRetry()
```

## Files Involved
- `coordination/navigation-state.ts` - state machine
- `coordination/event-coordinator.ts` - event subscriptions
- `coordination/ui-reattachment.ts` - retry logic
- `overlay-manager.ts` - completeNavigation entry point
- `button-manager/bottom-toolbar.ts` - reattachToView
- `vault-action-manager/file-services/active-view/opened-file-service.ts` - cd() callback
- `main.ts` - wiring

## Why This Works
The state machine ensures exactly ONE code path handles each navigation:
- Plugin nav: `textfresser:file-ready` -> `completeNavigation()`
- External nav: `layout-change` -> `tryReattachWithRetry()`

No more races, no more fire-and-forget promises.
