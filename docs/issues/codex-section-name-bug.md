# Codex Section Name Extraction Bug

## Problem

`getCodexSectionName()` in `codex-utils.ts` incorrectly extracts section names from codex basenames. It only strips the `__` prefix, ignoring suffixes that codex files contain.

### Current Behavior

```typescript
getCodexSectionName("__Library")      // ✅ "Library" (correct - no suffix)
getCodexSectionName("__Child-Parent") // ❌ "Child-Parent" (wrong - should be "Child")
```

### Expected Behavior

Codex files follow the same suffix pattern as regular files:
- Root codex: `__Library` (no suffix)
- Nested codex: `__Child-Parent` (suffix = parent chain reversed)

Section names should be the **coreName** only, without suffix.

## Impact Analysis

### ✅ Current Status: **No Active Impact**

**Good news:** `getCodexSectionName()` is **NOT currently used** in production code. Only referenced in:
- Unit tests (`tests/unit/librarian/utils/codex-utils.test.ts`)
- Function definition itself

### ⚠️ Potential Impact Areas

If this function is used in the future, it would break:

1. **Section name extraction from codex files**
   - Would return `"Child-Parent"` instead of `"Child"`
   - Would cause mismatches when comparing section names

2. **Tree reconciliation**
   - If used to map codex files back to sections
   - Would fail to match sections correctly

3. **Codex cleanup/orphan detection**
   - If used to validate codex file names
   - Would incorrectly identify valid codexes as orphans

### 🔍 How Other Code Handles This Correctly

The codebase already has correct patterns:

1. **`parseBasename()`** - Correctly extracts `coreName` from basenames with suffixes:
   ```typescript
   parseBasename("__Child-Parent") // { coreName: "__Child", splitSuffix: ["Parent"] }
   ```

2. **`parseCodexLinkTarget()`** - Correctly handles codex links:
   ```typescript
   parseCodexLinkTarget("__Child-Parent") // ["Parent", "Child"]
   ```

3. **`codex-builder.ts`** - Builds codex names correctly:
   ```typescript
   // Builds: __Child-Parent from section "Child" with parent chain ["Parent"]
   ```

## Questions

1. **Should `getCodexSectionName()` be fixed or deprecated?**
   - If fixed: Should use `parseBasename()` to extract coreName, then strip `__` prefix
   - If deprecated: Remove from codebase and tests

2. **What is the correct implementation?**
   - Option A: Strip prefix, then parse suffix to get coreName
     ```typescript
     getCodexSectionName("__Child-Parent") // "Child"
     ```
   - Option B: Return full name without prefix (current behavior, but wrong)
   - Option C: Return parsed coreName without prefix
     ```typescript
     getCodexSectionName("__Child-Parent") // "Child" (strips __, then parses)
     ```

3. **Should we add tests for suffix cases?**
   - Current tests only cover root codexes without suffixes
   - Missing: `__Child-Parent`, `__A-B-C` cases

## Recommended Fix

```typescript
export function getCodexSectionName(codexBasename: string): string {
	if (!isBasenamePrefixedAsCodex(codexBasename)) {
		return codexBasename;
	}
	
	// Strip prefix first
	const withoutPrefix = codexBasename.slice(CODEX_PREFIX.length);
	
	// Parse to extract coreName (handles suffixes correctly)
	const { coreName } = parseBasename(withoutPrefix);
	
	return coreName;
}
```

**Note:** This requires importing `parseBasename` from `./parse-basename`.

## Files Affected

- `src/commanders/librarian/utils/codex-utils.ts` - Bug location
- `tests/unit/librarian/utils/codex-utils.test.ts` - Missing test cases

## Related Code

- `src/commanders/librarian/utils/parse-basename.ts` - Correct parsing logic
- `src/commanders/librarian/orchestration/codex-builder.ts` - How codexes are built
- `src/commanders/librarian/click-handler.ts` - How codex links are parsed

