# TFileHelper & TFolderHelper E2E Test Implementation Plan

Sorted by implementation difficulty, from easiest to hardest.

## Difficulty Levels

- **Level 1 (Easy)**: Straightforward operations, minimal setup
- **Level 2 (Medium)**: Requires setup/teardown, multiple steps, or error handling
- **Level 3 (Hard)**: Complex logic, race conditions, or advanced scenarios
- **Level 4 (Very Hard)**: Requires timing, concurrency, or subjective validation

---

## Level 1: Easy Tests

### TFileHelper.getFile() - Happy Path
- [x] **Files**: `get-file-happy.test.ts`
- [x] Get existing markdown file by path
- [x] Get existing non-md file by path
- [x] Get file in nested folder

**Effort**: Low - Direct API calls, simple assertions

### TFileHelper.getFile() - Basic Errors
- [x] **Files**: `get-file-errors.test.ts`
- [x] File doesn't exist → returns error
- [x] Path points to folder (type mismatch) → returns error
- [x] Path is empty/invalid → returns error

**Effort**: Low - Test error conditions, verify Result.isErr()

### TFolderHelper.getFolder() - Happy Path
- [x] **Files**: `get-folder.test.ts` (all scenarios in one file)
- [x] Get existing folder by path
- [x] Get root folder (empty pathParts)
- [x] Get folder in nested structure

**Effort**: Low - Similar to getFile tests

### TFolderHelper.getFolder() - Basic Errors
- [x] **Files**: `get-folder.test.ts` (all scenarios in one file)
- [x] Folder doesn't exist → returns error
- [x] Path points to file (type mismatch) → returns error
- [x] Invalid path → returns error

**Effort**: Low - Error condition testing

### TFileHelper.createMdFile() - Basic Happy Path
- [x] **Files**: `create-file.test.ts`, `create-file-happy.test.ts`
- [x] Create new markdown file with content
- [x] Create new markdown file with empty content
- [x] Create file in nested folder

**Effort**: Low - Already implemented, expand slightly

### TFolderHelper.createFolder() - Basic Happy Path
- [x] **Files**: `create-folder.test.ts`
- [x] Create new folder

**Effort**: Low - Already implemented

### TFileHelper.createMdFile() - Simple Idempotency
- [x] **Files**: `create-file-idempotent.test.ts`
- [x] Create file that already exists → returns existing file (no error)
- [x] Create file with same path multiple times → idempotent

**Effort**: Low - Create twice, verify same file returned

### TFolderHelper.createFolder() - Simple Idempotency
- [x] **Files**: `create-folder-advanced.test.ts` (all scenarios in one file)
- [x] Create folder that already exists → returns existing folder
- [x] Multiple creates of same folder → idempotent

**Effort**: Low - Similar to file idempotency

---

## Level 2: Medium Tests

### TFileHelper.createMdFile() - Nested Folders
- [x] **Files**: `create-file-happy.test.ts` (nested covered), `create-file-errors.test.ts` (parent error)
- [x] Create file in nested folder (parent exists)
- [x] Parent folder doesn't exist → returns error

**Effort**: Medium - Requires folder setup, path handling

### TFolderHelper.createFolder() - Nested Folders
- [x] **Files**: `create-folder-advanced.test.ts` (all scenarios in one file)
- [x] Create nested folder (parent exists)
- [x] Parent folder doesn't exist → Obsidian auto-creates parent folders

**Effort**: Medium - Multi-level path setup

