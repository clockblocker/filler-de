# Dispatcher + Event Emitter + Queue Integration Plan

**Status:** ✅ **COMPLETE**  
**Completed:** 2024-12-14

> **Summary:** All components implemented, tested, and integrated. See `dispatcher-event-queue-integration-summary.md` for completion summary.

## Goal

Integrate `Dispatcher` with event emission and queueing to:
- ✅ **User-triggered events** (from Obsidian) → emit to subscribers via `subscribe()`
- ✅ **System-triggered actions** (from `dispatch()`) → execute but **NOT** emit as events
- ✅ Add queueing/debouncing for `dispatch()` calls
- ✅ Prevent self-events (actions we dispatch shouldn't trigger event emissions)

## Golden Source Principle

**Obsidian's actual behavior is always the authoritative source.**
- If code/docs/tests conflict with Obsidian's behavior, fix code/docs/tests to match Obsidian
- Never assume - always verify Obsidian's actual behavior through tests
- Document any unexpected Obsidian behavior in `obsidian-behavior-notes.md`

## Current State Analysis

### Existing Components

1. **EventAdapter** (`impl/event-adapter.ts`)
   - Listens to Obsidian vault events: `create`, `rename`, `delete`
   - Converts to `VaultEvent` and calls subscribers
   - Currently active when subscribers exist

2. **Dispatcher** (`impl/dispatcher.ts`)
   - Collapses actions (deduplication, composition)
   - Sorts by weight + depth
   - Executes sequentially via Executor
   - Returns `DispatchResult` with errors
   - **No queueing/debouncing** - executes immediately

3. **LegacyVaultActionQueue** (`file-services/vault-action-queue.ts`)
   - Features: debouncing (200ms default), deduplication, sorting
   - Uses `getActionKey()` for deduplication
   - Executes via `VaultActionExecutor`

4. **SelfEventTracker** (`commanders/librarian/utils/self-event-tracker.ts`)
   - Tracks actions we dispatch (by path)
   - Filters matching Obsidian events
   - Uses `pop(path)` to check and remove

### Current Flow

```
User Action (Obsidian)
  ↓
EventAdapter.start() → listens to vault.on("create"/"rename"/"delete")
  ↓
VaultEvent emitted → subscribers notified
  ↓
[Consumer code handles event]

System Action (Plugin)
  ↓
manager.dispatch(actions)
  ↓
Dispatcher.dispatch(actions)
  ├── collapseActions()
  ├── sortActionsByWeight()
  └── Executor.execute() → file system changes
  ↓
[Obsidian emits events for these changes]
  ↓
EventAdapter receives events → subscribers notified (UNWANTED!)
```

## Problem

When we `dispatch()` actions:
1. Actions execute and modify filesystem
2. Obsidian emits events for these changes
3. EventAdapter forwards these to subscribers
4. **Result:** Subscribers receive events for actions we triggered (self-events)

We want: **Only user-triggered events** should reach subscribers.

## Solution Architecture

### 1. Self-Event Tracking

Create `SelfEventTracker` for new system:

```typescript
// impl/self-event-tracker.ts
import { systemPathToSplitPath } from "../helpers/pathfinder";
import type { VaultAction } from "../types/vault-action";
import { VaultActionType } from "../types/vault-action";

export class SelfEventTracker {
  private readonly paths = new Set<string>(); // System paths (normalized)
  private readonly ttl = 5000; // 5s TTL
  private readonly cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
  
  register(actions: readonly VaultAction[]): void {
    for (const action of actions) {
      // Extract system path from action payload
      let systemPath: string;
      let toPath: string | null = null;
      
      switch (action.type) {
        case VaultActionType.CreateFolder:
        case VaultActionType.TrashFolder:
        case VaultActionType.CreateFile:
        case VaultActionType.TrashFile:
        case VaultActionType.CreateMdFile:
        case VaultActionType.TrashMdFile:
        case VaultActionType.ProcessMdFile:
        case VaultActionType.ReplaceContentMdFile:
          systemPath = systemPathToSplitPath.encode(action.payload.splitPath);
          break;
          
        case VaultActionType.RenameFolder:
        case VaultActionType.RenameFile:
        case VaultActionType.RenameMdFile:
          systemPath = systemPathToSplitPath.encode(action.payload.from);
          toPath = systemPathToSplitPath.encode(action.payload.to);
          break;
      }
      
      const normalized = normalizeSystemPath(systemPath);
      this.paths.add(normalized);
      this.scheduleCleanup(normalized);
      
      // For renames, also track 'to' path
      if (toPath) {
        const normalizedTo = normalizeSystemPath(toPath);
        this.paths.add(normalizedTo);
        this.scheduleCleanup(normalizedTo);
      }
    }
  }
  
  shouldIgnore(systemPath: string): boolean {
    const normalized = normalizeSystemPath(systemPath);
    if (this.paths.has(normalized)) {
      this.paths.delete(normalized); // Pop on match
      this.cancelCleanup(normalized);
      return true;
    }
    return false;
  }
  
  private scheduleCleanup(path: string): void {
    const existing = this.cleanupTimers.get(path);
    if (existing) clearTimeout(existing);
    
    const timer = setTimeout(() => {
      this.paths.delete(path);
      this.cleanupTimers.delete(path);
    }, this.ttl);
    this.cleanupTimers.set(path, timer);
  }
  
  private cancelCleanup(path: string): void {
    const timer = this.cleanupTimers.get(path);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(path);
    }
  }
}

function normalizeSystemPath(path: string): string {
  return path.replace(/^[\\/]+|[\\/]+$/g, "");
}
```

**Path Matching:**
- Actions use `SplitPath`, Obsidian events use system path strings
- Convert action paths to system paths via `systemPathToSplitPath.encode()`
- Normalize both action paths and event paths (remove leading/trailing slashes)
- For renames: track both `from` and `to` paths
- Use `pop()` pattern: remove on match (one-time use)

### 2. EventAdapter Integration

Modify `EventAdapter` to check self-event tracker:

```typescript
// impl/event-adapter.ts
export class EventAdapter {
  constructor(
    private readonly app: App,
    private readonly selfEventTracker: SelfEventTracker, // NEW
  ) {}
  
  start(handler: VaultEventHandler): void {
    const onCreate = this.app.vault.on("create", (file) => {
      if (this.selfEventTracker.shouldIgnore(file.path)) return; // Filter self-events
      this.emitFileCreated(file, handler);
    });
    const onRename = this.app.vault.on("rename", (file, oldPath) => {
      if (this.selfEventTracker.shouldIgnore(file.path)) return; // Filter self-events
      this.emitFileRenamed(file, oldPath, handler);
    });
    const onDelete = this.app.vault.on("delete", (file) => {
      if (this.selfEventTracker.shouldIgnore(file.path)) return; // Filter self-events
      this.emitFileTrashed(file, handler);
    });
    // ... store listeners
  }
  
  // emitFileCreated/emitFileRenamed/emitFileTrashed unchanged
}
```

**Note:** For rename events, we check the new path (`file.path`). The old path is already handled by tracking the `from` path in self-event tracker.

### 3. Action Queue (Call Stack Pattern)

Create `ActionQueue` implementing call stack + event queue pattern:

```typescript
// impl/action-queue.ts
import type { DispatchResult } from "./dispatcher";
import { ok } from "neverthrow";
import type { VaultAction } from "../types/vault-action";

export class ActionQueue {
  private queue: VaultAction[] = []; // Simple FIFO queue
  private isExecuting = false; // "Call stack" state
  private batchCount = 0;
  private readonly maxBatches = 10;
  
  constructor(
    private readonly dispatcher: Dispatcher,
    private readonly selfEventTracker: SelfEventTracker,
  ) {}
  
  async dispatch(actions: readonly VaultAction[]): Promise<DispatchResult> {
    // Add to queue (unlimited actions per batch)
    this.queue.push(...actions);
    
    // If call stack is empty, execute immediately
    if (!this.isExecuting) {
      return this.executeNextBatch();
    }
    
    // Otherwise, actions queued - will execute when current batch completes
    // Return ok() immediately (or return promise that resolves when queued batch executes)
    return ok(undefined);
  }
  
  private async executeNextBatch(): Promise<DispatchResult> {
    if (this.queue.length === 0) {
      this.isExecuting = false;
      return ok(undefined);
    }
    
    // Check batch limit
    if (this.batchCount >= this.maxBatches) {
      // Drop oldest batch or reject
      const dropped = this.queue.splice(0, Math.floor(this.queue.length / 2));
      // Could return error here, or just log
    }
    
    this.isExecuting = true;
    this.batchCount++;
    
    // Take all queued actions as one batch (unlimited size)
    const batch = [...this.queue];
    this.queue = [];
    
    // Register with self-event tracker BEFORE dispatch
    this.selfEventTracker.register(batch);
    
    // Dispatch: collapse + sort + execute (handled by Dispatcher)
    const result = await this.dispatcher.dispatch(batch);
    
    this.batchCount--;
    
    // When dispatched ops are done, check queue for more
    if (this.queue.length > 0) {
      // Recursively execute next batch
      return this.executeNextBatch();
    }
    
    this.isExecuting = false;
    return result;
  }
}
```

**Features:**
- Call stack pattern: queue by default, execute immediately if idle
- Unlimited actions per batch (collapse handles optimization)
- Max 10 batches (not actions)
- Automatic continuation: when batch completes, check queue and execute if more
- Dispatcher handles collapse + sort (queue is simple FIFO)
- Self-event registration before each batch

### 4. Facade Integration

Update `ObsidianVaultActionManagerImpl`:

```typescript
// impl/facade.ts
export class ObsidianVaultActionManagerImpl {
  private readonly selfEventTracker: SelfEventTracker;
  private readonly actionQueue: ActionQueue;
  private readonly eventAdapter: EventAdapter;
  
  constructor(app: App) {
    // ... existing setup ...
    
    this.selfEventTracker = new SelfEventTracker();
    this.actionQueue = new ActionQueue(
      this.dispatcher,
      this.selfEventTracker,
    );
    this.eventAdapter = new EventAdapter(app, this.selfEventTracker);
  }
  
  async dispatch(actions: readonly VaultAction[]): Promise<DispatchResult> {
    // Queue by default, execute immediately if call stack empty
    return this.actionQueue.dispatch(actions);
    // Returns DispatchResult - caller handles errors
  }
}
```

**Key Changes:**
- `dispatch()` returns `DispatchResult` (not throws)
- Queue handles execution state (call stack pattern)
- Self-event tracking integrated
- Errors returned to caller (not thrown)

## Design Decisions

### Decision 1: Queue vs Immediate Dispatch

**Design:** **Call Stack + Event Queue Pattern**
- Queue by default - all `dispatch()` calls go to queue
- If "call stack" (execution) is empty → execute immediately
- If "call stack" is busy → queue actions, execute when current batch completes
- Pattern: Queue → Check if executing → Execute if idle, else wait

**Implementation:**
```typescript
class ActionQueue {
  private queue: VaultAction[] = [];
  private isExecuting = false;
  private readonly maxBatches = 10;
  private batchCount = 0;
  
  async dispatch(actions: readonly VaultAction[]): Promise<DispatchResult> {
    // Add to queue
    this.queue.push(...actions);
    
    // If not executing, start execution
    if (!this.isExecuting) {
      return this.executeNextBatch();
    }
    
    // Otherwise, actions are queued and will execute when current batch completes
    return ok(undefined); // Or return promise that resolves when queued batch executes
  }
  
  private async executeNextBatch(): Promise<DispatchResult> {
    if (this.queue.length === 0) {
      this.isExecuting = false;
      return ok(undefined);
    }
    
    if (this.batchCount >= this.maxBatches) {
      // Drop oldest batch or reject
      return err([{ action: ..., error: "Queue limit reached" }]);
    }
    
    this.isExecuting = true;
    this.batchCount++;
    
    // Take all queued actions as one batch
    const batch = [...this.queue];
    this.queue = [];
    
    // Register with self-event tracker
    this.selfEventTracker.register(batch);
    
    // Dispatch (collapse + sort + execute)
    const result = await this.dispatcher.dispatch(batch);
    
    this.batchCount--;
    
    // When done, check if more actions queued
    if (this.queue.length > 0) {
      // Recursively execute next batch
      return this.executeNextBatch();
    }
    
    this.isExecuting = false;
    return result;
  }
}
```

**Key Points:**
- Queue by default, but execute immediately if idle
- Unlimited actions per batch (only batch count limited)
- Automatic continuation when batch completes
- Self-event registration before each batch

### Decision 2: Self-Event Tracking Granularity

**Design:** **Path-based tracking for all action types**
- Track system paths (normalized) for all actions
- For renames: track both `from` and `to` paths
- For folders: track folder paths (even though events are file-only, future-proof)
- Match Obsidian event paths (system path strings) against tracked paths

**Rationale:**
- Obsidian events are path-based (`file.path`)
- Simpler than action-type matching
- Covers all action types uniformly

### Decision 3: TTL for Self-Event Keys

**Design:** **Fixed TTL with pop-on-match**
- 5s TTL for tracked paths
- Pop (remove) on match - one-time use per path
- Auto-cleanup via setTimeout
- Cancel cleanup timer when path is matched

**Rationale:**
- Most operations complete quickly
- Pop-on-match prevents false positives from slow operations
- Simple and efficient

### Decision 4: Queue Deduplication vs Collapse

**Design:** **Dispatcher handles ordering/collapse, queue is simple FIFO**
- Queue: Simple array, no deduplication (FIFO)
- Dispatcher: Handles collapse + sort when batch is executed
- Actions in queue are ordered/collapsed by dispatcher (not in queue)

**Rationale:**
- Simpler queue implementation
- Collapse logic centralized in Dispatcher
- Queue just batches actions, dispatcher optimizes and performant

### Decision 5: Event Burst Handling

**Problem:** Rapid user actions (e.g., drag-and-drop multiple files) → burst of events

**Options:**
- **A. Immediate emit**: Emit events immediately (current)
- **B. Debounce events**: Debounce event emissions (50-200ms)
- **C. Batch events**: Collect events, emit as batch

**Recommendation:** **Option A (Immediate)**
- Simpler
- Subscribers can handle batching if needed
- Can add debouncing later if needed

## Proposed Implementation

### File Structure

```
src/obsidian-vault-action-manager/
  impl/
    facade.ts              # Updated with queue + self-event tracking
    dispatcher.ts           # No changes
    event-adapter.ts        # Updated to use self-event tracker
    action-queue.ts         # NEW: Queue with debouncing
    self-event-tracker.ts   # NEW: Track dispatched actions
    ...
```

### Flow Diagram

```
User Action (Obsidian)
  ↓
EventAdapter.shouldIgnore()? → NO (user action)
  ↓
VaultEvent → subscribers notified ✅

System Action (Plugin)
  ↓
manager.dispatch(actions)
  ↓
SelfEventTracker.register(actions) → track paths/keys
  ↓
ActionQueue.push(actions) → deduplicate, debounce
  ↓
ActionQueue.flush()
  ↓
Dispatcher.dispatch(actions)
  ├── collapseActions()
  ├── sortActionsByWeight()
  └── Executor.execute() → file system changes
  ↓
Obsidian emits events
  ↓
EventAdapter.shouldIgnore()? → YES (self-event)
  ↓
Event filtered out → subscribers NOT notified ✅
```

### API Changes

**No breaking changes to public API:**

```typescript
// Existing API unchanged
interface ObsidianVaultActionManager {
  subscribe(handler: VaultEventHandler): Teardown;
  dispatch(actions: readonly VaultAction[]): Promise<void>;
  // ... read-only ops ...
}

// Optional: Add queued dispatch
interface ObsidianVaultActionManager {
  dispatchQueued(actions: readonly VaultAction[]): void; // Fire and forget
  flushQueue(): Promise<void>; // Force flush
}
```

## Outstanding Questions

### Q1: Should `dispatch()` be immediate or queued by default?

**Answer:** Queue by default, but execute immediately if call stack is empty.

**Design:**
- All `dispatch()` calls go to queue
- If nothing executing → execute immediately
- If executing → queue and execute when current batch completes
- "Call stack" pattern: queue + execution state

### Q2: How to handle errors in queued dispatch?

**Answer:** Dispatch returns `DispatchResult` (not throws). Caller handles errors.

**Design:**
- `dispatch()` returns `Promise<DispatchResult>`
- `DispatchResult = Result<void, DispatchError[]>`
- Errors collected, execution continues
- Caller decides: retry, log, ignore, etc.

### Q3: Should queue have a size limit?

**Answer:** Limit to 10 batches. Unlimited actions per batch.

**Design:**
- Queue tracks batch count (not action count)
- Max 10 batches
- Each batch can have unlimited actions
- When limit reached: drop oldest batch or reject new dispatch
- Actions within batch are unlimited (collapse handles optimization)

### Q4: How to handle rename chains in self-event tracking?

**Answer:** Track both `from` and `to` paths for renames. Check collapse logic for rename chain handling.

**Current State:**
- Collapse keys renames by `from` path only
- Rename chains (`a.md → b.md` then `b.md → c.md`) are NOT collapsed
- Spec notes this as "future optimization"

**Action Required:**
- **Check if rename chain collapse is needed** (unit tests)
- If not covered, add unit tests for rename chain collapse
- Self-event tracking: track both `from` and `to` paths (already in plan)

### Q5: Should self-event tracking handle folder operations?

**Answer:** Yes - track ALL actions (folders, files, everything).

**Design:**
- Track paths for all action types (folders, files, md files)
- Even though `VaultEvent` is file-only currently
- Future-proof: if folder events added later, already handled
- None of our dispatched actions should emit events to subscribers
- Only actual Obsidian user-triggered events are passed

### Q6: How to test self-event filtering?

**Answer:** E2E tests.

**Design:**
- E2E tests verify actual behavior
- Test: dispatch action → verify no event emitted to subscribers
- Test: external file change → verify event emitted to subscribers
- Unit tests for SelfEventTracker path matching logic

### Q7: Should queue support priority/weight-based ordering?

**Answer:** Dispatcher handles ordering/collapse. Queue is simple FIFO.

**Design:**
- Queue: Simple array, FIFO order
- Dispatcher: Collapses and sorts when batch is executed
- Actions in queue are ordered/collapsed by dispatcher (not in queue)

### Q8: How to handle concurrent flushes?

**Answer:** When dispatched ops are done, check queue and execute if there are more.

**Design:**
- Single execution state (`isExecuting`)
- When batch completes → check if queue has more actions
- If yes → execute next batch automatically
- If no → set `isExecuting = false`
- Serialized execution prevents race conditions

### Q9: Should EventAdapter filter by action type?

**Context:** We dispatch `CreateMdFile`, Obsidian emits `create` event.

**Question:** Should we match by action type or just path?

**Recommendation:** Path-based matching is sufficient. Action type matching adds complexity without clear benefit. 

**Note:** Obsidian events are path-based (`file.path`), so path matching is natural. Action types (CreateMdFile vs ReplaceContentMdFile) both result in `create` events, so type matching wouldn't help.

### Q10: How to handle external file changes?

**Context:** Files changed outside Obsidian (e.g., git, file system).

**Current:** EventAdapter receives all Obsidian events.

**Question:** Should we distinguish external vs user-triggered?

**Recommendation:** No - treat all Obsidian events as "user-triggered" (includes external). Self-events are the only ones we filter.

## Implementation Steps

### Phase 1: Rename Chain Handling ✅

1. **Check rename chain collapse** ✅
   - **Status:** Rename chains are NOT currently collapsed (by design)
   - Current: `a.md → b.md` and `b.md → c.md` have different keys (different `from` paths)
   - Both renames are kept (not collapsed to `a.md → c.md`)
   - **File:** `tests/unit/obsidian-vault-action-manager/collapse-rename-chain.test.ts` ✅ Created
   - **Documented:** In collapse spec as expected behavior

### Phase 2: Core Components ✅

2. **Create SelfEventTracker** ✅
   - ✅ Implemented `register(actions)` - extracts system paths from all action types
   - ✅ Tracks both `from` and `to` for renames
   - ✅ Tracks all action types (folders, files, md files)
   - ✅ Implemented `shouldIgnore(path)` with path normalization
   - ✅ TTL cleanup (5s) with pop-on-match
   - **File:** `src/obsidian-vault-action-manager/impl/self-event-tracker.ts`

3. **Create ActionQueue** ✅
   - ✅ Implemented call stack pattern: queue + execution state
   - ✅ Simple FIFO queue (no deduplication - dispatcher handles that)
   - ✅ Max 10 batches, unlimited actions per batch
   - ✅ Executes immediately if call stack empty
   - ✅ Auto-continues when batch completes (checks queue for more)
   - ✅ Registers with SelfEventTracker before each batch
   - **File:** `src/obsidian-vault-action-manager/impl/action-queue.ts`

4. **Update EventAdapter** ✅
   - ✅ Injected SelfEventTracker
   - ✅ Checks `shouldIgnore()` before emitting events
   - ✅ Filters all event types (create, rename, delete)
   - ✅ Only user-triggered events reach subscribers
   - **File:** `src/obsidian-vault-action-manager/impl/event-adapter.ts`

5. **Update Facade** ✅
   - ✅ Creates SelfEventTracker instance
   - ✅ Creates ActionQueue instance
   - ✅ `dispatch()` returns `DispatchResult` (not throws)
   - ✅ Routes through ActionQueue (call stack pattern)
   - **File:** `src/obsidian-vault-action-manager/impl/facade.ts`

6. **Update Dispatcher Interface** ✅
   - ✅ `dispatch()` return type is `Promise<DispatchResult>`
   - ✅ Returns errors in result (not throws)

### Phase 3: Testing ✅

7. **E2E Tests** ✅
   - ✅ Self-event filtering: `tests/specs/dispatcher/self-event-filtering.test.ts`
   - ✅ User-event emission: `tests/specs/dispatcher/user-event-emission.test.ts`
   - ✅ Queue behavior: `tests/specs/dispatcher/queue-behavior.test.ts`
   - ✅ Error handling: `tests/specs/dispatcher/error-handling-single.test.ts`
   - **Status:** All 15 dispatcher E2E tests passing

8. **Unit Tests** (Optional)
   - SelfEventTracker path matching - covered by E2E tests
   - ActionQueue call stack behavior - covered by E2E tests
   - Rename chain collapse - `tests/unit/obsidian-vault-action-manager/collapse-rename-chain.test.ts` ✅

## Migration Notes

- **Backward compatible:** Existing `dispatch()` API unchanged
- **Legacy queue:** Can coexist during migration
- **Gradual migration:** Can migrate callers one by one

## Performance Considerations

- **Self-event tracking:** O(1) lookup, minimal memory (TTL cleanup)
- **Queue deduplication:** O(1) per action (Map lookup)
- **Debouncing:** Single timeout per queue, efficient
- **Event filtering:** O(1) path lookup before emit

## Risk Assessment

- **Low risk:** Self-event tracking is isolated, easy to test
- **Medium risk:** Queue timing changes behavior (needs careful testing)
- **Low risk:** EventAdapter changes are additive (backward compatible)

## Summary

### Core Requirements

1. **Self-Event Filtering**
   - Track paths of actions we dispatch
   - Filter matching Obsidian events before emitting to subscribers
   - Use path-based matching (normalized system paths)
   - Handle renames (track both from/to)

2. **Queueing (Call Stack Pattern)**
   - Queue by default - all `dispatch()` calls go to queue
   - Execute immediately if call stack empty
   - Max 10 batches, unlimited actions per batch
   - Auto-continue when batch completes (check queue for more)
   - Dispatcher handles collapse + sort (queue is simple FIFO)
   - Register with self-event tracker before each batch

3. **Event Emission**
   - Only emit user-triggered events (from Obsidian)
   - Do NOT emit events for actions we dispatch
   - Maintain existing `subscribe()` API

### Key Design Decisions

- **Call stack pattern** - Queue by default, execute immediately if call stack empty
- **Dispatch returns errors** - `dispatch()` returns `DispatchResult`, caller handles errors
- **Max 10 batches** - Queue limit: 10 batches, unlimited actions per batch
- **Path-based self-event tracking** - Match by normalized system paths for all action types
- **TTL cleanup** - 5s TTL with pop-on-match (one-time use per path)
- **Dispatcher handles collapse/sort** - Queue is simple FIFO, dispatcher optimizes
- **Auto-continue** - When batch completes, check queue and execute if more

### Implementation Priority

1. **High:** Self-event tracking + EventAdapter integration
2. **Medium:** ActionQueue (if queueing needed)
3. **Low:** Advanced features (priority queue, batch events)

### Testing Strategy

- **Unit tests:** SelfEventTracker path matching logic
- **Unit tests:** ActionQueue call stack behavior (queue + execution state)
- **Unit tests:** Rename chain collapse (verify current behavior, document)
- **E2E tests:** Self-event filtering (dispatch action, verify no event emitted)
- **E2E tests:** User-event emission (external file change, verify event emitted)
- **E2E tests:** Queue behavior (multiple dispatches, verify batching)
- **E2E tests:** Error handling (failed actions, verify errors returned)

## Rename Chain Handling Status ✅

**Current State:**
- Rename chains (`a.md → b.md` then `b.md → c.md`) are **NOT collapsed** (by design)
- Different keys (different `from` paths) → both renames kept
- Unit tests added: `tests/unit/obsidian-vault-action-manager/collapse-rename-chain.test.ts` ✅
- Tests verify current behavior (both renames kept)

**Decision:**
- **Not implementing rename chain collapse** - current behavior is correct
- Self-event tracking handles this by tracking both `from` and `to` paths
- Documented in collapse spec as expected behavior

**Status:** ✅ Complete - documented and tested
