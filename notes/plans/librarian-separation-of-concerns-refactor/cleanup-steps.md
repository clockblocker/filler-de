# Cleanup Steps

Concrete steps to finish the Librarian refactor cleanup.

---

## ~~Phase 1: Remove deprecated classes~~ ✅ DONE

- Tests updated to use `mapDiffToActions()`, `readNoteDtos()`
- `TreeDiffApplier` class removed
- `LibraryReader` class removed
- All 138 tests pass

---

## ~~Phase 2: Resolve `HealResult` return type~~ ✅ DONE

**Decision:** Keep `HealResult` — `targetPath` needed by callers.

---

## ~~Phase 3: `selfEventTracker` location~~ DEFERRED

Low priority. Only touch if refactoring event flow.

---

## ~~Phase 4: Orphan cleanup timing~~ ✅ DONE

**Decision:** Keep as-is (startup + after rename).

---

## ~~⚠️ Part 5: `healRootFilesystem` performance~~ ✅ DONE

Implemented batch/debounce (Option B):

```typescript
const RENAME_DEBOUNCE_MS = 100;

// Debounce state
private pendingRenameRoots = new Set<RootName>();
private renameDebounceTimer: ReturnType<typeof setTimeout> | null = null;

onFileRenamed(file, oldPath) {
  // Layer 1: Immediate per-file heal
  const healResult = healFile(prettyPath, rootName);
  // ... execute heal actions ...

  // Debounce: collect roots, run full pipeline after settling
  this.pendingRenameRoots.add(rootName);
  this.scheduleRenameFlush();
}

flushPendingRenames() {
  for (const rootName of roots) {
    await this.healRootFilesystem(rootName);  // Full heal
    await this.reconcileSubtree(rootName, []); // Full tree
  }
  await this.regenerateAllCodexes();          // Codexes
}
```

**Result:** Folder with 100 files now triggers 1 full pipeline instead of 100.

---

## Summary

| Phase | Task | Priority | Status |
|-------|------|----------|--------|
| 1 | Remove deprecated classes | High | ✅ DONE |
| 2 | HealResult decision | Done | ✅ Keep |
| 3 | selfEventTracker location | Low | Deferred |
| 4 | Orphan cleanup timing | Done | ✅ Keep |
| 5 | healRootFilesystem perf | Low | ✅ DONE (debounce) |
