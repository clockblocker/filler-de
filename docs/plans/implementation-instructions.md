# Implementation Instructions: Dispatcher + Event Emitter + Queue Integration

## Context Required

### 1. Core Architecture Understanding

**Read these files first:**
- `docs/plans/dispatcher-event-queue-integration-plan.md` - Full plan with all decisions
- `docs/plans/obsidian-vault-action-manager-spec.md` - Architecture and design decisions
- `src/obsidian-vault-action-manager/index.ts` - Public interface (`ObsidianVaultActionManager`)
- `src/obsidian-vault-action-manager/impl/facade.ts` - Current facade implementation
- `src/obsidian-vault-action-manager/impl/dispatcher.ts` - Current dispatcher (returns `DispatchResult`)
- `src/obsidian-vault-action-manager/impl/event-adapter.ts` - Current event adapter (no filtering yet)

### 2. Key Design Decisions

**Call Stack Pattern:**
- Queue by default, execute immediately if call stack empty
- Max 10 batches, unlimited actions per batch
- When batch completes → check queue and execute if more

**Error Handling:**
- `dispatch()` returns `DispatchResult = Result<void, DispatchError[]>` (not throws)
- Caller handles errors

**Self-Event Tracking:**
- Track ALL action types (folders, files, md files)
- Path-based matching (normalized system paths)
- For renames: track both `from` and `to` paths
- TTL: 5s with pop-on-match (one-time use per path)
- Goal: Only user-triggered events reach subscribers

**Queue Design:**
- Simple FIFO (no deduplication - dispatcher handles that)
- Dispatcher handles collapse + sort when batch executes
- Actions in queue are ordered/collapsed by dispatcher (not in queue)

### 3. Type System

**Key Types:**
- `VaultAction` - Discriminated union of all action types
- `DispatchResult = Result<void, DispatchError[]>`
- `DispatchError = { action: VaultAction; error: string }`
- `SplitPath` - Type-safe path representation
- `VaultEvent` - Event emitted to subscribers

**Path Helpers:**
- `getActionKey(action)` - Returns key for collapse/deduplication
- `getActionTargetPath(action)` - Returns target path
- `splitPathKey(splitPath)` - Converts SplitPath to string key

## Implementation Steps

### Phase 1: SelfEventTracker

**File:** `src/obsidian-vault-action-manager/impl/self-event-tracker.ts`

**Requirements:**
1. Track system paths (normalized) for all dispatched actions
2. For renames: track both `from` and `to` paths
3. TTL: 5s with pop-on-match (remove on match, not on timeout)
4. Path normalization: use `splitPathKey()` or system path strings

**API:**
```typescript
export class SelfEventTracker {
  register(actions: readonly VaultAction[]): void;
  shouldIgnore(path: string): boolean; // Normalized system path
}
```

**Implementation Notes:**
- Extract paths from actions using `getActionTargetPath()` and action-specific logic
- For renames: extract both `from` and `to` paths
- Use `Map<string, NodeJS.Timeout>` for tracked paths with cleanup timers
- On `shouldIgnore()` match: remove from map and clear timer (pop-on-match)
- Normalize paths: convert SplitPath to system path string for matching

**Testing:**
- Unit tests: path matching, TTL cleanup, pop-on-match behavior
- Test rename tracking (both from/to)

### Phase 2: ActionQueue

**File:** `src/obsidian-vault-action-manager/impl/action-queue.ts`

**Requirements:**
1. Call stack pattern: queue + execution state
2. Simple FIFO queue (array of `VaultAction[]`)
3. Max 10 batches (not actions)
4. Execute immediately if call stack empty
5. Auto-continue when batch completes (check queue for more)
6. Register with SelfEventTracker before each batch

**API:**
```typescript
export class ActionQueue {
  constructor(
    private readonly dispatcher: Dispatcher,
    private readonly selfEventTracker: SelfEventTracker,
  );
  
  async dispatch(actions: readonly VaultAction[]): Promise<DispatchResult>;
}
```

**Implementation Notes:**
- `private queue: VaultAction[] = []` - Simple array
- `private isExecuting = false` - Execution state
- `private batchCount = 0` - Track batch count
- `private readonly maxBatches = 10`
- `dispatch()`: Add to queue, if not executing → call `executeNextBatch()`
- `executeNextBatch()`: 
  - Check batch limit
  - Take all queued actions as batch
  - Register with self-event tracker
  - Call dispatcher.dispatch(batch)
  - When done, check queue and recurse if more
  - Set `isExecuting = false` when queue empty

