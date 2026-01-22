# Obsidian View Lifecycle Events

## TL;DR

When navigating to a file via `leaf.openFile()`:
1. **Don't trust event timing** - `file-open`, `active-leaf-change`, `layout-change` fire BEFORE view DOM is ready
2. **`active-leaf-change` fires with non-markdown leaves** during transitions - guard against detaching UI
3. **Use MutationObserver** to wait for `.cm-contentContainer` if you need DOM ready
4. **`onLayoutReady` may fire with no file open** - handle gracefully

---

## Event Sequence on Navigation

```
leaf.openFile(file)
  → file-open (sync, view NOT ready)
  → active-leaf-change (may be isMarkdown=false during transition!)
  → layout-change (view may be null)
  → ... DOM renders ...
  → view.contentEl populated with .cm-contentContainer
```

**Key insight:** Events fire for state changes, not DOM readiness.

---

## Gotchas

### 1. `active-leaf-change` with non-markdown leaf
During file transitions, `active-leaf-change` may fire with:
- `leaf.view instanceof MarkdownView === false`
- This is a transient state

**Fix:** Guard your handler:
```typescript
workspace.on("active-leaf-change", (leaf) => {
    if (!(leaf?.view instanceof MarkdownView)) return;
    // safe to proceed
});
```

### 2. `layout-change` with no view
Similarly, `layout-change` may fire when `getActiveViewOfType(MarkdownView)` returns null.

**Fix:** Check before acting:
```typescript
workspace.on("layout-change", () => {
    const view = workspace.getActiveViewOfType(MarkdownView);
    if (!view) return; // skip during transitions
    // safe to proceed
});
```

### 3. `onLayoutReady` before file open
On plugin init, `onLayoutReady` fires but there may be no file open yet (empty workspace).

**Fix:** Handle null view gracefully, rely on `active-leaf-change` for first file.

### 4. `file-open` fires before view ready
The `file-open` event fires synchronously during `openFile()` - view DOM is NOT rendered yet.

**Fix:** Don't try to read view content in `file-open` handler. Use it only for recording state.

---

## Reliable Pattern: MutationObserver

To wait for view DOM to be ready:

```typescript
function waitForViewReady(app: App, file: TFile, timeoutMs = 500): Promise<void> {
    return new Promise((resolve) => {
        const check = () => {
            const view = app.workspace.getActiveViewOfType(MarkdownView);
            return view?.file?.path === file.path &&
                   view.contentEl.querySelector(".cm-contentContainer");
        };

        if (check()) { resolve(); return; }

        const observer = new MutationObserver(() => {
            if (check()) {
                observer.disconnect();
                resolve();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { observer.disconnect(); resolve(); }, timeoutMs);
    });
}
```

---

## Custom Events for Coordination

When you control the navigation (e.g., via your own `cd()` function), emit a custom event AFTER view is ready:

```typescript
// In your navigation code
await leaf.openFile(file);
await waitForViewReady(app, file);
app.workspace.trigger("myplugin:file-ready", file);

// In your UI code
app.workspace.on("myplugin:file-ready", (file) => {
    // View is guaranteed ready here
});
```

---

## Sources
- Forum: [setActiveLeaf workarounds](https://forum.obsidian.md/t/setactiveleaf-is-creating-a-massive-pile-up-of-workarounds-in-plugins/11182)
- Forum: [layout-ready vs layout-change](https://forum.obsidian.md/t/obsidian-api-layout-ready-and-layout-change-events/11502)
