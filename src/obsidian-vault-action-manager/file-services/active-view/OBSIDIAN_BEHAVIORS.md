# Obsidian-Specific Behaviors to Account For

## Missing Behaviors in Current Implementation

### 1. View Mode (Source vs Preview) ⚠️ **CRITICAL**

**Issue**: `MarkdownView` can be in "source" or "preview" mode. In preview mode:
- `view.editor` may not be available or may throw errors
- `getValue()` and `setValue()` only work in source mode

**Current Code**: 
- `getContent()` and `replaceAllContentInOpenedFile()` access `view.editor` without checking mode
- Could fail silently or throw in preview mode

**Fix Needed**:
```typescript
const view = this.app.workspace.getActiveViewOfType(MarkdownView);
if (!view || view.getMode() !== "source") {
  return err(errorGetEditor("View not in source mode"));
}
```

**Files Affected**:
- `opened-file-reader.ts`: `getContent()`
- `opened-file-service.ts`: `replaceAllContentInOpenedFile()`

### 2. File Deleted/Renamed While Open

**Issue**: If file is deleted or renamed while open:
- `view.file` might become `null`
- `view.file.path` might be stale (Obsidian usually updates it, but race conditions exist)
- TFile reference might point to deleted file

**Current Code**: 
- Checks `view?.file` but doesn't verify file still exists in vault
- Doesn't handle case where file was renamed (path mismatch)

**Fix Needed**:
```typescript
const file = view.file;
if (!file) return err(errorNoActiveView());

// Verify file still exists in vault
const vaultFile = this.app.vault.getAbstractFileByPath(file.path);
if (!vaultFile || vaultFile !== file) {
  return err("File was deleted or renamed");
}
```

**Files Affected**:
- `opened-file-reader.ts`: `getOpenedTFile()`, `getContent()`
- `opened-file-service.ts`: `replaceAllContentInOpenedFile()`, `isFileActive()`

### 3. View State Transitions

**Issue**: View might be in transition state:
- File is opening (async operation)
- View is switching modes
- Leaf is being detached

**Current Code**: 
- No checks for view state
- Could access editor during transition

**Fix Needed**: Add state checks or retry logic with timeouts

### 4. Multiple Leaves/Views of Same File

**Issue**: Obsidian allows multiple views of same file:
- `getActiveViewOfType()` returns only the active one
- Other views might have unsaved changes
- Writing to active view doesn't update other views

**Current Code**: 
- Only handles active view
- No consideration for multiple views

**Note**: This might be acceptable - we only care about active view for "opened file" operations.

### 5. Editor State Validation

**Issue**: Editor might be in invalid state:
- Editor detached from DOM
- Editor not yet initialized
- CodeMirror instance not ready

**Current Code**: 
- Accesses `view.editor` directly
- No validation of editor state

**Fix Needed**: Add try-catch around editor operations, verify editor is attached

### 6. File Path Staleness After Rename

**Issue**: When file is renamed while open:
- TFile object's `path` property might be stale
- `view.file.path` might not match actual file path
- `isFileActive()` compares paths - could fail if path is stale

**Current Code**: 
- `isFileActive()` compares `pwd()` with input path
- If file was renamed, `pwd()` should return new path, but race condition exists

**Fix Needed**: Re-verify file path from vault before comparison

### 7. Cursor Position Not Preserved

**Issue**: `replaceAllContentInOpenedFile()` preserves scroll but not cursor:
- Cursor position is lost
- User loses their editing position

**Current Code**: 
- Only preserves scroll position
- Doesn't save/restore cursor

**Fix Needed**: Save cursor position before write, restore after (if line still exists)

### 8. Large File Performance

**Issue**: Very large files:
- `getValue()` might be slow
- `setValue()` might cause UI freeze
- Could hit memory limits

**Current Code**: 
- No size checks or performance considerations
- Could block UI on large files

**Note**: This might be acceptable - Obsidian handles this, but we should be aware.

### 9. File Encoding Issues

**Issue**: Special characters in content:
- UTF-8 encoding issues
- Line ending differences (CRLF vs LF)
- BOM characters

**Current Code**: 
- No encoding handling
- Assumes UTF-8 (Obsidian default)

**Note**: Obsidian handles encoding, but edge cases might exist.

### 10. Concurrent Operations

**Issue**: Multiple operations on same file:
- Race conditions between read/write
- File modified externally while open
- Vault events fire during operation

**Current Code**: 
- No locking or synchronization
- Could have race conditions

**Note**: This is handled at dispatch layer, but worth noting.

## Priority Fixes

### High Priority
1. **View Mode Check** - Critical for `getContent()` and `replaceAllContentInOpenedFile()`
2. **File Existence Verification** - Important for robustness

### Medium Priority
3. **Cursor Position Preservation** - UX improvement
4. **File Path Staleness** - Edge case but could cause bugs

### Low Priority
5. **View State Transitions** - Rare edge case
6. **Editor State Validation** - Defensive programming
7. **Large File Handling** - Performance consideration

## Implementation Notes

- Follow pattern from `above-selection-toolbar-service.ts` which checks `view.getMode() !== "source"`
- Add error helpers for new error cases
- Consider adding retry logic for transient failures
- Test with files in preview mode
- Test with file rename/delete during operations
