# Live Preview Content Edit - Approach Documentation

## Problem

Editing content in Live Preview mode breaks rendering — checkboxes/wikilinks show raw markdown instead of rendered widgets.

## Failed Approaches

| Approach | Issue |
|----------|-------|
| `editor.setValue()` | Flickers to "NoFile", scroll/cursor reset |
| `editor.replaceRange()` | Decorations don't refresh |
| `cm.dispatch()` (full doc) | No flicker, but decorations don't refresh |
| `cm.dispatch()` + `rebuildView()` | Same as above |
| `cm.dispatch()` + `requestMeasure()` | Still flickers |
| `vault.modify()` | Flickers, async transform incompatible |

## Working Solution: Surgical Line Edit ✅

Only edit the changed lines, not the whole document. Unchanged lines keep their decorations.

```typescript
// 1. Compute minimal diff
const changes = computeLineChanges(before, after);

// 2. Dispatch only the changed range
cm.dispatch({ changes });

// 3. Wait for DOM to stabilize
await waitForEditorStable(cm); // MutationObserver, 16ms debounce

// 4. Restore cursor/scroll
editor.setCursor(savedCursor);
editor.scrollTo(savedScroll);
```

### Implementation

`computeLineChanges()` finds first/last differing lines, computes char offsets, returns minimal `{ from, to, insert }`.

### Known Issues

- Off-by-one errors in line offset calculation (fixable)

## Sources

- [CM6 dispatch](https://codemirror.net/docs/ref/#state.EditorState.update)
- [rebuildView pattern](https://forum.obsidian.md/t/creating-command-to-reload-page/57906)
- [Vault.process docs](https://docs.obsidian.md/Reference/TypeScript+API/Vault/process)
