# Dispatcher E2E Test Plan

## Overview

E2E tests for `Dispatcher` verify the full integration flow:
1. **Collapse** - Multiple actions on same file are merged/composed
2. **Sort** - Actions are ordered by weight + path depth
3. **Execute** - Actions execute sequentially via Executor
4. **Error Collection** - Errors are collected, execution continues

## Test Structure

Each test should:
- Use real `collapseActions` and `sortActionsByWeight` (not mocked)
- Use real `Executor` to verify execution order and capture calls
- Assert final state via `DispatchResult`

---

## Test Scenarios

### 1. Empty Actions
**Goal:** Verify empty input handling

**Setup:**
- Empty actions array

**Assertions:**
- Returns `ok(undefined)`
- Executor never called

---

### 2. Single Action - Happy Path
**Goal:** Verify basic dispatch flow

**Setup:**
- Single `CreateMdFile` action

**Assertions:**
- Executor called once with correct action
- Returns `ok(undefined)`

---

### 3. Collapse Integration - Process Composition
**Goal:** Verify collapse logic is applied before execution

**Setup:**
- Multiple `ProcessMdFile` on same file
- Actions: `[process("a.md", +"A"), process("a.md", +"B")]`

**Assertions:**
- Executor called once (not twice)
- Executed action has composed transform: `(c) => (c + "A") + "B"`
- Returns `ok(undefined)`

---

### 4. Collapse Integration - Write Precedence
**Goal:** Verify latest write wins

**Setup:**
- Multiple `ReplaceContentMdFile` on same file
- Actions: `[write("a.md", "first"), write("a.md", "second")]`

**Assertions:**
- Executor called once
- Executed action has content "second"
- Returns `ok(undefined)`

---

### 5. Collapse Integration - Write + Process
**Goal:** Verify process applied to write content

**Setup:**
- Write then process on same file
- Actions: `[write("a.md", "hello"), process("a.md", toUpperCase)]`

**Assertions:**
- Executor called once
- Executed action is `ReplaceContentMdFile` with content "HELLO"
- Returns `ok(undefined)`

---

### 6. Collapse Integration - Process + Write
**Goal:** Verify write discards prior process

**Setup:**
- Process then write on same file
- Actions: `[process("a.md", +"!"), write("a.md", "final")]`

**Assertions:**
- Executor called once
- Executed action is `ReplaceContentMdFile` with content "final"
- Returns `ok(undefined)`

---

### 7. Collapse Integration - Trash Terminality
**Goal:** Verify trash wins over all operations

**Setup:**
- Multiple operations then trash on same file
- Actions: `[process("a.md", +"!"), write("a.md", "content"), trash("a.md")]`

**Assertions:**
- Executor called once
- Executed action is `TrashMdFile`
- Returns `ok(undefined)`

---

### 8. Collapse Integration - Create + Write Merge
**Goal:** Verify create merges with write

**Setup:**
- Create then write on same file
- Actions: `[create("a.md", "initial"), write("a.md", "final")]`

**Assertions:**
- Executor called once
- Executed action is `CreateMdFile` with content "final"
- Returns `ok(undefined)`

---

### 9. Collapse Integration - Multiple Files
**Goal:** Verify operations on different files remain separate

**Setup:**
- Process on file A, process on file B
- Actions: `[process("a.md", +"A"), process("b.md", +"B")]`

**Assertions:**
- Executor called twice
- First call: process("a.md", +"A")
- Second call: process("b.md", +"B")
- Returns `ok(undefined)`

---

### 10. Sorting Integration - Weight Order
**Goal:** Verify actions sorted by weight before execution

**Setup:**
- Mixed action types
- Actions: `[ProcessMdFile("z.md"), CreateFolder("a"), CreateFile("b.txt")]`

**Assertions:**
- Executor called in order:
  1. `CreateFolder("a")` (weight 0)
  2. `CreateFile("b.txt")` (weight 3)
  3. `ProcessMdFile("z.md")` (weight 9)
- Returns `ok(undefined)`

---

### 11. Sorting Integration - Path Depth Order
**Goal:** Verify same-weight actions sorted by depth

**Setup:**
- Multiple creates at different depths
- Actions: `[CreateFolder("deep", ["a", "b"]), CreateFolder("shallow", ["a"])]`

**Assertions:**
- Executor called in order:
  1. `CreateFolder("shallow", ["a"])` (depth 1)
  2. `CreateFolder("deep", ["a", "b"])` (depth 2)
- Returns `ok(undefined)`

---

### 12. Sorting Integration - Mixed Weight + Depth
**Goal:** Verify weight takes precedence over depth

**Setup:**
- Deep folder, shallow file
- Actions: `[CreateFile("shallow.txt", ["a"]), CreateFolder("deep", ["a", "b", "c"])]`

**Assertions:**
- Executor called in order:
  1. `CreateFolder("deep", ["a", "b", "c"])` (weight 0, depth 3)
  2. `CreateFile("shallow.txt", ["a"])` (weight 3, depth 1)
- Returns `ok(undefined)`

---

### 13. Sequential Execution
**Goal:** Verify actions execute one at a time

**Setup:**
- Multiple actions
- Mock executor to track call order with timestamps