### TFileHelper.createMdFile() - Special Characters
- [x] **Files**: `create-file-happy.test.ts` (all scenarios in one file)
- [x] Path with special characters → handles correctly (Obsidian's behavior is golden source)
- [x] Invalid path characters → Obsidian may allow or reject (test verifies actual behavior)

**Effort**: Medium - Test various special chars, platform-specific

### TFolderHelper.createFolder() - Special Characters
- [x] **Files**: `create-folder-advanced.test.ts` (all scenarios in one file)
- [x] Create folder with special characters in name

**Effort**: Medium - Character validation

### TFileHelper.trashFile() - Happy Path
- [x] **Files**: `trash-file.test.ts` (all scenarios in one file)
- [x] Trash existing file → file removed
- [x] Trash file in nested folder → file removed

**Effort**: Medium - Requires create + trash + verify removal

### TFileHelper.trashFile() - Idempotency
- [x] **Files**: `trash-file.test.ts` (all scenarios in one file)
- [x] Trash file that doesn't exist → returns ok (no error, idempotent)
- [x] Trash already-trashed file → returns ok

**Effort**: Medium - Test non-existent and already-trashed states

### TFileHelper.trashFile() - Errors
- [x] **Files**: `trash-file.test.ts` (all scenarios in one file)
- [x] Path points to folder → type mismatch error (getFile errors, trashFile returns ok - idempotent)

**Effort**: Medium - Error condition testing

### TFolderHelper.trashFolder() - Happy Path (Empty)
- [x] **Files**: `trash-folder.test.ts` (all scenarios in one file)
- [x] Trash empty folder → folder removed

**Effort**: Medium - Create + trash + verify

### TFolderHelper.trashFolder() - Idempotency
- [x] **Files**: `trash-folder.test.ts` (all scenarios in one file)
- [x] Trash folder that doesn't exist → returns ok (idempotent)
- [x] Trash already-trashed folder → returns ok

**Effort**: Medium - Similar to file trash idempotency

### TFolderHelper.trashFolder() - Errors
- [x] **Files**: `trash-folder.test.ts` (all scenarios in one file)
- [x] Path points to file → type mismatch error (getFolder errors, trashFolder returns ok - idempotent)

**Effort**: Medium - Error testing

### TFileHelper.renameFile() - Basic Happy Path
- [x] **Files**: `rename-file.test.ts` (all scenarios in one file)
- [x] Rename file to new name (target doesn't exist)
- [x] Rename file to same name (no-op, returns existing)

**Effort**: Medium - Create + rename + verify

### TFileHelper.renameFile() - Move Across Folders
- [x] **Files**: `rename-file.test.ts` (all scenarios in one file)
- [x] Move file to different folder (target doesn't exist)
- [x] Rename to path with special characters → handles correctly (Obsidian's behavior is golden source)
- [x] Rename across folders → moves correctly

**Effort**: Medium - Multi-folder setup, path manipulation

### TFolderHelper.renameFolder() - Basic Happy Path
- [x] **Files**: `rename-folder.test.ts` (all scenarios in one file)
- [x] Rename folder to new name (target doesn't exist)
- [x] Rename folder to same name (no-op, returns existing)

**Effort**: Medium - Create + rename + verify

### TFolderHelper.renameFolder() - Move
- [x] **Files**: `rename-folder.test.ts` (all scenarios in one file)
- [x] Move folder to different location (target doesn't exist)
- [x] Rename to path with special characters → handles correctly (Obsidian's behavior is golden source)
- [x] Rename across folder boundaries → moves correctly

**Effort**: Medium - Multi-level folder operations

### TFileHelper.renameFile() - Collision Strategy "skip"
- [x] **Files**: `rename-file.test.ts` (all scenarios in one file)
- [x] Target exists → returns target file, source unchanged
- [x] Target exists with different content → returns target, source unchanged

**Effort**: Medium - Create target, attempt rename, verify skip behavior

### TFolderHelper.renameFolder() - Collision Strategy "skip"
- [x] **Files**: `rename-folder.test.ts` (all scenarios in one file)
- [x] Target folder exists → returns target folder, source unchanged

**Effort**: Medium - Similar to file skip

### TFileHelper.renameFile() - Idempotency / Already Moved
- [x] **Files**: `rename-file.test.ts` (all scenarios in one file)
- [x] Source doesn't exist, target exists → returns target (assumes already moved)
- [x] Source and target are same file object → no-op, returns file

**Effort**: Medium - Edge case handling, state verification

### TFolderHelper.renameFolder() - Idempotency / Already Moved
- [x] **Files**: `rename-folder.test.ts` (all scenarios in one file)
- [x] Source doesn't exist, target exists → returns target (assumes already moved)
- [x] Source and target are same folder object → no-op, returns folder

**Effort**: Medium - Similar to file idempotency

### TFileHelper.renameFile() - Basic Errors
- [x] **Files**: `rename-file.test.ts` (all scenarios in one file)
- [x] Both source and target don't exist → returns error

**Effort**: Medium - Error condition testing

### TFolderHelper.renameFolder() - Basic Errors
- [x] **Files**: `rename-folder.test.ts` (all scenarios in one file)
- [x] Both source and target don't exist → returns error


**Effort**: Medium - Type verification across all operations

---

## Level 3: Hard Tests

### TFileHelper.renameFile() - Collision Strategy "rename" (Indexing)
- [ ] **Files**: `rename-file-collision-rename.test.ts`
- [ ] Target exists with different content → renames to `1_filename.md`
- [ ] Target exists, `1_filename.md` also exists → renames to `2_filename.md`
- [ ] Multiple indexed names exist → finds first available (`3_filename.md`, etc.)
- [ ] Renamed file is retrievable after rename

**Effort**: Hard - Complex collision resolution logic, multiple file creation

### TFolderHelper.renameFolder() - Collision Strategy "rename" (Indexing)
- [ ] **Files**: `rename-folder-collision-rename.test.ts`
- [ ] Target folder exists → renames to `1_foldername`
- [ ] Target exists, `1_foldername` also exists → renames to `2_foldername`
- [ ] Multiple indexed names exist → finds first available
- [ ] Renamed folder is retrievable after rename
- [ ] Files inside renamed folder are preserved

**Effort**: Hard - Similar to file collision, plus content preservation

### TFileHelper.renameFile() - Duplicate Detection
- [ ] **Files**: `rename-file-duplicate.test.ts`
- [ ] Target exists with same content → trashes source, returns target
- [ ] Target exists with same content, trash fails → returns error

**Effort**: Hard - Content comparison, conditional trash logic

### TFileHelper.renameFile() - Advanced Errors
- [ ] **Files**: `rename-file-errors-advanced.test.ts`
- [ ] Rename operation fails → returns error with details
- [ ] Rename succeeds but file not retrievable → returns error

**Effort**: Hard - Failure simulation, state verification

### TFolderHelper.renameFolder() - Advanced Errors
- [ ] **Files**: `rename-folder-errors-advanced.test.ts`
- [ ] Rename operation fails → returns error with details
- [ ] Rename succeeds but folder not retrievable → returns error

**Effort**: Hard - Failure scenarios

### TFolderHelper.trashFolder() - With Contents
- [x] **Files**: `trash-folder.test.ts` (all scenarios in one file)
- [x] Trash folder with files → folder and contents removed
- [x] Trash folder with nested folders → recursive removal

**Effort**: Hard - Recursive operations, content verification

### TFolderHelper.renameFolder() - With Contents
- [ ] **Files**: `rename-folder-with-contents.test.ts`
- [ ] Rename folder with files inside → files move with folder
- [ ] Rename folder with nested folders → nested structure preserved

**Effort**: Hard - Recursive operations, structure preservation

### Path Handling - Advanced
- [ ] **Files**: `path-handling-advanced.test.ts`
- [ ] Deeply nested paths (3+ levels)
- [ ] Paths with special characters (if allowed by Obsidian)

**Effort**: Hard - Complex path structures, edge cases

### TFileHelper.createMdFile() - Race Conditions
- [x] **Files**: `create-file-race.test.ts`
- [x] File created between check and create → handles gracefully
- [x] Multiple concurrent creates → one succeeds, others get existing

**Effort**: Hard - Timing-sensitive, requires careful test design

### TFolderHelper.createFolder() - Race Conditions
- [x] **Files**: `create-folder-advanced.test.ts` (all scenarios in one file)
- [x] Folder created between check and create → handles gracefully
- [x] Multiple concurrent creates → one succeeds, others get existing


---

## Level 4: Very Hard Tests

### Concurrent Operations - Files
- [ ] **Files**: `concurrent-file-ops.test.ts`
- [ ] Multiple operations on same file/folder concurrently
- [ ] Create while another process creates
- [ ] Rename while another process renames
- [ ] Trash while another process accesses

**Effort**: Very Hard - True concurrency testing, race condition simulation

### Concurrent Operations - Folders
- [ ] **Files**: `concurrent-folder-ops.test.ts`
- [ ] Multiple operations on same folder concurrently

**Effort**: Very Hard - Subjective validation, requires manual review or regex patterns

### Stress Tests
- [ ] **Files**: `stress-tests.test.ts`
- [ ] Deep nesting scenarios (10+ levels)
- [ ] Concurrent operation stress tests (many operations)

**Effort**: Very Hard - Performance testing, resource management

---

## Implementation Order Recommendation

### Phase 1: Foundation (Level 1)
1. Complete all Level 1 tests
2. Establishes basic patterns and helpers
3. Validates core functionality

### Phase 2: Expansion (Level 2)
1. Implement Level 2 tests
2. Covers most common use cases
3. Validates error handling and edge cases

### Phase 3: Advanced (Level 3)
1. Implement Level 3 tests
2. Validates complex scenarios
3. Tests collision handling and race conditions

### Phase 4: Polish (Level 4)
1. Implement Level 4 tests if needed
2. Stress testing and quality validation
3. May be deferred based on priorities

---

## File Naming Convention

- `{operation}-{scenario}.test.ts` (e.g., `create-file-nested.test.ts`)
- Group related tests in same file when logical
- Keep files focused (one main scenario per file)

## Helper Functions to Extract

As tests are implemented, consider extracting common patterns:

- `setupTestFile(path, content?)` - Create test file
- `setupTestFolder(path)` - Create test folder
- `verifyFileExists(path)` - Assert file exists
- `verifyFolderExists(path)` - Assert folder exists
- `verifyFileRemoved(path)` - Assert file doesn't exist
- `verifyFileContent(path, expectedContent)` - Assert file content
- `getFileCount(folderPath)` - Count files in folder
- `waitForOperation()` - Wait for async operations (if needed)


