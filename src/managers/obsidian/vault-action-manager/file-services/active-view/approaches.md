# Codex Checkbox Click - Live Preview Re-rendering Bug

## Problem

Clicking checkbox in codex (Live Edit mode) → edited line shows **raw markdown** (`- [x] [[...]]`) instead of rendering. Either:
- No flicker but file goes to shit (current `setValue()` impl)
- CM6 `dispatch()` still flickers

## Research Findings (Community)

### Approaches That DON'T Work Well
1. **`editor.replaceRange()`** - CM6 decorations don't refresh
2. **`EditorView.dispatch({ changes })`** - Still flickers (tested)
3. **`editor.setValue()`** - Sometimes breaks entire rendering

### Promising Approaches from Community

**Option A: `app.vault.process()` - Bypass Editor Entirely**
- Atomic file edit API, editor reloads from disk
- Pattern: edit file → Obsidian's file watcher triggers proper re-render
- Pros: Clean separation, Obsidian handles re-rendering
- Cons: May lose cursor/scroll, slower (disk I/O)
- Source: [Vault API docs](https://docs.obsidian.md/Reference/TypeScript+API/Vault/process)

**Option B: `rebuildView()` After Edit**
```typescript
await editor.setValue(newContent);
await new Promise(r => requestAnimationFrame(r));
app.workspace.activeLeaf?.rebuildView?.();
```
- Pros: Documented community pattern
- Cons: Full view rebuild, may flicker
- Source: [Forum discussion](https://forum.obsidian.md/t/creating-command-to-reload-page/57906)

**Option C: `view.previewMode.rerender(true)` (Preview Mode Only)**
- Smoother than full rebuilds
- Only works in preview mode, not Live Preview/Edit
- Source: [Forum discussion](https://forum.obsidian.md/t/how-to-force-rerender-of-reading-view/91882)

**Option D: Surgical Edit via CM6 + requestMeasure**
```typescript
cm.dispatch({ changes: {...} });
cm.requestMeasure();
```
- `requestMeasure()` forces decoration recalculation
- Source: [CM6 docs](https://discuss.codemirror.net/t/is-view-requestmeasure-required-when-a-block-widget-changes-height/5604)

## Recommended: Try Option A First

Edit via `app.vault.process()` → let Obsidian handle the re-render naturally.

```typescript
// In processContent or similar:
await this.app.vault.process(tfile, (content) => {
    return transform(content);
});
// Obsidian's file watcher picks up change, re-renders properly
```

**Fallback**: If cursor/scroll loss is unacceptable → try Option D (dispatch + requestMeasure)

## Tested Results

### Option A: vault.read() + vault.modify() (vault.process requires sync)
- **Result**: STILL FLICKERS. Raw markdown visible momentarily.
- vault.process() can't be used because Transform callback is async

### Option D: CM6 dispatch + requestMeasure
- **Result**: STILL FLICKERS. Same raw markdown issue.

### Option B: setValue + rebuildView ✅
- **Result**: WORKS for small files. No flicker!
- **Issue**: Cursor/scroll resets to start in long files
- Tried: getCursor/setCursor + getScrollInfo/scrollTo — doesn't help for long files
- **Status**: Good enough for now. Cursor issue deferred.

## Implementation Plan

### Phase 1: Test `app.vault.process()`
```typescript
async processContentViaVault(
    splitPath: SplitPathToMdFile,
    transform: Transform,
): Promise<Result<string, string>> {
    const tfileResult = await this.getOpenedTFile();
    if (tfileResult.isErr()) return err(tfileResult.error);

    let result = "";
    await this.app.vault.process(tfileResult.value, (content) => {
        result = transform(content);
        return result;
    });
    return ok(result);
}
```

### Phase 2: If Phase 1 Has Issues, Try dispatch + requestMeasure
```typescript
const cm = (editor as unknown as { cm?: EditorView }).cm;
if (cm) {
    cm.dispatch({ changes: { from, to, insert } });
    cm.requestMeasure();  // Force decoration refresh
}
```

## Verification

1. `bun test` passes
2. Manual: Click codex checkbox → line renders properly
3. Cursor position reasonable after edit
4. No visible flicker

## Sources

- [Vault.process docs](https://docs.obsidian.md/Reference/TypeScript+API/Vault/process)
- [CM6 requestMeasure](https://discuss.codemirror.net/t/is-view-requestmeasure-required-when-a-block-widget-changes-height/5604)
- [rebuildView pattern](https://forum.obsidian.md/t/creating-command-to-reload-page/57906)
- [Forum: editing MD from plugin](https://forum.obsidian.md/t/how-to-edit-md-source-from-a-plugin/72494)
