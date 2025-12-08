# Librarian Cleanup Plan

Post-refactor cleanup to finalize the 3-layer architecture.

---

## Outstanding Issues

### 1. Deprecated class wrappers still exist

**Files:**
- `diffing/tree-diff-applier.ts` — `TreeDiffApplier` class (deprecated)
- `filesystem/library-reader.ts` — `LibraryReader` class (deprecated)

**Status:** Pure functions extracted, classes kept for backward compat.

**Action:** Remove deprecated classes once all consumers migrated.

**Blocked by:** Need to check all usages (tests, main.ts, etc.)

---

### 2. ~~`healRootFilesystem` is a 150-line monolith~~ ✅ DONE

**Extracted:**
- `initializeMetaInfo()` — 56 lines
- `cleanupOrphanFolders()` — 86 lines
- `healRootFilesystem()` — 35 lines (thin orchestrator)

---

### 3. `onFileRenamed` still calls full `healRootFilesystem(rootName)`

**Current (line 402-403):**
```typescript
// Layer 2: Reconcile tree (full root heal for folder moves)
await this.healRootFilesystem(rootName);
```

**Problem:** Scans entire Library root on every rename. O(n) for n files.

**Why it exists:** Folder moves trigger N file rename events. Need to heal all files in moved folder.

**Options:**
| Option | Approach | Complexity |
|--------|----------|------------|
| A) Targeted heal | Only heal files in affected folder | Medium |
| B) Batch/debounce | Collect events, heal once after settling | Medium |
| C) Keep as-is | Correct but slow for large libraries | Low |

**Recommendation:** C for now. Profile first — may not be a real issue.

---

### 4. `selfEventTracker` location

**Current:** Instance field on `Librarian`
**Plan (Q2/Q8):** Move to `VaultEventService`

**Reasoning:** VaultEventService is the event boundary — it should track what we caused.

**Blocked by:** Refactor would touch event flow. Low priority.

---

### 5. ~~Meta-info initialization mixed with healing~~ ✅ DONE

Extracted to `initializeMetaInfo()`. Called at startup + after renames.

---

### 6. ~~Orphan folder cleanup belongs in Layer 3~~ ✅ DONE

Extracted to `cleanupOrphanFolders()`. Called at startup + after renames.

**Future:** Could move to diff-based Layer 3 if needed.

---

## Points of Attack

### Low-hanging fruit (do first)

| Task | Effort | Impact |
|------|--------|--------|
| Remove deprecated `TreeDiffApplier` class | 30min | Code cleanup |
| Remove deprecated `LibraryReader` class | 30min | Code cleanup |
| Update tests to use pure functions directly | 1hr | Test cleanup |

### Medium effort

| Task | Effort | Impact |
|------|--------|--------|
| ~~Extract `initializeMetaInfo()` from `healRootFilesystem`~~ | ~~2hr~~ | ✅ DONE |
| ~~Extract `cleanupOrphanFolders()` from `healRootFilesystem`~~ | ~~2hr~~ | ✅ DONE |
| Move `selfEventTracker` to `VaultEventService` | 2hr | Architecture alignment |

### Deferred (optimize later)

| Task | Effort | Impact |
|------|--------|--------|
| Targeted heal in `onFileRenamed` | 4hr | Performance |
| Batch/debounce folder move events | 4hr | Performance |
| Move orphan cleanup to Layer 3 diff | 4hr | Architecture purity |

---

## Proposed Order

1. **Remove deprecated classes** — clean up first
2. ~~**Extract `initializeMetaInfo()`**~~ ✅ DONE
3. ~~**Extract `cleanupOrphanFolders()`**~~ ✅ DONE
4. **Move `selfEventTracker`** — if touching event flow
5. **Performance optimization** — only if measured need

---

## File Changes Summary

| File | Change |
|------|--------|
| `diffing/tree-diff-applier.ts` | Remove deprecated class |
| `diffing/index.ts` | Remove deprecated class export |
| `filesystem/library-reader.ts` | Remove deprecated class |
| `librarian.ts` | ~~Extract `initializeMetaInfo()`, `cleanupOrphanFolders()`~~ ✅ |
| `vault-event-service.ts` | (Maybe) receive `selfEventTracker` |
| `tests/librarian/diffing/tree-diff-applier.test.ts` | Use pure functions |
| `tests/librarian/filesystem/library-reader.test.ts` | Use pure functions |

---

## Questions to Resolve

1. **Any external consumers of deprecated classes?** Check main.ts, other commanders.

2. **Is `healRootFilesystem` performance actually an issue?** Profile before optimizing.

3. **Should orphan cleanup be event-driven or scheduled?** Currently runs on every rename.

4. **Should `healFile` return `HealResult` or just `VaultAction[]`?**
   Currently returns `HealResult` with metadata (`targetPath`, `quarantined`).
   Could simplify to just actions if metadata not needed.

---

## Success Criteria

- [ ] No deprecated class wrappers in codebase
- [x] `healRootFilesystem` < 50 lines (35 lines ✅)
- [x] Clear separation: healing vs meta-info vs cleanup ✅
- [ ] Tests use pure functions directly
- [ ] (Optional) `selfEventTracker` in `VaultEventService`
