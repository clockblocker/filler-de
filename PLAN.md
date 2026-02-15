# Auto DRY Refactoring Plan

## Scope

Two high-confidence, low-risk DRY extractions targeting exact/near-exact duplicate code.

### Assumption
Scoping to the two highest-value duplications with near-100% similarity. Other duplications (codec NodeName validation loops, propagation framework abstraction) are lower similarity or higher risk and are left for future work.

---

## Refactoring 1: Extract `serializeEntriesWithMeta()` helper

**Problem**: The pattern `dictNoteHelper.serialize(entries)` → check `meta` → `noteMetadataHelper.upsert(meta)(body)` is copy-pasted 4 times across 2 files:
- `propagate-inflections.ts` (line 227-233)
- `propagate-morphemes.ts` (lines 194-199, lines 232-237)

All 4 occurrences are byte-for-byte identical in structure.

**Solution**: Add a `serializeWithMeta` method to `dictNoteHelper` facade in `src/stateless-helpers/dict-note/index.ts`. It wraps serialize + metadata upsert into one call.

**Files modified**:
- `src/stateless-helpers/dict-note/index.ts` — add `serializeWithMeta(entries: DictEntry[]): string`
- `src/stateless-helpers/dict-note/internal/serialize-with-meta.ts` — new file with the helper implementation
- `src/commanders/textfresser/commands/generate/steps/propagate-inflections.ts` — replace inline pattern with `dictNoteHelper.serializeWithMeta(entries)`
- `src/commanders/textfresser/commands/generate/steps/propagate-morphemes.ts` — replace 2 inline occurrences

---

## Refactoring 2: Merge `computeLeafHealingForScroll` / `computeLeafHealingForFile`

**Problem**: Two exported functions in `compute-leaf-healing.ts` are 95% identical — same logic, differing only in:
- Parameter types (`ScrollNodeLocator` vs `FileNodeLocator`, `SplitPathToMdFileInsideLibrary` vs `SplitPathToFileInsideLibrary`)
- Kind check (`SplitPathKind.MdFile` vs `SplitPathKind.File`)
- Action kind (`"RenameMdFile"` vs `"RenameFile"`)

**Solution**: Extract shared logic into a private `computeLeafHealingCore()` function. Keep the two public functions as thin type-safe wrappers (one-liner delegates) so call sites don't change.

**Files modified**:
- `src/commanders/librarian/healer/healing-computers/compute-leaf-healing.ts` — add `computeLeafHealingCore()`, simplify both public functions to delegate

No changes to callers or exports needed.

---

## Steps

1. Create branch `auto-dry` from current HEAD
2. Read and implement `serializeWithMeta` helper (new file + update facade)
3. Replace 4 inline serialize+meta patterns in propagate-inflections.ts and propagate-morphemes.ts
4. Extract `computeLeafHealingCore()` in compute-leaf-healing.ts, keep public wrappers as delegates
5. Run `bun run typecheck:changed` to verify no type errors
6. Run `bun test` to verify no test regressions
7. Run `bun fix` to ensure lint/format compliance
8. Commit with trailers
9. Push branch and open PR
10. Switch back to original branch (`nightshift`)
