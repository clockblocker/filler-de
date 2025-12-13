# OpenedFileService E2E Test Implementation Plan

## Overview

E2E tests for `OpenedFileService` using WebdriverIO + Mocha, following the pattern established in `t-abstract-file-helpers` tests.

## Test Structure

### File Organization
```
tests/specs/opened-file-service/
├── opened-file-service.e2e.ts          # Main test suite
├── utils.ts                             # Testing API types & helpers
├── pwd.test.ts                          # pwd() tests
├── get-opened-tfile.test.ts            # getOpenedTFile() tests
├── get-content.test.ts                 # getContent() tests
├── replace-all-content.test.ts         # replaceAllContentInOpenedFile() tests
├── process-content.test.ts             # processContent() tests
├── is-file-active.test.ts              # isFileActive() tests
└── cd.test.ts                          # cd() tests
```

## Test Categories by Difficulty

### Level 1: Easy Tests (Basic Happy Path)
 
#### `pwd()` - Happy Path
- [x] **File**: `pwd.test.ts`
- [x] File is open → returns `Result<SplitPathToMdFile, string>` with correct path
- [x] File in root folder → pathParts is empty array
- [x] File in nested folder → pathParts matches folder structure
- **Effort**: Low - Direct API call, verify Result.isOk() and path structure

#### `getOpenedTFile()` - Happy Path
- [x] **File**: `get-opened-tfile.test.ts`
- [x] File is open → returns `Result<TFile, string>` with correct TFile
- [x] Verify TFile has correct path, name, extension
- **Effort**: Low - Direct API call, verify Result.isOk() and TFile properties

#### `getContent()` - Happy Path
- [x] **File**: `get-content.test.ts`
- [x] File with content → returns `Result<string, string>` with full content
- [x] File with empty content → returns empty string
- [x] File with multiline content → preserves newlines
- **Effort**: Low - Direct API call, verify Result.isOk() and content matches

### Level 2: Medium Tests (Error Cases & Edge Cases)

#### `pwd()` - Error Cases
- [x] **File**: `pwd.test.ts`
- [x] No file open → returns `Result.isErr()` with error message
- [ ] File closed during call → returns error
- **Effort**: Medium - Requires controlling file state

#### `getOpenedTFile()` - Error Cases
- [x] **File**: `get-opened-tfile.test.ts`
- [x] No file open → returns `Result.isErr()` with error message
- [ ] File closed during call → returns error
- **Effort**: Medium - Requires controlling file state

#### `getContent()` - Error Cases
- [x] **File**: `get-content.test.ts`
- [x] No file open → returns `Result.isErr()` with error message
- [ ] File closed during call → returns error
- **Effort**: Medium - Requires controlling file state

#### `isFileActive()` - Happy Path & Errors
- [x] **File**: `is-file-active.test.ts`
- [x] File is active → returns `Result<true, string>`
- [x] Different file is active → returns `Result<false, string>`
- [x] No file open → returns `Result.isErr()`
- [x] File path matches but different case → verify behavior (case-sensitive?)
- **Effort**: Medium - Requires opening files and checking state

### Level 3: Hard Tests (Complex Scenarios)

#### `replaceAllContentInOpenedFile()` - Happy Path
- [x] **File**: `replace-all-content.test.ts`
- [x] Replace with new content → content updated, returns `Result<string, string>`
- [x] Replace with empty content → file cleared
- [x] Replace with same content → no-op, scroll position unchanged
- **Effort**: Hard - Requires verifying scroll position preservation

#### `replaceAllContentInOpenedFile()` - Scroll Position Preservation
- [x] **File**: `replace-all-content.test.ts`
- [x] Top visible line exists in new content → scrolls to that line
- [x] Top visible line not found → scrolls to original index (clamped)
- **Effort**: Very Hard - Requires measuring scroll position before/after

#### `replaceAllContentInOpenedFile()` - Error Cases
- [x] **File**: `replace-all-content.test.ts`
- [x] No file open → returns `Result.isErr()` with error message
- [ ] File closed during call → returns error
- **Effort**: Medium - Requires controlling file state

#### `processContent()` - Happy Path
- [x] **File**: `process-content.test.ts`
- [x] Transform that modifies content → content updated, returns `Result<string, string>`
- [x] Transform that returns same content (no-op) → content unchanged
- [x] Transform with multiline content → preserves newlines
- **Effort**: Hard - Requires transform function and content verification

#### `processContent()` - Cursor Preservation
- [x] **File**: `process-content.test.ts`
- [x] Cursor position preserved when line exists → cursor restored
- [x] Cursor column clamped to line length → column adjusted if needed
- **Effort**: Hard - Requires measuring cursor position before/after

#### `processContent()` - Error Cases
- [x] **File**: `process-content.test.ts`
- [x] No file open → returns `Result.isErr()` with error message
- [x] File not active (different file open) → returns error
- **Effort**: Medium - Requires setting up error conditions

#### `cd()` - Happy Path
- **File**: `cd.test.ts`
- **Scenarios**:
  - Open file by TFile → returns `Result<TFile, string>`, file is active
  - Open file by SplitPathToMdFile → file opened, returns Result
  - Open file by SplitPathToFile → file opened, returns Result
  - Open nested file → file opened correctly
