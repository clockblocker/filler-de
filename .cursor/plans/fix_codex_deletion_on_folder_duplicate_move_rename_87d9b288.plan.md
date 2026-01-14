---
name: Fix Codex Deletion on Folder Duplicate/Move/Rename
overview: Fix inconsistent codex updates when folders are duplicated, moved, or renamed. Process codex files directly from bulk events (no FS access) to detect and delete wrong-suffix codexes.
todos:
  - id: analyze-codex-deletion-logic
    content: Analyze current codexImpactToDeletions logic and identify gaps for created sections
    status: pending
  - id: design-bulk-extraction
    content: Design extractInvalidCodexesFromBulk function to extract and validate codex files from bulk events
    status: pending
    dependencies:
      - analyze-codex-deletion-logic
  - id: implement-extract-invalid-codexes
    content: Implement extractInvalidCodexesFromBulk in codex-impact-to-actions.ts to detect wrong-suffix codexes from bulk events
    status: pending
    dependencies:
      - design-bulk-extraction
  - id: integrate-pipeline
    content: Integrate extractInvalidCodexesFromBulk into processBulkEvent pipeline in helpers.ts
    status: pending
    dependencies:
      - implement-extract-invalid-codexes
  - id: test-duplicate-fix
    content: Update test to verify 002-duplicate generates correct deletion for wrong-suffix codex
    status: pending
    dependencies:
      - integrate-pipeline
  - id: review-move-rename-logic
    content: Review buildMovedCodexPath and descendant deletion logic for edge cases
    status: pending
  - id: test-move-rename-cases
    content: Add tests for nested folder moves and complex rename chains with multiple codexes
    status: pending
    dependencies:
      - review-move-rename-logic
---

# Fix Codex Deletion on Folder Duplicate/Move/Rename

## Problem Analysis

### Root Cause 1: Duplicate Folder Creation

When Obsidian duplicates a folder (002-duplicate):

- Creates new folder `kid1 1` with copied files including codex `__-kid1-mommy-parents.md` (old suffix)
- Bulk event contains `FileCreated` for this codex file
- Currently codex events are skipped in `translateMaterializedEvents` (line 44)
- `codexImpactToDeletions` only handles `impact.deleted` and `impact.renamed`
- **Missing**: Detection of wrong-suffix codexes from bulk events

### Root Cause 2: Move/Rename Edge Cases

- Current logic handles direct moves/renames (logs 003, 004 show correct deletions)
- User reports "multiple codexes exist" suggesting:
  - Descendant codexes may not be fully handled
  - Complex nested moves may miss some codexes

## Solution Strategy

### Process Codex Files from Bulk Events (No FS Access)

The bulk events already contain codex file creation events (e.g., `FileCreated` for `__-kid1-mommy-parents.md`). We should:

1. Extract codex file events from bulk events (currently skipped in `translateMaterializedEvents`)
2. For each codex file event, validate its suffix against the current tree state
3. If suffix is wrong for the location, add deletion action
4. Process this before/alongside `codexImpactToDeletions`

**Key Insight**: In 002-duplicate, the bulk event contains:

- `FileCreated` for `__-kid1-mommy-parents.md` at `Library/parents/mommy/kid1 1`
- This codex has wrong suffix (should be `__-kid1 1-mommy-parents.md`)
- We can detect this by comparing the codex's suffix with what `computeCodexSplitPath` would generate for that location

**Pros**:

- No file system access needed
- Processes what Obsidian tells us
- Fits existing pipeline architecture
- Handles duplicates, moves, renames uniformly

## Implementation Plan

### Phase 1: Extract and Validate Codex Files from Bulk Events

1. Create new function `extractInvalidCodexesFromBulk` in [`codex-impact-to-actions.ts`](src/commanders/librarian-new/healer/library-tree/codex/codex-impact-to-actions.ts):

   - Extract `FileCreated` and `FileRenamed` events for codex files from bulk event
   - For each codex file, parse its path to get section chain
   - Compute expected codex path using `computeCodexSplitPath` for that section chain
   - Compare observed basename with expected basename
   - If mismatch, return deletion action

