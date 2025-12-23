# Obsidian Behavior Notes

**GOLDEN SOURCE PRINCIPLE:** Obsidian's actual behavior is always the authoritative source. If code/docs/tests conflict with Obsidian's behavior, fix code/docs/tests to match Obsidian.

## Documented Behaviors

### File Creation

- **Creating existing file:** Obsidian's `vault.create()` behavior when file already exists may vary. Our implementation handles this via `TFileHelper.upsertMdFile()` which returns an error if file exists.
- **Empty path:** Creating a file with empty path (`""`) will fail, but the exact error message may vary.

### File Trashing

- **Trashed file existence:** After trashing a file, `exists()` returns `false` as expected.
- **Trash vs other operations:** Trash operation correctly invalidates all prior operations on the same file.

### Process Operations

- **Transform composition:** Multiple `ProcessMdFile` operations on the same file are correctly composed in order.
- **Process on non-existent file:** Process operations require the file to exist first. Our implementation creates empty file if needed.

### Write Operations

- **Write precedence:** Latest `ReplaceContentMdFile` correctly wins over prior writes.
- **Write + Process:** When write comes before process, the process is correctly applied to the write content.
- **Process + Write:** When write comes after process, the process is correctly discarded.

### Folder Rename Events

- **Folder rename fires first:** When a user renames/moves a folder, Obsidian fires ONE `rename` event for the folder itself.
- **Files inside fire separate events:** After the folder rename event, Obsidian fires SEPARATE `rename` events for EACH file inside the folder.
- **File paths are already updated:** The file rename events have paths that already reflect the new folder location (Obsidian updates paths before emitting events).
- **Implication for dependencies:** File rename actions do NOT need to depend on folder rename actions - the paths are already correct. They only need to depend on destination parent `CreateFolder` actions.

**Example:**
```
User renames: Library/foo → Library/bar/foo
Obsidian fires:
1. FolderRenamed: Library/foo → Library/bar/foo
2. FileRenamed: Library/foo/file1.md → Library/bar/foo/file1.md
3. FileRenamed: Library/foo/file2.md → Library/bar/foo/file2.md
```

### Sorting

- **Weight ordering:** Actions are correctly sorted by weight (CreateFolder < CreateFile < ProcessMdFile).
- **Path depth:** Within same weight, actions are sorted by path depth (shallow first).

### Error Handling

- **Dispatch errors:** The `dispatch()` method throws an error if any action fails. Errors are collected and all actions are attempted before throwing.
- **Execution continues:** Even if one action fails, other actions in the batch are still executed.

## Unexpected Behaviors

_None documented yet. All observed behaviors match expected behavior._

## Test Notes

- E2E tests verify actual file system state, not internal execution order
- Cannot directly verify execution order in e2e (would require mocking)
- Error handling tests verify that errors are thrown and execution continues
