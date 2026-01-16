## Known Limitation: Cascading Folder Renames

When multiple folder renames interact with existing folders, the healer may produce unexpected nesting:

**Scenario:**
1. Initial state: `Library/Recipe/Pie/` (existing folder with children)
2. Rename `Berry_Pie` → `Berry-Pie` at `Library/Recipe/`
3. Healing moves Berry under existing Pie: `Library/Recipe/Pie/Berry/`
4. Rename `Pie` → `Fish-Pie` at `Library/Recipe/`
5. Entire Pie folder (now containing Berry) is renamed to Fish-Pie
6. Healing moves Fish-Pie to `Library/Recipe/Pie/Fish/`

**Result:** Berry ends up nested under Fish (`Library/Recipe/Pie/Fish/Berry/`) instead of as a sibling (`Library/Recipe/Pie/Berry/`).

**Root cause:** The healer doesn't track that Berry was already canonically placed. When the parent folder (Pie) is renamed and moved, all children move with it.

**Future work:** The healer could detect previously-healed nodes and preserve their canonical locations during parent folder renames.

---

## Investigation Guide

### Reproduction Scenario

**Initial state:**
```
Library/Recipe/Pie/          (existing folder with children)
Library/Recipe/Berry_Pie/    (folder to rename)
Library/Recipe/Fish_Pie/     (folder to rename)
```

**User actions:**
1. Rename `Berry_Pie` → `Berry-Pie`
2. Rename `Fish_Pie` → `Fish-Pie`

**Expected final state:**
```
Library/Recipe/Pie/Berry/
Library/Recipe/Pie/Fish/
```

**Actual state:**
```
Library/Recipe/Pie/Fish/Berry/   ← Berry nested under Fish
```

### Step-by-Step Breakdown

1. `Berry_Pie` → `Berry-Pie` (suffix = `["Pie"]`)
   - Canonicalization: `Library/Recipe/Pie/Berry/` ✓
   - Healer moves folder correctly

2. `Pie` folder now contains `Berry/` as a child

3. `Fish_Pie` → `Fish-Pie` (suffix = `["Pie"]`)
   - Canonicalization: `Library/Recipe/Pie/Fish/` ✓
   - But wait... `Pie` folder moved in step 1!

4. When healing renames `Pie` → moves it, all children (including Berry) move too

### Root Cause Analysis

The healer treats the tree as a simple filesystem hierarchy. When a parent folder moves, children move with it. The healer doesn't distinguish between:
- Children that were **explicitly placed** (already canonical)
- Children that are **incidentally nested** (just happen to be there)

### Key Code Paths to Investigate

1. **Healing action generation:**
   - `src/commanders/librarian-new/healer/library-tree/tree-action/apply-tree-action.ts`
   - How does `apply()` generate healing actions for folder renames?

2. **Tree mutation:**
   - `src/commanders/librarian-new/healer/library-tree/tree.ts`
   - How does tree track node canonical status?

3. **Folder move execution:**
   - `src/commanders/librarian-new/healer/library-tree/tree-action/actions/rename-section.ts`
   - Does it re-check children's canonical paths?

### Test Cases to Add

```typescript
// In e2e tests
it("should handle multiple folder renames to same parent", async () => {
  // Setup: Library/Recipe/Pie/, Berry_Pie/, Fish_Pie/
  // Action: rename both to *-Pie
  // Assert: Berry and Fish are siblings under Pie, not nested
});
```

### Debug Logging

Enable tracing in `tests/tracing/` to capture:
- Tree state before/after each healing action
- Full healing action sequence
- Node canonical status changes

Key log file: `tests/tracing/logs/observed-bulks-*.log`

