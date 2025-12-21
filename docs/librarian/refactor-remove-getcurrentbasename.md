# Refactor: Remove getCurrentBasename from Librarian

## Goal

Remove `getCurrentBasename` from Librarian. Librarian should only know about:
- VaultActions
- TreeActions  
- SplitPath

All file resolution should be handled by ObsidianVaultActionManager.

## Current State

### Problem
- `librarian.ts:66-141` contains `getCurrentBasename` with complex fallback logic
- Uses unsafe type casting to access Obsidian API
- Violates separation of concerns - Librarian shouldn't know about file resolution

### Current Flow
1. `readTreeFromVault` uses `listAll()` which returns `SplitPathWithTRef[]`
2. `healOnInit` needs `getCurrentBasename` to find actual basename at expected path
3. `getCurrentBasename` does:
   - Try expected path first
   - If not found, search parent directory for matching coreName

## Target State

### New Types
- `SplitPathWithReader` - SplitPath with `read()` function for md files (no tRef)
- Replace `SplitPathToFileWithMdReader` with `SplitPathWithReader`

### New Manager Method
- `listAllFilesWithMdReaders(folder: SplitPathToFolder): Promise<SplitPathWithReader[]>`
  - Returns all files (recursive) with readers attached
  - No tRefs (avoids stale references)
  - MdFiles have `read()` function, Files don't

### Simplified Flow
1. `readTreeFromVault` uses `listAllFilesWithMdReaders()` - single call
2. `healOnInit` receives list of actual files from manager
3. Compare actual files with expected tree structure
4. No need for `getCurrentBasename` - manager provides all files

## Implementation Plan

### Step 1: Add SplitPathWithReader Type

**File:** `src/obsidian-vault-action-manager/types/split-path.ts`

**Changes:**
- Remove `SplitPathToFileWithMdReader`
- Add `SplitPathWithReader` type: union of `SplitPathToMdFile & { read: () => Promise<string> }` or `SplitPathToFile`

### Step 2: Add listAllFilesWithMdReaders to Manager

**File:** `src/obsidian-vault-action-manager/index.ts`

Add to interface:
- `listAllFilesWithMdReaders(splitPath: SplitPathToFolder): Promise<SplitPathWithReader[]>`

**File:** `src/obsidian-vault-action-manager/impl/reader.ts`

Implement method:
- Recursively list all files in folder
- For MdFiles: attach `read()` function (calls `this.readContent`)
- For Files: return as-is
- No tRefs attached

**File:** `src/obsidian-vault-action-manager/facade.ts`

Delegate to reader implementation

### Step 3: Update readTreeFromVault

**File:** `src/commanders/librarian/orchestration/tree-reader.ts`

**Changes:**
- Replace `listAll` with `listAllFilesWithMdReaders`
- Use `read()` from SplitPathWithReader directly (no separate readContent call)
- Update `TreeReaderContext` type to include `listAllFilesWithMdReaders`
- Keep `getAbstractFile` for LibraryTree constructor (or make root folder optional)

**Updated signature:**
- `readTreeFromVault(libraryRoot: string, suffixDelimiter: string, context: TreeReaderContext): Promise<LibraryTree>`

**Updated TreeReaderContext:**
- `splitPath(path: string): SplitPathToFolder | SplitPathToFile | SplitPathToMdFile`
- `getAbstractFile(splitPath: SplitPathToFolder): Promise<TFolder | null>`
- `listAllFilesWithMdReaders(splitPath: SplitPathToFolder): Promise<SplitPathWithReader[]>`

### Step 4: Update healOnInit

**File:** `src/commanders/librarian/healing/init-healer.ts`

**Changes:**
- Remove `getCurrentBasename` parameter
- Accept `actualFiles: SplitPathWithReader[]` from manager
- Match files to leaves by comparing paths/coreNames
- Build map of actual files by coreName + path
- Check each leaf against actual files
- Generate rename actions if suffix doesn't match

**New signature:**
- `healOnInit(leaves: TreeLeaf[], actualFiles: SplitPathWithReader[], libraryRoot: string, suffixDelimiter = "-"): Promise<InitHealResult>`

### Step 5: Update Librarian.init()

**File:** `src/commanders/librarian/librarian.ts`

**Changes:**
- Remove `getCurrentBasename` function (lines 66-141)
- Call `listAllFilesWithMdReaders` once at start
- Pass result to both `readTreeFromVault` and `healOnInit`

**Flow:**
1. Get all files with readers via `listAllFilesWithMdReaders`
2. Build tree from files
3. Heal using actual files list
4. Continue with rest of init

**Note:** Decide if `readTreeFromVault` should accept files as parameter or call manager internally.

### Step 6: Clean Up

- Remove `getCurrentBasename` from `librarian.ts`
- Remove `getCurrentBasename` parameter from `healOnInit`
- Remove `leafNeedsHealing` if it also uses `getCurrentBasename`
- Update tests

## Questions

1. **LibraryTree constructor needs TFolder** - Should we:
   - Keep `getAbstractFile` in context (minimal change)
   - Make root folder optional in LibraryTree?
   - Store root folder name instead of TFolder?

2. **readTreeFromVault signature** - Should it:
   - Accept files as parameter (caller calls manager)?
   - Call manager internally (current pattern)?

3. **File matching in healOnInit** - Current `getCurrentBasename` searches parent directory if file not at expected path. Should we:
   - Handle this in manager's `listAllFilesWithMdReaders`?
   - Keep simple matching (file must be at expected path)?

## Benefits

- ✅ Removes unsafe type casting
- ✅ Clear separation of concerns
- ✅ Single source of truth for file listing
- ✅ No stale tRefs
- ✅ Simpler code (no complex fallback logic)
- ✅ Easier to test (manager methods are testable)

## Migration Notes

- `readTreeFromVault` context changes - update all callers
- `healOnInit` signature changes - update all callers
- Tests need updating

