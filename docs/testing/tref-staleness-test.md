# TRef Staleness Test Guide

## Overview
Test whether TFile references (`tRef`) in the tree become stale after rename/move operations.

## Logging Added

Logging has been added to track `tRef.path` at key points:

1. **Tree Creation** (`tree-reader.ts`): Logs all tRef paths when tree is first built
2. **Rename Operations** (`library-tree.ts:changeNodeName`): Logs tRef before/after rename
3. **Move Operations** (`library-tree.ts:moveNode`): Logs tRef before/after move
4. **Healing Analysis** (`init-healer.ts`): Logs tRef when analyzing leaves
5. **Status Writes** (`librarian.ts`): Logs tRef before/after writing metadata

All logs are prefixed with `[TreeStalenessTest]` for easy filtering.

## Testing Steps

### 1. Open Obsidian Dev Console
- Press `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux)
- Go to Console tab

### 2. Filter Logs
In console, filter by: `TreeStalenessTest`

### 3. Test Scenario: Rename File

1. **Initial State**: Note the tRef paths when tree is created
   - Look for: `[TreeStalenessTest] readTreeFromVault`
   - Record the `tRefPath` for a test file

2. **Rename a file** in the Library folder (same parent)
   - Example: `Library/Test.md` → `Library/TestRenamed.md`
   - Watch console for:
     - `[TreeStalenessTest] handleRename` - shows if actions were generated
     - `[TreeStalenessTest] applyActionsToTree` - shows if tree actions are applied
     - `[TreeStalenessTest] translateRename` - shows the translation
     - `[TreeStalenessTest] changeNodeName BEFORE` - **may not appear if no healing needed**
     - `[TreeStalenessTest] changeNodeName AFTER` - **may not appear if no healing needed**

3. **Important Note**: 
   - If file doesn't need healing (suffix already matches path), tree is **re-read** instead of applying tree actions
   - Look for: `[TreeStalenessTest] handleRename: No healing actions, but need to update tree`
   - In this case, `changeNodeName` logs won't appear - tree is rebuilt from scratch

4. **Check Results**:
   - If `changeNodeName` logs appear: Compare `tRefPath` in BEFORE vs AFTER
   - If tree was re-read: Check `readTreeFromVault` logs after rename
   - Compare `tRefPath` with `expectedPath`
   - **If stale**: `tRefPath` will still show old path
   - **If updated**: `tRefPath` will match `expectedPath`

### 4. Test Scenario: Move File

1. **Move a file** to different folder
   - Example: `Library/A/File.md` → `Library/B/File.md`
   - Watch console for:
     - `[TreeStalenessTest] moveNode BEFORE`
     - `[TreeStalenessTest] moveNode AFTER`

2. **Check Results**: Same as rename test

### 5. Run Full Staleness Check

In console, run:
```javascript
// Get your plugin instance (replace 'your-plugin-id' with actual ID)
const plugin = app.plugins.plugins['your-plugin-id'];
const librarian = plugin.getLibrarian();
await librarian.testTRefStaleness();
```

This will:
- Check all leaves in tree
- Compare `tRef.path` with expected path
- Report mismatches
- Show if files exist at expected paths

## What to Look For

### Stale tRef (BAD):
```javascript
{
  tRefPath: "Library/OldName.md",        // Old path
  expectedPath: "Library/NewName.md",     // New path
  matches: false,                          // Mismatch!
  fileExists: true                         // File exists at new path
}
```

### Valid tRef (GOOD):
```javascript
{
  tRefPath: "Library/NewName.md",         // Matches expected
  expectedPath: "Library/NewName.md",     // Same path
  matches: true,                           // Match!
  fileExists: true
}
```

## Expected Behavior

**If tRefs are stale:**
- `tRefPath` will show old path after rename/move
- `matches` will be `false`
- File operations may fail or target wrong file

**If Obsidian updates tRefs automatically:**
- `tRefPath` will match new path after rename/move
- `matches` will be `true`
- File operations should work correctly

## Next Steps

Based on results:
- **If stale**: Remove tRef from tree, resolve on-demand
- **If updated**: Keep tRef but verify it's always current
- **If mixed**: Need to investigate Obsidian's behavior more

