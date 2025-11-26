# File Management Architecture

Hybrid Diff-based + Event Queue approach for maintaining Library files.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERACTIONS                               │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐  │
│  │  Vault Events    │    │  Click Events    │    │  Commands            │  │
│  │  (rename/delete) │    │  (checkbox/link) │    │  (makeNoteAText)     │  │
│  └────────┬─────────┘    └────────┬─────────┘    └──────────┬───────────┘  │
└───────────┼───────────────────────┼──────────────────────────┼──────────────┘
            │                       │                          │
            ▼                       ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VAULT EVENT SERVICE                                  │
│  Filters by Library folder, dispatches to Librarian handlers                │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LIBRARIAN                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐          │
│  │ LibraryTree  │───▶│  TreeDiffer  │───▶│  VaultActionQueue    │          │
│  │ (pure state) │    │ (derive ops) │    │  (batch & execute)   │          │
│  └──────────────┘    └──────────────┘    └──────────────────────┘          │
└────────────────────────────────────────────────────────────────┬────────────┘
                                                                 │
                                                                 ▼
                                                    ┌──────────────────────┐
                                                    │ BackgroundFileService│
                                                    │   (single ops only)  │
                                                    └──────────────────────┘
```

## Event Flow

### Vault Events (via VaultEventService)
```
app.vault.on("delete")  → VaultEventService.handleDelete  → Librarian.onFileDeleted
app.vault.on("rename")  → VaultEventService.handleRename  → Librarian.onFileRenamed
app.vault.on("create")  → VaultEventService.handleCreate  → Librarian.onFileCreated
```

### Click Events (via ClickListener)
```
User clicks checkbox  → ClickListener  → Librarian.setStatus
User clicks page link → ClickListener  → navigate/open
```

### Commands (via Plugin)
```
"Make this note a text" → Librarian.makeNoteAText
"Create new text"       → Librarian.createNewTextInTheCurrentFolder
```

## Responsibility Split

| Layer | Responsibility |
|-------|----------------|
| `VaultEventService` | Listen to vault events, filter by library, dispatch to Librarian |
| `ClickListener` | Handle clicks on Codex checkboxes/links |
| `Librarian` | Business logic, tree mutations, withDiff wrapper |
| `LibraryTree` | Pure state mutations, status computation, snapshot |
| `TreeDiffer` | Detect what changed (added/removed/status) |
| `DiffToActionsMapper` | Derive file ops + **chain logic** (folder order) |
| `VaultActionQueue` | Dedupe (same file → one write), sort by weight, debounce |
| `VaultActionExecutor` | Execute actions via BackgroundFileService |
| `BackgroundFileService` | **Single file ops only** (no chains) |

## User Interactions → Tree Mutations

| User Action | Librarian Handler | Tree Mutation | File Actions |
|-------------|-------------------|---------------|--------------|
| Delete file | `onFileDeleted` | Remove text/page from tree | Update parent Codex |
| Rename file | `onFileRenamed` | Update node name | Rename related files, update Codexes |
| Move file | `onFileRenamed` | Change parent | Move files, update both parent Codexes |
| Click checkbox | `setStatus` | Change status | Update ancestor Codexes |
| Delete section | `onFileDeleted` | Remove subtree | Trash folder, update parent Codex |

## Core Idea

1. **LibraryTree** is pure in-memory state (source of truth for structure)
2. **Mutations** are wrapped: snapshot before → mutate → snapshot after
3. **TreeDiffer** computes what changed between snapshots
4. **DiffToActionsMapper** derives file operations from diff
5. **VaultActionQueue** collects, dedupes, sorts, batches actions
6. **Executor** flushes queue to disk via BackgroundFileService

## Action Types & Weights

Operations execute in weight order (lower = first):

```
0: UpdateOrCreateFolder   — must exist before files
1: RenameFolder
2: TrashFolder    — after contents moved

3: UpdateOrCreateFile
4: RenameFile
5: TrashFile      — after renames

6: ProcessFile    — content transforms
7: WriteFile      — content replacement
8: ReadFile       — no-op in queue
```

## Queue Behavior

### Deduplication
```typescript
queue.push({ type: "WriteFile", path: "Codex_A", content: "v1" });
queue.push({ type: "WriteFile", path: "Codex_A", content: "v2" });
// Only "v2" gets written (last wins)
```

### Debouncing
```
User clicks rapidly: Done → NotStarted → Done → NotStarted
Each triggers queue.push()
Only ONE flush happens 200ms after last click
```

### Sorting
```
Queue contains: [TrashFile, UpdateOrCreateFolder, WriteFile, UpdateOrCreateFile]
After sort:     [UpdateOrCreateFolder, UpdateOrCreateFile, WriteFile, TrashFile]
```

## File Structure

```
src/
├── main.ts                           // Plugin entry, wires services
│
├── commanders/librarian/
│   ├── librarian.ts                  // withDiff(), handlers, commands
│   ├── library-tree/
│   │   ├── library-tree.ts           // snapshot(), mutations
│   │   └── helpers/serialization.ts
│   ├── codex/
│   │   ├── codex-generator.ts        // node → CodexContent
│   │   └── codex-formatter.ts        // CodexContent → markdown
│   ├── text-splitter/
│   │   └── text-splitter.ts          // Split text into pages
│   └── diffing/
│       ├── tree-differ.ts            // diff(before, after)
│       └── diff-to-actions.ts        // diff → VaultActions
│
├── services/obsidian-services/
│   ├── vault-event-service.ts        // Listen to vault events
│   └── file-services/background/
│       ├── vault-action-queue.ts     // Dedupe, sort, debounce
│       ├── vault-action-executor.ts  // Execute actions
│       └── background-file-service.ts // Single file ops
│
└── services/wip-configs/event-listeners/
    └── click-listener/               // Handle checkbox clicks
```

## Implementation Status

- ✅ Phase 1: Queue Infrastructure
- ✅ Phase 2: Tree Snapshots & Diffing
- ✅ Phase 3: Librarian Integration
- ✅ Phase 4: Codex Integration
- ✅ Refactoring: VaultEventService extracted
- ⏳ Phase 5: User Interaction Handlers (in progress)
- ⏳ Phase 6: Edge Cases & Polish
