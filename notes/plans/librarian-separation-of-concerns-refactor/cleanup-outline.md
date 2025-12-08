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

### 2. `healRootFilesystem` is a 150-line monolith

**Current responsibilities (lines 72-226):**
```
1. Heal file paths (uses healFile)           ← Layer 1 ✓
2. Track folder contents for cleanup         ← Layer 1?
3. Propagate note presence to ancestors      ← Layer 1?
4. Add meta-info to files missing it         ← Separate concern
5. Cleanup orphan folders                    ← Layer 3? (Q7)
```

**Problem:** Mixes Layer 1 (healing) with Layer 3 concerns (cleanup) and meta-info initialization.

**Options:**
| Option | Approach |
|--------|----------|
| A) Extract `initializeMetaInfo()` | Separate function for meta-info |
| B) Extract `cleanupOrphanFolders()` | Move to Layer 3 or separate pass |
| C) Keep as-is | Pragmatic, works, optimize later |

**Recommendation:** Start with C, extract later if complexity grows.

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

### 5. Meta-info initialization mixed with healing

**Current (lines 148-195):** Inside `healRootFilesystem`, reads file content to check meta.

**Problem:** 
- Healing should be pure path operations
- Meta-info initialization requires async file reads
- Different concerns mixed

**Options:**
| Option | Approach |
|--------|----------|
| A) Extract to `initializeMetaInfo(files)` | Called after healing |
| B) Make it Layer 3 (derived artifact) | Like codexes |
| C) Keep as-is | Pragmatic for startup |

**Recommendation:** A — extract but keep in `initTrees()` flow.

---

### 6. Orphan folder cleanup belongs in Layer 3

**Current (lines 197-220):** Inside `healRootFilesystem`, tracks folders and trashes empty ones.

**Plan (Q7):** Move to Layer 3 — diff sees "section has no notes" → trash folder.

**Problem:** Currently not diff-based, runs at startup and on rename.

**Options:**
| Option | Approach |
|--------|----------|
| A) Move to `mapDiffToActions` | Diff detects empty sections |
| B) Separate `cleanupOrphanFolders()` | Called explicitly |
| C) Keep as-is | Works at startup |

**Recommendation:** B for now — extract, optimize later.

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
| Extract `initializeMetaInfo()` from `healRootFilesystem` | 2hr | Separation of concerns |
| Extract `cleanupOrphanFolders()` from `healRootFilesystem` | 2hr | Separation of concerns |
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
2. **Extract `initializeMetaInfo()`** — clearer responsibilities
3. **Extract `cleanupOrphanFolders()`** — clearer responsibilities
4. **Move `selfEventTracker`** — if touching event flow
5. **Performance optimization** — only if measured need

---

## File Changes Summary

| File | Change |
|------|--------|
| `diffing/tree-diff-applier.ts` | Remove deprecated class |
| `diffing/index.ts` | Remove deprecated class export |
| `filesystem/library-reader.ts` | Remove deprecated class |
| `librarian.ts` | Extract `initializeMetaInfo()`, `cleanupOrphanFolders()` |
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
- [ ] `healRootFilesystem` < 50 lines (extractions done)
- [ ] Clear separation: healing vs meta-info vs cleanup
- [ ] Tests use pure functions directly
- [ ] (Optional) `selfEventTracker` in `VaultEventService`
