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

## ⚠️ Part 5: `healRootFilesystem` performance

**The bitch.**

### Problem

`onFileRenamed` calls `healRootFilesystem(rootName)` — scans entire root.

```
User renames folder with 100 files
→ 100 rename events
→ 100 × healRootFilesystem calls
→ 100 × O(n) scans
= O(n²) 💀
```

### Why it exists

Folder moves trigger per-file rename events. Need to:
1. Heal all files in moved folder (basenames may need suffix update)
2. Cleanup orphan folders (old location)
3. Update meta-info

### Options

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| A) Targeted heal | Only heal files under `oldPath` | Fast | Complex path tracking |
| B) Batch/debounce | Collect events, heal once after 100ms | Simple | Delay before heal |
| C) Hybrid | Targeted for single file, batch for folder | Best of both | Most complex |
| D) Keep as-is | Profile first | Simple | Slow for large folders |

### Lean: Batch/debounce

```typescript
// Pseudocode (naive — DON'T DO THIS)
onFileRenamed(file) {
  this.debouncedHeal(rootName);        // ← debounced
  await this.reconcileSubtree(...);    // ← runs immediately! 💥
}
```

### ⚠️ Edge case: reconcile before heal

If only healing is debounced, `reconcileSubtree` runs with stale filesystem state.

| Option | Approach |
|--------|----------|
| A) Debounce entire handler | Heal + reconcile + codex all in one batch |
| B) Two-phase | Immediate heal, debounced reconcile |
| C) Track in-flight | Block reconcile until heal completes |

**Recommendation: A** — debounce the whole `onFileRenamed`, not just healing.

```typescript
// Pseudocode (correct)
private pendingRenames = new Map<string, { oldPath, newPath, rootName }>();
private renameDebounceTimer: number | null = null;

onFileRenamed(oldPath, newPath) {
  const rootName = getRootName(newPath);
  const key = `${rootName}`;  // or per-file if needed
  this.pendingRenames.set(key, { oldPath, newPath, rootName });
  
  if (this.renameDebounceTimer) clearTimeout(this.renameDebounceTimer);
  this.renameDebounceTimer = setTimeout(async () => {
    const roots = new Set([...this.pendingRenames.values()].map(r => r.rootName));
    this.pendingRenames.clear();
    
    for (const root of roots) {
      // Full pipeline: heal → tree → codex
      await this.healRootFilesystem(root);
      await this.reconcileTree(root);
      await this.updateCodexes(root);
    }
  }, 100);
}
```

**Key insight:** Debounce at event boundary, run full pipeline in batch.

### Action

1. **Profile first** — is this actually slow in practice?
2. If yes → implement B (batch/debounce)
3. If still slow → consider A (targeted heal)

### Blocked by

Nothing. Can do anytime. Low priority until measured.

---

## Summary

| Phase | Task | Priority | Status |
|-------|------|----------|--------|
| 1 | Remove deprecated classes | High | ✅ DONE |
| 2 | HealResult decision | Done | ✅ Keep |
| 3 | selfEventTracker location | Low | Deferred |
| 4 | Orphan cleanup timing | Done | ✅ Keep |
| 5 | healRootFilesystem perf | Low | Profile first |
