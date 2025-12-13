# Vault Action Manager Refactor

**Status:** In Progress  
**Started:** 2024  
**Goal:** Migrate from legacy file services to a unified, type-safe vault action manager

## Overview

This refactor aims to consolidate and modernize file/folder operations by:
1. Removing primitive file services (`OpenedFileReader`, `BackgroundFileReader`, legacy `queue`)
2. Migrating to a separated `vault-actions manager`
3. Transitioning from `PrettyPath` to `SplitPath` types
4. Replacing custom `Maybe<T>` with `neverthrow.Result<T, E>`
5. Standardizing error handling and API patterns

## Goals

### Primary Goals

1. **Unified Vault Actions**
   - Single entry point for all vault operations via `ObsidianVaultActionManager`
   - Clear separation: Reader / Dispatcher / Executor components
   - Queue-based execution with proper event tracking

2. **Type Safety**
   - Migrate from `PrettyPath` → `SplitPath` (typed: `SplitPathToMdFile`, `SplitPathToFile`, `SplitPathToFolder`)
   - Use Zod codecs for bidirectional path conversions
   - Eliminate `as`/`any` usage (except documented Obsidian API cases)

3. **Functional Error Handling**
   - Replace custom `Maybe<T>` with `neverthrow.Result<T, E>`
   - All helper methods return `Result` directly (no throwing wrappers)
   - Errors handled at dispatch layer, not in helpers

4. **API Consistency**
   - Single operations only (no batch methods in helpers)
   - Consistent method signatures across `TFileHelper` and `TFolderHelper`
   - All methods return `Result` types

## Progress

### ✅ Completed

#### Path System Migration
- [x] Refactored `pathfinder.ts` to use `SplitPath` types
- [x] Added `systemPathToSplitPath` Zod codec for bidirectional conversion
- [x] Updated `findFirstAvailableIndexedPath` to work with `SplitPath`
- [x] Added unit tests for `systemPathToSplitPath` codec

#### TFileHelper Refactor
- [x] Migrated from `Maybe<T>` to `neverthrow.Result<T, string>`
- [x] All methods return `Result` directly:
  - `getFile()` → `Result<TFile, string>`
  - `createMdFile()` → `Result<TFile, string>`
  - `trashFile()` → `Result<void, string>`
  - `renameFile()` → `Result<TFile, string>`
- [x] Removed batch operations (`createMdFiles`, `trashFiles`, `renameFiles`)
- [x] Removed throwing wrappers
- [x] Removed logging (handled at dispatch layer)
- [x] Added collision strategy support ("rename" | "skip")
- [x] Added content comparison for duplicate detection

#### TFolderHelper Refactor
- [x] Migrated from `Maybe<T>` to `neverthrow.Result<T, string>`
- [x] All methods return `Result` directly:
  - `getFolder()` → `Result<TFolder, string>`
  - `createFolder()` → `Result<TFolder, string>`
  - `trashFolder()` → `Result<void, string>`
  - `renameFolder()` → `Result<TFolder, string>`
- [x] Removed batch operations (`createFolders`, `trashFolders`, `renameFolders`)
- [x] Removed throwing wrappers
- [x] Removed logging (handled at dispatch layer)
- [x] Added collision strategy support
- [x] Added error handling for `fileManager` operations

#### Error Message Standardization
- [x] Extracted all error messages to `common.ts`
- [x] Created reusable error builders:
  - `errorGetByPath(entityType, path)`
  - `errorTypeMismatch(entityType, path)`
  - `errorCreationRaceCondition(entityType, path, error)`
  - `errorCreateFailed(entityType, path, errorMessage)`
  - `errorBothSourceAndTargetNotFound(entityType, fromPath, toPath, error)`
  - `errorRetrieveRenamed(entityType, path, error)`
  - `errorRenameFailed(entityType, fromPath, toPath, errorMessage)`
  - `errorTrashDuplicateFile(path, errorMessage)`
- [x] Both helpers use shared error builders

#### Common Utilities
- [x] `getExistingBasenamesInFolder()` supports both files and folders
- [x] `CollisionStrategy` type exported from `common.ts`
- [x] Shared helper functions centralized

#### Executor Implementation
- [x] Maps `VaultAction` types to `TFileHelper`/`TFolderHelper`/`OpenedFileService`
- [x] Routes ProcessMdFile/ReplaceContentMdFile based on `isFileActive()`
- [x] Ensures file exists before processing/writing
- [x] Returns `Result<void, string>` per action
- [x] Handles both opened (active view) and background operations

#### Dispatcher Implementation
- [x] Uses `collapseActions()` to minimize filesystem calls
- [x] Uses `sortActionsByWeight()` for proper execution order
- [x] Executes actions sequentially
- [x] Collects all errors with action context
- [x] Returns `DispatchResult = Result<void, DispatchError[]>`

