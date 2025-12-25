# Topological Sort Migration - E2E Test Issues

## Test Results Summary

**19 passing, 3 failing**

## Failing Tests

### 1. `collapse-write-process.test.ts` - "should apply process to write content"

**Error**: `File not found: Failed to get file by path: write-process-test.md`

**Test Scenario**:
- Dispatch `UpsertMdFile` with content "hello" + `ProcessMdFile` with transform
- Expected: File created with "HELLO" (process applied to write)
- Actual: File not found error

**Root Cause Analysis**:
- Test dispatches both actions in same batch
- `ProcessMdFile` depends on `UpsertMdFile` for same file
- Dependency graph should ensure `UpsertMdFile` executes first
- **Possible issue**: Dependency not being found, or execution order wrong

**Investigation Needed**:
- Check if dependency graph correctly links `ProcessMdFile` → `UpsertMdFile` for same file
- Verify topological sort orders them correctly
- Check if collapse logic interferes with dependency detection

---

### 2. `helper-events-no-leak.test.ts` - "should not emit events when ProcessMdFile ensures file exists"

**Error**: `expect(received).toBe(expected) // Object.is equality - Expected: true, Received: false`

**Test Scenario**:
- Dispatch `ProcessMdFile` on non-existent file
- `ensureDestinationsExist` should add `UpsertMdFile` with `content: null` (EnsureExist)
- Expected: File exists after dispatch
- Actual: `exists` returns false

**Root Cause Analysis**:
- `collectRequirements` adds file to `fileKeys` when it sees `ProcessMdFile` (line 64-68)
- `ensureDestinationsExist` should add `UpsertMdFile` with `content: ""` (empty string, not null) for `createFileKeys` (line 380-406)
- **Issue**: File not being created, or created but not found

**Investigation Needed**:
- Verify `ensureDestinationsExist` is adding `UpsertMdFile` for `ProcessMdFile` requirements
- Check if dependency graph ensures `UpsertMdFile` executes before `ProcessMdFile`
- Verify file creation succeeds in executor

---

### 3. `helper-events-no-leak.test.ts` - "should not emit events when ProcessMdFile creates file in missing folders"

**Error**: `expect(received).toBe(expected) // Object.is equality - Expected: true, Received: false`

**Test Scenario**:
- Dispatch `ProcessMdFile` on non-existent file in non-existent nested folders (`x/y/z/process-nested.md`)
- Should create parent folders + file
- Expected: File exists after dispatch
- Actual: `exists` returns false

**Root Cause Analysis**:
- Same as issue #2, but with nested path
- Parent folders should be created via `ensureDestinationsExist`
- File should be created via `UpsertMdFile` added by `ensureDestinationsExist`

**Investigation Needed**:
- Verify recursive parent folder creation works
- Check if nested path handling is correct
- Verify all CreateFolder actions execute before UpsertMdFile

---

## Potential Root Causes

### Hypothesis 1: Dependency Graph Not Finding Newly Added Actions

**Scenario**: `ensureDestinationsExist` adds `UpsertMdFile` actions, but dependency graph built on `collapsed` actions doesn't find them.

**Check**:
- Dependency graph is built AFTER `ensureDestinationsExist` and AFTER `collapseActions`
- Newly added `UpsertMdFile` actions should be in the `collapsed` array
- `findDependenciesForAction` searches `allActions` parameter - verify it includes newly added actions

**Code Location**: `dispatcher.ts` line 52-60

### Hypothesis 2: Collapse Logic Removing Required Actions ⚠️ **LIKELY ROOT CAUSE**

**Scenario**: When `UpsertMdFile` + `ProcessMdFile` are in same batch, collapse removes `UpsertMdFile`.

**Issue Found**:
- `collapse.ts` line 37-40: When `ProcessMdFile` sees existing `UpsertMdFile`, it keeps `ProcessMdFile` and **removes** `UpsertMdFile`
- Comment says "Process on create - keep process (will read from disk)" - assumes file exists
- **Problem**: If file doesn't exist, we need `UpsertMdFile` to create it first!
- After collapse removes `UpsertMdFile`, dependency graph can't find it, so `ProcessMdFile` has no dependency
- `ProcessMdFile` executes before file is created → file not found error

**Code Location**: `collapse.ts` line 35-41

**Fix Needed**:
- Don't collapse `UpsertMdFile` + `ProcessMdFile` when file doesn't exist
- Keep both actions, let dependency graph ensure correct order
- Or: Only collapse if we can verify file exists (but we don't have that info in collapse)
- **Better**: Don't collapse `UpsertMdFile` + `ProcessMdFile` at all - always keep both

### Hypothesis 3: Execution Order Issue

**Scenario**: Topological sort orders correctly, but execution fails for some reason.

**Check**:
- Verify topological sort output includes all actions
- Check if any actions are filtered out before execution
- Verify executor handles all action types correctly

### Hypothesis 4: File Key Mismatch

**Scenario**: Dependency detector uses `coreSplitPathToKey` but `hasActionForKey` uses `makeSystemPathForSplitPath` - key format mismatch.

**Check**:
- `dependency-detector.ts` line 66: uses `coreSplitPathToKey`
- `ensure-requirements-helpers.ts` line 65: uses `makeSystemPathForSplitPath`
- Verify both produce same keys for same paths

---

## WebdriverIO Quirks to Address First

Before fixing the actual issues, check for WebdriverIO-specific problems:

1. **Timing Issues**: Tests might be checking file existence before async operations complete
   - Tests use `setTimeout(200)` - might not be enough
   - Check if `await manager.dispatch()` actually waits for completion

2. **Vault Reset**: `beforeEach` resets vault - might interfere with test isolation
   - Verify vault is properly reset between tests
   - Check if files from previous tests leak into current test

3. **Event Subscription**: Tests subscribe to events - might miss events due to timing
   - Event subscription happens before dispatch
   - Events might fire before subscription is set up

4. **API Availability**: Tests check `getVaultActionManagerTestingApi()` - might not be available
   - Early errors show "Cannot read properties of undefined (reading 'dispatch')"
   - Might be WebdriverIO initialization issue, not code issue

---

## Next Steps

1. **Verify WebdriverIO Issues First**:
   - Check if early "undefined" errors are WebdriverIO quirks
   - Verify test setup and teardown
   - Check timing issues

2. **Debug Dependency Graph**:
   - Add logging to see what dependencies are found
   - Verify `allActions` includes newly added actions
   - Check if dependency links are correct

3. **Debug Collapse Logic**:
   - Verify collapse doesn't break dependencies
   - Check if ProcessMdFile + UpsertMdFile collapse correctly

4. **Debug Execution Order**:
   - Log topological sort output
   - Verify all actions are executed
   - Check execution order matches dependencies

---

## Notes

- All other tests pass (19/22), so core functionality works
- Issues are specific to `ProcessMdFile` with missing files
- Weight-based sorting tests still pass (test name says "weight" but might just verify ordering works)
- Need to investigate before fixing - might be WebdriverIO quirks, not code issues

