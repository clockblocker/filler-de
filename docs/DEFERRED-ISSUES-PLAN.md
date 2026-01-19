# Plan: Tackle Deferred Medium Priority Issues (9, 10, 13)

**Priority order:** Issue 9 first → Issue 10 (Option C) → Issue 13 gradual

---

## Issue 9: Repetitive Event Translators (FIRST)

### Current State
6+ switches on VaultEventKind across:
- `make-event-library-scoped.ts` / `make-event-vault-scoped.ts` (scope layer)
- `materialize-scoped-bulk.ts` (4 functions, nested switches on splitPath.kind)
- Helpers in `vault-events-for-events.ts`, `make-key-for-event.ts`

### Solution: Event Helpers Module (follows ActionHelpers pattern)

**New files to create:**
```
src/managers/obsidian/vault-action-manager/helpers/
  event-helpers.ts         # VaultEvent predicates, path extractors, visitor

src/.../bulk-vault-action-adapter/helpers/
  scoped-event-helpers.ts      # LibraryScopedVaultEvent helpers
  materialized-event-helpers.ts # MaterializedNodeEvent helpers
```

**Core patterns:**

1. **Type guards** - `isFileEvent(e)`, `isCreateEvent(e)`, `isInsideScope(e)`

2. **Path extractors** - `getEventSplitPath(e)`, `getRenameFromPath(e)`

3. **Mapping table** (eliminates nested switches):
```typescript
const SPLIT_PATH_TO_NODE_KIND: Record<SplitPathKind, TreeNodeKind | null> = {
  File: TreeNodeKind.File,
  MdFile: TreeNodeKind.Scroll,
  Folder: TreeNodeKind.Section,
};
```

4. **Visitor pattern**:
```typescript
return visitEvent(event, {
  FileCreated: (e) => scopeSimpleEvent(e),
  FileRenamed: (e) => scopeRenameEvent(e),
  // ...all 6 cases
});
```

### Files to Modify

| File | Change |
|------|--------|
| `helpers/event-helpers.ts` | CREATE |
| `helpers/scoped-event-helpers.ts` | CREATE |
| `helpers/materialized-event-helpers.ts` | CREATE |
| `materialize-scoped-bulk.ts` | MODIFY - use helpers, eliminate nested switches |
| `make-event-libray-scoped.ts` | MODIFY - use visitor |
| `make-event-vault-scoped.ts` | MODIFY - use visitor |

### Migration Order
1. Create helper files (additive, no breaks)
2. Add tests for helpers
3. Migrate one file at a time, test after each:
   - `materialize-scoped-bulk.ts` (highest ROI)
   - `make-event-library-scoped.ts`
   - `make-event-vault-scoped.ts`

---

## Issue 10: SelfEventTracker Race Conditions (SECOND)

**Approach: Remove tracking, make tree idempotent**

### Why SelfEventTracker Exists (Loop Prevention)

Current flow without filtering would cause infinite loop:
```
Event → TreeAction → tree.apply() + computeCodexImpact()
                            ↓
                    CodexImpact (generated even if node existed!)
                            ↓
                    codexRecreations (vault writes)
                            ↓
                    Obsidian emits FileModified → loop!
```

**Key insight:** The current code generates actions based on action TYPE, not action EFFECT. Every Create/Delete/Move generates CodexImpact regardless of whether tree state changed.

### Solution: Make Entire Pipeline State-Change-Aware

**Required changes:**

1. **Tree.apply() returns change indicator**
   ```typescript
   type ApplyResult = { changed: boolean; node: TreeNode | null };

   applyCreate(action): ApplyResult {
     const existing = this.findNode(targetLocator);
     if (existing) return { changed: false, node: existing };
     // ... create new node
     return { changed: true, node };
   }
   ```

2. **Healer skips healing if no change**
   ```typescript
   getHealingActionsFor(action: TreeAction): ApplyResult {
     const result = this.tree.apply(action);
     if (!result.changed) {
       return { healingActions: [], codexImpact: EMPTY_IMPACT };
     }
     // ... compute healing only if state changed
   }
   ```

3. **CodexImpact only generated on actual changes**
   - Move `computeCodexImpact()` to AFTER tree.apply()
   - Only compute if `result.changed === true`

4. **Remove SelfEventTracker** (now safe because loops prevented by #1-3)

### Files to Modify

| File | Change |
|------|--------|
| `tree.ts` | Change apply() to return `{ changed, node }` |
| `healer.ts` | Skip healing if !changed, move codexImpact after apply |
| `healing-transaction.ts` | Handle new return type |
| `self-event-tracker.ts` | DELETE |
| `facade.ts` | REMOVE SelfEventTracker |
| `dispatcher.ts` | REMOVE register() calls |
| `bulk-event-emmiter.ts` | REMOVE shouldIgnore() filter |

### Testing Strategy

**Must verify no loops occur:**
1. Create file → should NOT trigger duplicate healing
2. Rename folder with codex → should NOT infinite loop on codex updates
3. Delete folder → should NOT regenerate deleted nodes

**Test: Add logging to detect unexpected re-entry:**
```typescript
// In healer.ts (temporary, for debugging)
if (!result.changed) {
  log.debug("[Healer] No-op action detected", JSON.stringify({ actionType: action.actionType }));
}
```

---

## Issue 13: Type Assertions Masking Bugs (GRADUAL)

### Critical Patterns (34 occurrences)

| Pattern | Count | Risk |
|---------|-------|------|
| Unchecked `as SectionNodeSegmentId` | 11 | Invalid segment IDs corrupt tree |
| `as unknown as` double casts | 4 | Bypasses all type checking |
| Silent error `continue` | 2 | Silent state corruption |
| Array casts without validation | 3 | Invalid node names in suffixes |

### Fix Approach

**1. Validate at source (immediate):**
```typescript
function assertSectionSegmentId(id: string, codecs: Codecs): SectionNodeSegmentId {
  const parsed = codecs.segmentId.parseSegmentId(id);
  if (parsed.isErr() || parsed.value.targetKind !== TreeNodeKind.Section)
    throw new HealingError({ kind: "InvalidSegmentId", id });
  return id as SectionNodeSegmentId;
}
```

**2. Log all skips:**
```typescript
if (parseResult.isErr()) {
  log.warn("[Critical] Skipping parse error", JSON.stringify({ segId, error: parseResult.error }));
  continue;
}
```

**3. Gradual migration:**
- Add validation helpers to `path-computer.ts`
- Replace casts one file at a time
- Track via TODO comments linking to this issue

---

## Verification

**Issue 9:** `bun test` passes after each migration step
**Issue 10:** Manual test: create file while folder is being trashed → file should appear
**Issue 13:** `bun run lint` + `bun test` after each validation addition

---

## Decisions Made

- **Visitor pattern:** Strict (all 6 cases required, compile error if missing)
- **SelfEventTracker:** Remove entirely, make tree idempotent (pure idempotency, no fallback)
- **Priority:** Issue 9 → Issue 10 → Issue 13

## Open Questions (to investigate during implementation)

1. Is tree.apply() already partially idempotent? Need to audit current behavior.
2. Can we simplify generic `SK extends SplitPathKind` to eliminate `as unknown as`?
