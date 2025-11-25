# Codex Implementation

## Phase 1: Core Model & Types

- [ ] Create `src/commanders/librarian/codex/types.ts`
  - `CodexContent` type
  - `BackLink` type  
  - `CodexItem` type (recursive for nesting)
- [ ] Extend `LibraryFileDto` with optional `codexContent`

## Phase 2: Codex Generation from Tree

- [ ] Create `src/commanders/librarian/codex/codex-generator.ts`
  - `generateCodexForNode(node: SectionNode | TextNode): CodexContent`
  - Generate back link from `node.parent`
  - Section: recursively list children
  - Book: list pages flat
  - Map `node.status` → checkbox state

- [ ] Create `src/commanders/librarian/codex/codex-formatter.ts`
  - `formatCodexContent(content: CodexContent): string`
  - Output markdown with back link + nested checkboxes

- [ ] Create `src/commanders/librarian/codex/codex-parser.ts`
  - `parseCodexContent(markdown: string): CodexContent`
  - Extract checkbox states from existing file

## Phase 3: Integrate with Librarian

- [ ] Generate Codex files on `initTrees()`
  - For each Section/Book node, generate and create file

- [ ] Update Codex on status change
  - `setStatus()` → regenerate affected Codex files
  - Propagate up ancestor chain

- [ ] Batch operations via `BackgroundFileService`
  - Queue multiple Codex updates
  - Single write cycle

## Phase 4: Two-Way Sync

- [ ] Parse existing Codex on load
  - Compare checkbox states with tree
  - Reconcile differences

- [ ] Handle user manual edits
  - File change event → parse → update tree
  - Preserve user status intent

- [ ] Conflict resolution
  - Tree = source of truth for structure
  - User checkboxes can override status

## Phase 5: File Operations

- [ ] Codex CRUD on tree mutations
  - Create: new Section/Book
  - Delete: removed Section/Book  
  - Rename: rename file + update parent
  - Move: update old + new parents

- [ ] Fix `Pages` folder convention
  - Align `getLibraryFileToFileFromNode` with expected structure
  - Page pathParts should include "Pages"

## Phase 6: Polish

- [ ] Unit tests
  - `codex-generator`
  - `codex-formatter`
  - `codex-parser`

- [ ] Integration tests
  - Tree mutation → Codex file verification

- [ ] Performance
  - Debounce rapid status changes
  - Batch writes

- [ ] Edge cases
  - Empty sections
  - Scroll (no Codex)
  - Root Library (no back link)

## Current Issues to Fix

1. `codex-manager` exists but never used — delete or integrate
2. Codex files skipped during indexing — need to parse them
3. `CodexChapter` model doesn't match spec — replace with new types
4. `getLibraryFileToFileFromNode` returns empty Codex — add content generation
5. No sync between tree status and Codex checkboxes
6. Pages folder inconsistency in naming

## File Structure

```
src/commanders/librarian/codex/
├── types.ts           // CodexContent, BackLink, CodexItem
├── codex-generator.ts // Tree → CodexContent
├── codex-formatter.ts // CodexContent → markdown
└── codex-parser.ts    // markdown → CodexContent
```