#### Collapse Implementation
- [x] Comprehensive collapse rules (see [collapse-actions-spec.md](./collapse-actions-spec.md))
- [x] ProcessMdFile composition
- [x] ReplaceContentMdFile precedence
- [x] Trash terminality
- [x] CreateMdFile + ReplaceContentMdFile merging
- [x] 20 unit tests passing

### 🚧 In Progress

- [ ] Integration with `ObsidianVaultActionManager` facade (partial)
- [ ] Migration of `Librarian` to use new vault action manager
- [ ] Event adapter implementation
- [ ] Self-event tracking

### 📋 Pending

- [ ] Remove legacy `LegacyVaultActionQueue`
- [ ] Migration of `ActionDispatcher` to new system
- [ ] Remove legacy file service implementations
- [ ] Update all call sites to use new API
- [ ] Comprehensive integration testing

## Architecture Changes

### Before

```
Librarian
  ├── LegacyVaultActionQueue
  ├── OpenedFileReader (Maybe<T>)
  ├── BackgroundFileReader (Maybe<T>)
  └── ActionDispatcher
```

### After (Current Implementation)

```
Librarian
  └── ObsidianVaultActionManager (Facade)
      ├── Reader (Result<T, E>)
      │   ├── OpenedFileService
      │   └── TFileHelper/TFolderHelper (background)
      ├── Dispatcher
      │   ├── collapseActions()
      │   ├── sortActionsByWeight()
      │   └── Executor.execute() (sequential)
      └── Executor
          ├── TFileHelper (Result<T, E>)
          ├── TFolderHelper (Result<T, E>)
          └── OpenedFileService (for active files)
```

**Key Differences:**
- No `BackgroundFileService` wrapper - Executor uses `TFileHelper`/`TFolderHelper` directly
- Dispatcher returns `DispatchResult` with error tracking
- Executor ensures file existence before processing/writing
- Collapse minimizes filesystem calls by combining operations

## Key Design Decisions

### 1. Result Types Over Throwing

**Decision:** All helper methods return `Result<T, E>` directly, no throwing wrappers.

**Rationale:**
- Functional error handling
- Errors handled at dispatch layer
- Type-safe error propagation
- Better composability with neverthrow utilities

**Example:**
```typescript
// Before
async getFile(path: SplitPath): Promise<TFile> {
  const result = await this.getFileResult(path);
  return result.match(
    (file) => file,
    (error) => { throw new Error(error); }
  );
}

// After
async getFile(path: SplitPath): Promise<Result<TFile, string>> {
  // Direct Result return
}
```

### 2. Single Operations Only

**Decision:** Removed all batch operations from helpers.

**Rationale:**
- Helpers are low-level primitives
- Batching handled at dispatch/queue layer
- Simpler API surface
- Better error granularity

### 3. No Logging in Helpers

**Decision:** Removed all `logError`/`logWarning` calls from helpers.

**Rationale:**
- Helpers are pure operations
- Logging handled at dispatch layer
- Better separation of concerns
- Dispatch layer has full context

### 4. Shared Error Messages

**Decision:** All error messages extracted to `common.ts` with builders.

**Rationale:**
- Single source of truth
- Consistent formatting
- Easier maintenance
- Ready for i18n if needed

### 5. Collision Strategy

**Decision:** Added `CollisionStrategy` parameter to rename operations.

**Rationale:**
- Explicit behavior on conflicts
- "rename" → find indexed path
- "skip" → no-op if target exists
- Better control for dispatch layer

## Migration Guide

### For Helper Methods

**Old Pattern:**
```typescript
const file = await helper.getFile(path); // throws
```

**New Pattern:**
```typescript
const result = await helper.getFile(path);
if (result.isErr()) {
  // handle error
  return;
}
const file = result.value;
```

### For Error Handling

**Old Pattern:**
```typescript
try {
  await helper.createFile(file);
} catch (error) {
  logError(error);
}
```

**New Pattern:**
```typescript
const result = await helper.createFile(file);
result.match(
  (file) => { /* success */ },
  (error) => { logError(error); }
);
```

## Testing Strategy

- [x] Unit tests for `systemPathToSplitPath` codec
- [ ] e2e tests for `TFileHelper` methods
- [ ] e2e tests for `TFolderHelper` methods
- [ ] Integration tests for vault action manager
- [ ] End-to-end tests for Librarian integration

## Breaking Changes

1. **Helper Methods:** All methods now return `Result` instead of throwing
2. **Batch Operations:** Removed from helpers (use dispatch layer)
3. **Error Handling:** Must handle `Result` types explicitly
4. **Path Types:** `PrettyPath` → `SplitPath` (typed variants)

## References

- [Obsidian Vault Action Manager Spec](./obsidian-vault-action-manager-spec.md)
- [Obsidian Vault Action Manager Stages](./obsidian-vault-action-manager-stages.md)
- [Maybe vs Neverthrow Tradeoffs](../analysis/maybe-vs-neverthrow-tradeoffs.md)
- [Librarian Architecture](../librarian/architecture.md)