**Testing:**
- Unit tests: call stack behavior, batch limits, auto-continue
- Test immediate execution when idle
- Test queuing when busy

### Phase 3: EventAdapter Integration

**File:** `src/obsidian-vault-action-manager/impl/event-adapter.ts`

**Changes:**
1. Inject `SelfEventTracker` in constructor
2. Before emitting events, check `shouldIgnore(file.path)`
3. Only emit if NOT ignored (user-triggered events)

**Implementation:**
```typescript
export class EventAdapter {
  constructor(
    private readonly app: App,
    private readonly selfEventTracker: SelfEventTracker,
  ) { ... }
  
  private emitFileCreated(file: TFile): void {
    if (this.selfEventTracker.shouldIgnore(file.path)) {
      return; // Filter self-event
    }
    // ... emit to subscribers
  }
  
  // Same for emitFileRenamed, emitFileTrashed
}
```

**Testing:**
- E2E: Dispatch action → verify no event emitted
- E2E: External file change → verify event emitted

### Phase 4: Facade Integration

**File:** `src/obsidian-vault-action-manager/impl/facade.ts`

**Changes:**
1. Create `SelfEventTracker` instance
2. Create `ActionQueue` instance (inject dispatcher + selfEventTracker)
3. Update `dispatch()` to route through `ActionQueue`
4. Remove TODO comment

**Implementation:**
```typescript
export class ObsidianVaultActionManagerImpl {
  private readonly selfEventTracker: SelfEventTracker;
  private readonly actionQueue: ActionQueue;
  
  constructor(app: App) {
    // ... existing setup ...
    this.selfEventTracker = new SelfEventTracker();
    this.actionQueue = new ActionQueue(this.dispatcher, this.selfEventTracker);
    this.eventAdapter = new EventAdapter(app, this.selfEventTracker);
  }
  
  async dispatch(actions: readonly VaultAction[]): Promise<DispatchResult> {
    return this.actionQueue.dispatch(actions);
  }
}
```

**Note:** `dispatch()` already returns `DispatchResult` (updated in previous step).

### Phase 5: Testing

**Unit Tests:**
- `tests/unit/obsidian-vault-action-manager/self-event-tracker.test.ts`
- `tests/unit/obsidian-vault-action-manager/action-queue.test.ts`

**E2E Tests:**
- `tests/specs/dispatcher/self-event-filtering.test.ts` - Dispatch action, verify no event
- `tests/specs/dispatcher/user-event-emission.test.ts` - External change, verify event
- `tests/specs/dispatcher/queue-behavior.test.ts` - Multiple dispatches, verify batching
- `tests/specs/dispatcher/error-handling.test.ts` - Failed actions, verify errors returned

## Key Constraints

1. **Type Safety:** No `as` or `any` (except documented Obsidian API cases)
2. **Error Handling:** Return `Result` types, don't throw
3. **Path Normalization:** Use `splitPathKey()` or system path strings consistently
4. **Golden Source:** Obsidian's behavior is authoritative - test and document

## Files to Reference

**Action Types:**
- `src/obsidian-vault-action-manager/types/vault-action.ts` - Action types, `getActionKey()`, `getActionTargetPath()`

**Path Helpers:**
- `src/obsidian-vault-action-manager/impl/split-path.ts` - `splitPathKey()`, path conversion

**Existing Patterns:**
- `src/obsidian-vault-action-manager/impl/collapse.ts` - How actions are processed
- `src/obsidian-vault-action-manager/impl/dispatcher.ts` - How dispatch works

## Success Criteria

1. ✅ SelfEventTracker tracks all action paths correctly
2. ✅ ActionQueue implements call stack pattern correctly
3. ✅ EventAdapter filters self-events
4. ✅ Facade routes through ActionQueue
5. ✅ All unit tests pass
6. ✅ All E2E tests pass
7. ✅ No linter errors
8. ✅ Type safety maintained (no `as`/`any`)

## Questions to Resolve During Implementation

1. **Path Normalization:** Should we use `splitPathKey()` or system path strings? (Check existing patterns)
2. **TTL Cleanup:** Should cleanup happen on timer or only on match? (Plan says pop-on-match)
3. **Batch Limit Handling:** Drop oldest batch or reject new dispatch? (Plan says drop oldest)

## Next Steps After Implementation

1. Update `docs/plans/vault-action-manager-refactor.md` - Mark components as complete
2. Update `docs/plans/dispatcher-event-queue-integration-plan.md` - Mark implementation steps complete
3. Document any unexpected Obsidian behavior in `tests/specs/dispatcher/obsidian-behavior-notes.md`
