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
| `cm.dispatch()` + surgical edit | Works but requires CM6 access + MutationObserver waiting |

## Working Solution: Native `editor.transaction()` ✅

Use Obsidian's native `Editor.transaction()` with line-based `EditorChange[]`. No direct CM6 access needed.

```typescript
const oldLines = before.split("\n");
const newLines = after.split("\n");
const changes: EditorChange[] = [];

// Collect changes for differing lines
for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
  const oldLine = oldLines[i] ?? "";
  const newLine = newLines[i];

  if (newLine === undefined) {
    // Lines deleted — replace from here to end
    changes.push({
      from: { ch: 0, line: i },
      to: { ch: oldLines.at(-1)?.length ?? 0, line: oldLines.length - 1 },
      text: ""
    });
    break;
  }

  if (oldLine !== newLine) {
    changes.push({
      from: { ch: 0, line: i },
      to: { ch: oldLine.length, line: i },
      text: newLine
    });
  }
}

// Handle added lines at end
if (newLines.length > oldLines.length) {
  changes.push({
    from: { ch: oldLines.at(-1)?.length ?? 0, line: oldLines.length - 1 },
    text: "\n" + newLines.slice(oldLines.length).join("\n")
  });
}

editor.transaction({ changes });
```

### Benefits

- No direct CM6 access (`cm.dispatch`)
- No MutationObserver waiting
- Cursor/scroll handled automatically by Obsidian
- Simpler, less code

### Implementation

See `OpenedFileWriter.doApplyTransform()` in `writer/opened-file-writer.ts`.

## Historical: CM6 Surgical Edit (Deprecated)

Previous approach used `computeLineChanges()` for character-level diff + `cm.dispatch()` + `waitForEditorStable()` MutationObserver. Removed in favor of native API.

## Sources

- [Editor.transaction](https://docs.obsidian.md/Reference/TypeScript+API/Editor/transaction)
- [EditorChange](https://docs.obsidian.md/Reference/TypeScript+API/EditorChange)
