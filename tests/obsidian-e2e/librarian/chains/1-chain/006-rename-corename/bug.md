# Bug: Codex doesn't update when healed file is renamed

## Summary
When a file is created without a suffix, healed (suffix added), then renamed by user, the parent codex retains the original name in both link target and display text.

## Reproduction Steps
1. Create file `Library/L1/L2/Untitled.md` (no suffix)
2. Wait for healing → file becomes `Untitled-L2-L1.md`
3. Codex `__-L2-L1.md` now contains `[[Untitled-L2-L1|Untitled]]`
4. User renames to `Note-L2-L1.md`
5. **Bug**: Codex still shows `[[Untitled-L2-L1|Untitled]]`

## Expected
After rename, codex should show:
```
- [ ] [[Note-L2-L1|Note]]
```

## Actual
Codex still shows stale reference:
```
- [ ] [[Untitled-L2-L1|Untitled]]
```

Both the link target AND display name are stale.

## Key Observation
Bug only triggers when:
- File created WITHOUT suffix first
- Healing adds suffix
- User then renames coreName

If file is created WITH correct suffix initially, renames work correctly.

## Test Output
```
File: Library/Recipe/Soup/Ramen/__-Ramen-Soup-Recipe.md
Actual content:
[[__-Soup-Recipe|← Soup]]
- [ ] [[Ingredients-Ramen-Soup-Recipe|Ingredients]]
- [ ] [[Steps-Ramen-Soup-Recipe|Steps]]
- [[Result_picture-Ramen-Soup-Recipe|Result_picture]]
- [ ] [[Untitled-Ramen-Soup-Recipe|Untitled]]   <-- STALE

Expected: [[Final-Ramen-Soup-Recipe|Final]]
```
