# Codex Status Click Debug

## Issue Summary

Clicking section checkbox in codex generates correct changes but Obsidian reverts them.

## Observed Flow

1. **mousedown** (capture phase) - our handler fires
   - `wasChecked=false` → `newStatus=Done`
   - Tree updated: `propagateStatus` sets all scrolls to Done
   - Transform generates correct content with `[x]` checkboxes
   - `editor.transaction({ changes })` applies 5 line changes
   - Immediately after: `matchesExpected=true` (content correct!)

2. **Obsidian's handler** (likely mouseup or click)
   - Obsidian has its own checkbox toggle logic
   - Runs AFTER our mousedown handler completes
   - Toggles the checkbox line back, reverting our change

3. **Final result**: P2 shows `[ ]` instead of `[x]`

## Evidence from Logs

```
[doApplyTransform] LINE 12 DIFF:
  OLD: "- [ ] [[__;;P2|P2]] "
  NEW: "- [x] [[__;;P2|P2]] "
[doApplyTransform] total diffs=5 changes=5
[doApplyTransform] APPLYING 5 changes via transaction
[doApplyTransform] AFTER transaction: matchesExpected=true  ← CORRECT!

Final result: P2 = [ ]  ← REVERTED by Obsidian!
```

## Root Cause

We only prevent `mousedown` event. Obsidian's checkbox handler likely uses `mouseup` or `click` event.

Event sequence for checkbox click:
1. mousedown (we intercept) ✓
2. mouseup (Obsidian intercepts) ← Problem!
3. click (also possible)

## Fix

Add mouseup/click listener in capture phase that prevents default for codex checkboxes.

Options:
1. **Option A**: In CheckboxDetector, after detecting codex checkbox on mousedown, register a one-time mouseup/click listener that prevents default
2. **Option B**: Always listen to mouseup/click for codex checkboxes and prevent default

Going with Option A - register one-time listener on mousedown when we handle codex checkbox.

## Files Modified

- `src/managers/obsidian/user-event-interceptor/events/click/checkbox/detector.ts`
  - Add mouseup/click prevention after detecting codex checkbox