**Assertions:**
- Executor calls are sequential (not parallel)
- Each call completes before next starts
- Returns `ok(undefined)`

---

### 14. Error Handling - Single Error
**Goal:** Verify single error is collected

**Setup:**
- Two actions, second fails
- Actions: `[CreateMdFile("a.md"), CreateMdFile("b.md")]`
- Executor: first succeeds, second returns error "File exists"

**Assertions:**
- Executor called twice
- Returns `err([{action: CreateMdFile("b.md"), error: "File exists"}])`

---

### 15. Error Handling - Multiple Errors
**Goal:** Verify all errors collected

**Setup:**
- Three actions, two fail
- Actions: `[CreateMdFile("a.md"), CreateMdFile("b.md"), CreateMdFile("c.md")]`
- Executor: first succeeds, second fails "File exists", third fails "Permission denied"

**Assertions:**
- Executor called three times
- Returns `err([{action: CreateMdFile("b.md"), error: "File exists"}, {action: CreateMdFile("c.md"), error: "Permission denied"}])`

---

### 16. Error Handling - Execution Continues After Error
**Goal:** Verify execution doesn't stop on first error

**Setup:**
- Three actions, middle fails
- Actions: `[CreateMdFile("a.md"), CreateMdFile("b.md"), CreateMdFile("c.md")]`
- Executor: first succeeds, second fails, third succeeds

**Assertions:**
- Executor called three times
- Returns `err([{action: CreateMdFile("b.md"), error: "..."}])`
- Third action still executed

---

### 17. Complex Scenario - Collapse + Sort + Execute
**Goal:** Verify full pipeline integration

**Setup:**
- Mixed operations on multiple files
- Actions:
  - `ProcessMdFile("a.md", +"A")`
  - `ProcessMdFile("a.md", +"B")` (collapses with first)
  - `CreateFolder("parent")`
  - `ReplaceContentMdFile("b.md", "content")`
  - `CreateMdFile("c.md")`

**Assertions:**
- Executor called in order:
  1. `CreateFolder("parent")` (weight 0)
  2. `CreateMdFile("c.md")` (weight 6)
  3. `ProcessMdFile("a.md", composed transform)` (weight 9, collapsed)
  4. `ReplaceContentMdFile("b.md", "content")` (weight 10)
- Returns `ok(undefined)`

---

### 18. Complex Scenario - Rename Chain
**Goal:** Verify rename operations handled correctly

**Setup:**
- Multiple renames on same file
- Actions: `[RenameMdFile("a.md" → "b.md"), RenameMdFile("a.md" → "c.md")]`

**Assertions:**
- Collapse: latest rename wins → single `RenameMdFile("a.md" → "c.md")`
- Executor called once with final rename
- Returns `ok(undefined)`

---

### 19. Complex Scenario - Create + Trash No-op
**Goal:** Verify create+trash collapses to no-op

**Setup:**
- Create then trash same file
- Actions: `[CreateMdFile("a.md"), TrashMdFile("a.md")]`

**Assertions:**
- Collapse: trash wins → single `TrashMdFile("a.md")`
- Executor called once with trash
- Returns `ok(undefined)`

---

### 20. Edge Case - All Actions Fail
**Goal:** Verify error collection when all fail

**Setup:**
- Multiple actions, all fail
- Actions: `[CreateMdFile("a.md"), CreateMdFile("b.md")]`
- Executor: both return errors

**Assertions:**
- Executor called twice
- Returns `err([{action: CreateMdFile("a.md"), error: "..."}, {action: CreateMdFile("b.md"), error: "..."}])`

---

### 21. Edge Case - Large Batch
**Goal:** Verify performance with many actions

**Setup:**
- 100 actions on different files
- Mix of create/process/write operations

**Assertions:**
- All actions executed
- Execution order respects weight + depth
- Returns appropriate result

---

### 22. Edge Case - Async Transform in Collapse
**Goal:** Verify async transforms handled in collapse

**Setup:**
- Write + async process
- Actions: `[write("a.md", "hello"), process("a.md", async (c) => c.toUpperCase())]`

**Assertions:**
- Collapse waits for async transform
- Executor called once with transformed content "HELLO"
- Returns `ok(undefined)`

---

## Test Implementation Notes

### Mock Executor Pattern
```typescript
const mockExecutor = {
  calls: [] as Array<{action: VaultAction, timestamp: number}>,
  async execute(action: VaultAction) {
    this.calls.push({action, timestamp: Date.now()});
    // Return success or error based on test scenario
    return ok(undefined);
  }
};
```

### Assertion Helpers
- `expectExecutionOrder(executor, expectedTypes)` - Verify call order
- `expectCollapsed(actions, expectedCount)` - Verify collapse worked
- `expectErrorCount(result, count)` - Verify error collection

### Test Data Helpers
- `mdFile(basename, pathParts)` - Create SplitPathToMdFile
- `createAction(type, payload)` - Create VaultAction
- `actionSequence(...actions)` - Helper for multiple actions

---

## Priority

**High Priority (Core Functionality):**
- 1, 2, 3, 4, 5, 6, 10, 13, 14, 15, 16, 17

**Medium Priority (Edge Cases):**
- 7, 8, 9, 11, 12, 18, 19, 20

**Low Priority (Performance/Complex):**
- 21, 22
