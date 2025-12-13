# TFileHelper & TFolderHelper E2E Test Scenarios

Critical low-level file system operations. These are "shit-hits-the-fan" endpoints that must handle all edge cases robustly.

## TFileHelper Test Scenarios

### getFile()

#### Happy Path
- ✅ Get existing markdown file by path
- ✅ Get existing non-md file by path
- ✅ Get file in nested folder

#### Error Cases
- ❌ File doesn't exist → returns error
- ❌ Path points to folder (type mismatch) → returns error
- ❌ Path is empty/invalid → returns error
- ❌ Path with special characters → handles correctly

### createMdFile()

#### Happy Path
- ✅ Create new markdown file with content
- ✅ Create new markdown file with empty content
- ✅ Create file in nested folder (parent exists)

#### Idempotency
- ✅ Create file that already exists → returns existing file (no error)
- ✅ Create file with same path multiple times → idempotent

#### Race Conditions
- ✅ File created between check and create → handles gracefully
- ✅ Multiple concurrent creates → one succeeds, others get existing

#### Error Cases
- ❌ Parent folder doesn't exist → returns error
- ❌ Invalid path characters → returns error
- ❌ File creation fails for other reason → returns error with message

### trashFile()

#### Happy Path
- ✅ Trash existing file → file removed
- ✅ Trash file in nested folder → file removed

#### Idempotency
- ✅ Trash file that doesn't exist → returns ok (no error, idempotent)
- ✅ Trash already-trashed file → returns ok

#### Error Cases
- ❌ Path points to folder → type mismatch error
- ❌ Trash operation fails → returns error

### renameFile()

#### Happy Path
- ✅ Rename file to new name (target doesn't exist)
- ✅ Move file to different folder (target doesn't exist)
- ✅ Rename file to same name (no-op, returns existing)

#### Collision Strategy: "rename" (default)
- ✅ Target exists with different content → renames to `1_filename.md`
- ✅ Target exists, `1_filename.md` also exists → renames to `2_filename.md`
- ✅ Multiple indexed names exist → finds first available (`3_filename.md`, etc.)
- ✅ Renamed file is retrievable after rename

#### Collision Strategy: "skip"
- ✅ Target exists → returns target file, source unchanged
- ✅ Target exists with different content → returns target, source unchanged

#### Duplicate Detection (MdFile only)
- ✅ Target exists with same content → trashes source, returns target
- ✅ Target exists with same content, trash fails → returns error

#### Idempotency / Already Moved
- ✅ Source doesn't exist, target exists → returns target (assumes already moved)
- ✅ Source and target are same file object → no-op, returns file

#### Error Cases
- ❌ Both source and target don't exist → returns error
- ❌ Source doesn't exist, target doesn't exist → returns error
- ❌ Rename operation fails → returns error with details
- ❌ Rename succeeds but file not retrievable → returns error
- ❌ Invalid target path → returns error

#### Edge Cases
- ✅ Rename to path with special characters → handles correctly
- ✅ Rename across folders → moves correctly
- ✅ Rename file that's currently open → handles correctly

## TFolderHelper Test Scenarios

### getFolder()

#### Happy Path
- ✅ Get existing folder by path
- ✅ Get root folder (empty pathParts)
- ✅ Get folder in nested structure

#### Error Cases
- ❌ Folder doesn't exist → returns error
- ❌ Path points to file (type mismatch) → returns error
- ❌ Invalid path → returns error

### createFolder()

#### Happy Path
- ✅ Create new folder
- ✅ Create nested folder (parent exists)
- ✅ Create folder with special characters in name

#### Idempotency
- ✅ Create folder that already exists → returns existing folder
- ✅ Multiple creates of same folder → idempotent

#### Race Conditions
- ✅ Folder created between check and create → handles gracefully
- ✅ Multiple concurrent creates → one succeeds, others get existing

#### Error Cases
- ❌ Parent folder doesn't exist → returns error (INVARIANT violation)
- ❌ Folder creation fails → returns error with message
- ❌ Invalid folder name → returns error

### trashFolder()

#### Happy Path
- ✅ Trash empty folder → folder removed
- ✅ Trash folder with files → folder and contents removed
- ✅ Trash folder with nested folders → recursive removal

#### Idempotency
- ✅ Trash folder that doesn't exist → returns ok (idempotent)
- ✅ Trash already-trashed folder → returns ok

#### Error Cases
- ❌ Path points to file → type mismatch error
- ❌ Trash operation fails → returns error

### renameFolder()

#### Happy Path
- ✅ Rename folder to new name (target doesn't exist)
- ✅ Move folder to different location (target doesn't exist)
- ✅ Rename folder to same name (no-op, returns existing)

#### Collision Strategy: "rename" (default)
- ✅ Target folder exists → renames to `1_foldername`
- ✅ Target exists, `1_foldername` also exists → renames to `2_foldername`
- ✅ Multiple indexed names exist → finds first available
- ✅ Renamed folder is retrievable after rename
- ✅ Files inside renamed folder are preserved

#### Collision Strategy: "skip"
- ✅ Target folder exists → returns target folder, source unchanged

#### Idempotency / Already Moved
- ✅ Source doesn't exist, target exists → returns target (assumes already moved)
- ✅ Source and target are same folder object → no-op, returns folder

#### Error Cases
- ❌ Both source and target don't exist → returns error
- ❌ Rename operation fails → returns error with details
- ❌ Rename succeeds but folder not retrievable → returns error
- ❌ Invalid target path → returns error

#### Edge Cases
- ✅ Rename folder with files inside → files move with folder
- ✅ Rename folder with nested folders → nested structure preserved
- ✅ Rename to path with special characters → handles correctly
- ✅ Rename across folder boundaries → moves correctly

## Cross-Cutting Scenarios

### Path Handling
- ✅ Root folder operations (`pathParts: []`)
- ✅ Deeply nested paths (3+ levels)
- ✅ Paths with spaces
- ✅ Paths with special characters (if allowed by Obsidian)
- ✅ Case sensitivity (if relevant on platform)

### Concurrent Operations
- ✅ Multiple operations on same file/folder concurrently
- ✅ Create while another process creates
- ✅ Rename while another process renames
- ✅ Trash while another process accesses

### Error Message Quality
- ✅ Error messages are descriptive
- ✅ Error messages include path information
- ✅ Error messages distinguish error types

### Result Type Handling
- ✅ All operations return `Result<T, string>`
- ✅ `isOk()` / `isErr()` work correctly
- ✅ Error values are strings (not exceptions)
- ✅ Success values are correct types (TFile/TFolder)

### Integration with Obsidian
- ✅ Operations visible in Obsidian UI
- ✅ Operations trigger Obsidian events correctly
- ✅ Operations work with Obsidian's file system abstraction
- ✅ Operations handle Obsidian's async nature correctly

## Priority Levels

### P0 (Critical - Must Have)
- All happy paths
- All error cases for non-existent files/folders
- Idempotency checks
- Basic collision handling

### P1 (Important - Should Have)
- Collision strategy variations
- Duplicate detection (files)
- Edge cases with special characters