- **Effort**: Hard - Requires file creation, opening, and verification

#### `cd()` - Error Cases
- **File**: `cd.test.ts`
- **Scenarios**:
  - File doesn't exist → returns `Result.isErr()` with error message
  - Invalid argument type → returns `Result.isErr()` with error
  - Path points to folder → returns error (if applicable)
- **Effort**: Medium - Requires setting up error conditions

## Implementation Details

### Testing API Setup

```typescript
// In beforeEach:
await browser.executeObsidian(async ({ app }) => {
  await (app as any).commands.executeCommandById(
    "textfresser-testing-expose-opened-service",
  );
  
  const api = app?.plugins?.plugins?.["cbcr-text-eater-de"]
    ?.getOpenedFileServiceTestingApi?.();
  
  (globalThis as { __openedFileServiceApi?: OpenedFileServiceTestingApi })
    .__openedFileServiceApi = api;
});
```

### Testing API Type

```typescript
// utils.ts
export type OpenedFileServiceTestingApi = {
  openedFileService: {
    pwd: () => Promise<unknown>; // Result<SplitPathToMdFile, string>
    getOpenedTFile: () => Promise<unknown>; // Result<TFile, string>
    getContent: () => Promise<unknown>; // Result<string, string>
    replaceAllContentInOpenedFile: (content: string) => Promise<unknown>; // Result<string, string>
    isFileActive: (splitPath: unknown) => Promise<unknown>; // Result<boolean, string>
    cd: (file: unknown) => Promise<unknown>; // Result<TFile, string>
  };
  splitPath: (input: string) => unknown; // SplitPath
  splitPathKey: (splitPath: unknown) => string;
};
```

### Test Pattern Example

```typescript
export const testPwdHappyPath = async () => {
  const results = await browser.executeObsidian(async ({ app }: any) => {
    const api = (globalThis as { __openedFileServiceApi?: OpenedFileServiceTestingApi })
      .__openedFileServiceApi;
    if (!api) throw new Error("testing api unavailable");
    
    const { openedFileService, splitPath } = api;
    
    // Create and open a file
    const filePath = "test.md";
    await app.vault.create(filePath, "# Test");
    const file = app.vault.getAbstractFileByPath(filePath);
    await app.workspace.getLeaf(true).openFile(file);
    
    // Test pwd()
    const pwdResult = await openedFileService.pwd() as unknown as Result<SplitPathToMdFile>;
    
    if (pwdResult.isErr()) {
      return { error: pwdResult.error, success: false };
    }
    
    return {
      basename: pwdResult.value.basename,
      pathParts: pwdResult.value.pathParts,
      success: true,
    };
  });
  
  expect(results.success).toBe(true);
  expect(results.basename).toBe("test.md");
  expect(results.pathParts).toEqual([]);
};
```

## Special Considerations

### Scroll Position Testing

For `replaceAllContentInOpenedFile()` scroll preservation tests:

1. **Measure scroll position**: Access CodeMirror's `scrollDOM.scrollTop` and `lineAtHeight()`
2. **Get top visible line**: Use `editor.getLine()` with calculated line index
3. **Apply change**: Call `replaceAllContentInOpenedFile()`
4. **Verify scroll**: Check that scroll position matches expected (same line or clamped index)

```typescript
// In test:
const scrollTopBefore = cm.scrollDOM.scrollTop;
const topLineIndexBefore = Math.floor(cm.lineAtHeight(scrollTopBefore));
const topLineContentBefore = editor.getLine(topLineIndexBefore);

await openedFileService.replaceAllContentInOpenedFile(newContent);

const scrollTopAfter = cm.scrollDOM.scrollTop;
const topLineIndexAfter = Math.floor(cm.lineAtHeight(scrollTopAfter));
// Verify topLineIndexAfter matches expected position
```

### File State Management

- Use `obsidianPage.resetVault()` in `beforeEach` to ensure clean state
- Create files using `app.vault.create()` before testing
- Open files using `app.workspace.getLeaf(true).openFile(file)`
- Close files using `app.workspace.getActiveViewOfType(MarkdownView)?.leaf.detach()`

### Error Testing

For error cases (no file open):
1. Ensure no file is open (reset vault or explicitly close)
2. Call method
3. Verify `Result.isErr()` returns true
4. Verify error message matches expected

## Test Execution Order

1. **Setup**: Reset vault, expose testing API
2. **Happy Path Tests**: Basic functionality when file is open
3. **Error Tests**: Behavior when file is not open
4. **Edge Cases**: Special scenarios (empty content, nested paths, etc.)
5. **Complex Tests**: Scroll preservation, file navigation

## Dependencies

- `wdio-obsidian-service` for Obsidian integration
- `@wdio/globals` for WebdriverIO APIs
- Access to `OpenedFileService` via `getOpenedFileServiceTestingApi()`
- Access to `OpenedFileReader` (if needed for setup)

## Notes

- All methods return `Result<T, string>` from neverthrow
- Tests should verify both `isOk()` and `isErr()` paths
- Use `splitPath()` helper to convert string paths to SplitPath types
- Follow the "Golden Source Principle": Obsidian's behavior is authoritative
- Tests should be deterministic - use `resetVault()` to ensure clean state
