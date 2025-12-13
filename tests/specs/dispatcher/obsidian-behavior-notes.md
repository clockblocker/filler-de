# Obsidian Behavior Notes

**GOLDEN SOURCE PRINCIPLE:** Obsidian's actual behavior is always the authoritative source. If code/docs/tests conflict with Obsidian's behavior, fix code/docs/tests to match Obsidian.

## Documented Behaviors

### File Creation

- **Creating existing file:** Obsidian's `vault.create()` behavior when file already exists may vary. Our implementation handles this via `TFileHelper.createMdFile()` which returns an error if file exists.
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