2. Update pipeline in [`helpers.ts`](tests/unit/librarian/library-tree/pipeline/helpers.ts):

   - Call `extractInvalidCodexesFromBulk` after building tree actions but before `codexImpactToDeletions`
   - Merge invalid codex deletions with codex impact deletions

3. Integration point:

   - Pass bulk event to pipeline (already available in `processBulkEvent`)
   - Extract codex events before they're skipped in translation
   - Validate against tree state after tree actions are applied

### Phase 2: Fix Move/Rename Edge Cases

1. Review `buildMovedCodexPath` logic in [`codex-impact-to-actions.ts`](src/commanders/librarian-new/healer/library-tree/codex/codex-impact-to-actions.ts):

   - Verify descendant codex deletion handles all nested cases
   - The new `extractInvalidCodexesFromBulk` should also catch moved codexes with wrong suffixes
   - Add tests for complex nested moves

2. Ensure `extractInvalidCodexesFromBulk` handles all codex events:

   - `FileCreated` events (duplicates, new codexes)
   - `FileRenamed` events (moved codexes with old suffix)
   - Both should be validated against current tree state

### Phase 3: Testing

1. Update test in [`observed-bulks.test.ts`](tests/unit/librarian/library-tree/pipeline/observed-bulks.test.ts):

   - Verify 002-duplicate generates deletion for `__-kid1-mommy-parents.md` in `kid1 1` folder

2. Add tests for:

   - Nested folder moves with multiple codexes
   - Complex rename chains
   - Multiple codexes in same folder scenarios

## Implementation Details

### Extracting Codex Files from Bulk Events

The bulk event structure contains `events` array with `FileCreated` events. We need to:

1. Filter events where `kind === "FileCreated"` and basename starts with `__`
2. Use `isCodexSplitPath` helper to confirm11 it's a codex
3. Parse the codex path to determine which section it belongs to
4. Compute expected codex path for that section
5. Compare and generate deletion if mismatch

### Parsing Section Chain from Codex Path

For a codex at `Library/parents/mommy/kid1 1/__-kid1-mommy-parents.md`:

- Path parts: `["Library", "parents", "mommy", "kid1 1"]`
- Section chain: `[Library, parents, mommy, kid1 1]` (all path parts except filename)
- Expected suffix: `["kid1 1", "mommy", "parents"]` (reversed, excluding root)
- Expected basename: `__-kid1 1-mommy-parents`
- Observed basename: `__-kid1-mommy-parents` → **MISMATCH** → Delete

### Integration Point

Add to pipeline in `processBulkEvent` (helpers.ts):

```typescript
// After Step 1: Build tree actions
const treeActions = buildTreeActions(normalizedBulk, codecs, rules);

// Step 2: Process each action through healer (mutates tree state)
// ... existing code ...

// NEW: Extract invalid codexes from bulk event (after tree state updated)
const invalidCodexDeletions = extractInvalidCodexesFromBulk(
  normalizedBulk,
  healer, // tree state after actions applied
  codecs,
);

// Step 4: Convert codex deletions (merge with invalid codexes)
const deletionActions = [
  ...invalidCodexDeletions,
  ...codexImpactToDeletions(mergedCodexImpact, healer, codecs),
];
```

## Files to Modify

1. [`codex-impact-to-actions.ts`](src/commanders/librarian-new/healer/library-tree/codex/codex-impact-to-actions.ts) - Add `extractInvalidCodexesFromBulk` function
2. [`helpers.ts`](tests/unit/librarian/library-tree/pipeline/helpers.ts) - Integrate invalid codex extraction into pipeline
3. [`librarian.ts`](src/commanders/librarian-new/librarian.ts) - Integrate invalid codex extraction into `handleBulkEvent` (if needed)
4. Test files - Add/update tests