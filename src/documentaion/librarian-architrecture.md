# Librarian Architecture
Keep this file accurate, lean and high-signal

## Business Purpose

The Librarian maintains a **Library** folder in an Obsidian vault with two invariants:

1. **Filename ⇄ Path Invariant (bidirectional)**
   - Path → canonical filename: files include parent folder names as suffix chain
   - Filename suffix → canonical path: suffix chain determines folder hierarchy

2. **Codex files** (out of scope for now)

### Canonical Format

- **Sections (folders)**: basename = single NodeName (no delimiter)
- **Leaves (files)**: basename = `coreName-suffix1-suffix2-...` where suffixes are parent folder names (deepest first)

Example:
```
Library/recipe/pie/Note.md → Library/recipe/pie/Note-pie-recipe.md
Library/Note-pie-recipe.md → Library/recipe/pie/Note-pie-recipe.md
```

## Pipeline

```
Obsidian API                     DOM/Editor Events
    ↓                                  ↓
VaultActionManager            UserEventInterceptor
    ↓ (BulkVaultEvent)                ↓ (UserEvent)
    └──────────────┬──────────────────┘
                   ↓
           buildTreeActions() → TreeAction[]
                   ↓
           HealingTransaction.apply()
                   ↓
           LibraryTree.apply() → { changed, node }
                   ↓ (if changed)
           HealingAction[] + CodexImpact
                   ↓
           HealingTransaction.commit()
                   ↓
           VaultActionManager.dispatch()
                   ↓
              Obsidian API
```

## Key Components

### Bookkeeper

`src/commanders/librarian/bookkeeper/`

Splits long scrolls into paginated folder structure.

```
splitToPagesAction() → segmentContent() → buildPageSplitActions()
    ↓
VaultActionManager.dispatch([CreateFolder, UpsertPages..., TrashScroll])
    ↓
onSectionCreated(SplitHealingInfo) → Librarian.triggerSectionHealing()
```

**SplitHealingInfo:**
- `sectionChain`: segment IDs for new folder
- `deletedScrollSegmentId`: trashed scroll ID
- `pageNodeNames`: created page names (e.g., `["Story_Page_000", "Story_Page_001"]`)

**Bypasses self-event filtering:** Dispatched page creates are filtered out. Bookkeeper passes `pageNodeNames` directly; `triggerSectionHealing` populates tree with scroll nodes before codex generation.

### ClickInterceptor
- Listens to DOM click events, identifies task checkboxes
- Emits `CheckboxClickedEvent` with file path, line content, checked state
- Librarian subscribes to toggle node status in codex files

### VaultActionManager
- Groups low-level filesystem callbacks into **BulkVaultEvent** windows
- Filters out system-triggered events (prevents feedback loops)
- Normalizes/collapses redundant events
- Extracts semantic root events (folder rename covers descendants)

#### Self-Event Filtering (SelfEventTracker)

When VaultActionManager dispatches actions, Obsidian emits corresponding events. The SelfEventTracker filters these out to prevent feedback loops and ensure only user-triggered events reach the Librarian.

**Path tracking** (exact match, pop-on-match):
- All action types track their target paths
- Matched events are filtered; path is then removed from tracker
- TTL: 5 seconds (cleanup stale registrations)
- **Registration timing**: All paths are registered upfront before any action executes. This prevents later actions (e.g., `ProcessScrollBacklink`) from re-registering paths that were already popped by earlier actions (e.g., `RenameMdFile`), which would incorrectly filter user events.

**Prefix tracking** (prefix match, does NOT pop):
- Only certain folder operations track prefixes
- Allows filtering multiple descendant events from a single folder operation

**Prefix tracking rules by action type:**

| Action | Prefix Tracked | Rationale |
|--------|----------------|-----------|
| `CreateFolder` | None | Obsidian emits only a single create event for the folder itself. Tracking as prefix would incorrectly filter user-created files inside. |
| `TrashFolder` | Folder path | Obsidian emits delete events for all descendants; prefix needed to filter them all. |
| `RenameFolder` | Source (from) only | Obsidian emits rename events with `oldPath` under source prefix. Tracking destination would incorrectly filter user-created files in the renamed folder. |

**Why destination prefix is NOT tracked for RenameFolder:**

When renaming `A → B`, Obsidian emits `rename: A/file.md → B/file.md` for each child. The `oldPath` check against source prefix `A` is sufficient to identify these as self-events. Tracking destination `B` as prefix would cause newly created files in `B/` to be incorrectly filtered during the TTL window.

### buildTreeActions (Adapter Layer)
Converts `BulkVaultEvent` → `TreeAction[]` through layers:

1. **Library Scope**: filters events inside Library, classifies boundary crossings
2. **Materialization**: expands root events into per-node events
3. **Translation**: converts to semantic TreeActions with policy/intent inference

### Policy & Intent Inference

**Policy** (how to canonicalize):
- **NameKing**: basename suffix defines path (flat files at Library root)
- **PathKing**: folder path defines suffix (nested files)

**Intent** (what user meant):
- **Rename**: in-place rename, suffix stays consistent with path
- **Move**: relocate node based on path change or suffix change

Intent rules:
- Basename unchanged → Move (path-based move)
- Folders: no suffix → Rename, has suffix → Move (NameKing)
- Files: suffix matches path → Rename, suffix differs → Move
- Files: empty suffix + nested → Move to root (NameKing)

### LibraryTree
- Mutable tree structure: root → sections → leaves
- `apply(action)` returns `{ changed: boolean, node: TreeNode | null }`. Changed flag enables idempotent processing
- Sections auto-created on leaf creation, auto-pruned on delete
- Computes healing for mismatches between observed and canonical paths
- Implements `TreeFacade` interface (see Refactoring Infrastructure)

### HealingAction → VaultAction
Library-scoped healing actions converted to vault-scoped actions for dispatch.

## Refactoring Infrastructure

Key modules: PathFinder (path/suffix), HealingError (error union), TreeReader/Writer/Facade (interface separation), HealingTransaction (wraps ops), HealingAuditLog (debug log), OrphanCodexScanner (startup cleanup), ActionHelpers (VaultAction helpers).

Details in `librarian-pieces.md`.

## Runtime Flow

1. **Init**: read Library filesystem, create tree, dispatch initial healing
   - Root files: NameKing (suffix → path)
   - Nested files: PathKing (path → suffix)
   - Metadata format conversion: files reformatted based on `hideMetadata` setting
2. **Steady-state**: listen to events → build actions → apply to tree → dispatch healing
3. **Queue**: **VaultActionQueue** (`src/commanders/librarian/vault-action-queue/`) serializes processing to maintain consistency

## Metadata

Controlled by `hideMetadata` setting (Settings → Hide metadata).

### hideMetadata = true (default)
Scroll status stored in hidden `<section>` at file end (20 lines padding):
```html
<section id="textfresser_meta_keep_me_invisible">
{"status":"Done","title":"My Note","created":"2023-04-18"}
</section>
```

### hideMetadata = false
Scroll status stored in standard YAML frontmatter:
```yaml
---
status: Done
title: My Note
created: 2023-04-18
---
```

### Format Conversion
Toggling `hideMetadata` triggers librarian reinit, which reformats all scrolls:
- `true→false`: internal section → YAML frontmatter (all fields preserved)
- `false→true`: YAML frontmatter → internal section (YAML stripped)
- Status mapping: `status`/`completion` field → internal status (Done/NotStarted)

### NoteMetadataManager (`src/managers/pure/note-metadata-manager/`)

Format-agnostic API for reading/writing note metadata (no Obsidian dependency).
Consumers don't need to know whether metadata is stored as YAML frontmatter or internal JSON.

**File Structure:**
```
note-metadata-manager/
├── index.ts           # Public API only
├── internal/
│   ├── frontmatter.ts # YAML logic (not exported)
│   ├── json-section.ts # Internal JSON format (not exported)
│   └── migration.ts   # Migration transforms (internal)
```

**Public API:**
- `readMetadata(content, schema)` → reads from either format (JSON first, fallback to YAML)
- `upsertMetadata(meta)` → writes to appropriate format based on `hideMetadata` setting
- `getContentBody()` → strips all metadata, returns clean content
- `META_SECTION_PATTERN` → regex for clipboard stripping

**Internal modules** (only imported by `build-initial-actions.ts` for migrations):
- `migrateFrontmatter()` → Transform to convert YAML → internal JSON
- `migrateToFrontmatter(meta)` → Transform to convert internal JSON → YAML

## Healing Types

- **RenameMdFile / RenameFile**: file path/basename correction
- **RenameFolder**: folder move when renamed with suffix (NameKing)
- **CreateFolder**: implicit folder creation for healing destinations
- **DeleteMdFile**: codex cleanup (orphaned codexes with wrong suffix)

### Dispatch Ordering Note

All healing actions are batched into a single `VaultActionManager.dispatch()` call. The dispatcher applies topological sort, but some orderings matter:

**Codex deletions for Move actions**: When a folder is moved (e.g., `L2 → L3-L2` interpreted as move to `L2/L3/`), old codexes must be deleted at their **intermediate location** (where Obsidian moved them), not the final canonical location (where the healing RenameFolder will put them). This is because DeleteMdFile executes before RenameFolder in the batch.

See `src/commanders/librarian-new/healer/library-tree/codex/architecture.md` for details on the `observedPathParts` mechanism.

## Canonicalization: Move-by-Name

When a node is renamed with a suffix (Move intent + NameKing policy), the suffix is interpreted differently for folders vs files:

### Folders: Relative Suffix Interpretation

Suffix is interpreted **relative to current parent context**.

```
Library/Recipe/Berry_Pie → Library/Recipe/Berry-Pie
  ↓ suffix = ["Pie"], parent = ["Library", "Recipe"]
Library/Recipe/Pie/Berry/
```

The destination path = `parent + reversed(suffix)` = `["Library", "Recipe"] + ["Pie"]`.

### Files: Absolute Suffix Interpretation

Suffix is interpreted **absolutely from Library root**.

```
Library/A/B/Note-C-D.md
  ↓ suffix = ["C", "D"]
Library/D/C/Note-C-D.md
```

The destination path = `["Library"] + reversed(suffix)` = `["Library", "D", "C"]`.

### Rationale

- **Folders** typically represent categories/topics. Adding a suffix creates subcategorization under the current context.
- **Files** use suffix as a full location specifier for drag-in scenarios and explicit user moves.

## UserEventInterceptor

`src/managers/obsidian/user-event-interceptor/`

Unified facade for all user-triggered DOM/editor events. Combines multiple detectors into a single subscription point for the Librarian.

### Architecture

```
UserEventInterceptor (facade)
    ├── ClickDetector      → CheckboxClicked, PropertyCheckboxClicked
    ├── ClipboardDetector  → ClipboardCopy
    ├── SelectAllDetector  → SelectAll
    └── WikilinkDetector   → WikilinkCompleted
           ↓
    UserEvent (discriminated union)
           ↓
    Librarian.subscribeToUserEvents()
```

### Event Types

| Event | Source | Purpose |
|-------|--------|---------|
| `CheckboxClicked` | DOM click on task checkbox | Toggle node status in codex |
| `PropertyCheckboxClicked` | DOM click on frontmatter checkbox | Toggle scroll status |
| `ClipboardCopy` | copy/cut events | Strip metadata from clipboard |
| `SelectAll` | Ctrl/Cmd+A | Smart selection excluding frontmatter/metadata |
| `WikilinkCompleted` | Editor `]]` typed | Auto-insert alias for library links |

### Event Callbacks

Events include callbacks for DOM/editor actions, keeping detection separate from business logic:

- `ClipboardCopy`: `preventDefault()`, `setClipboardData(text)`
- `SelectAll`: `preventDefault()`, `setSelection(from, to)`
- `WikilinkCompleted`: `insertAlias(alias)`

### Librarian Handling

User events are routed through **UserEventRouter** (`src/commanders/librarian/user-event-router/`):

```
UserEvent
    ↓
UserEventRouter.handle(event)
    ├── CheckboxClicked → checkbox-handler → TreeAction → enqueue
    ├── PropertyCheckboxClicked → checkbox-handler → TreeAction → enqueue
    ├── ClipboardCopy → clipboard-handler → strip metadata, set clipboard
    ├── SelectAll → select-all-handler → calculateSmartRange(), set selection
    └── WikilinkCompleted → wikilink-handler → insertAlias if library file
```

Handlers are extracted to `user-event-router/handlers/` for testability.

### Smart Range Calculation

`calculateSmartRange(content)` excludes from Ctrl+A selection:
1. YAML frontmatter (`---...---`)
2. Go-back links at start (`[[__...]]`)
3. Metadata section at end (`<section id="textfresser_meta...">`)

### Clipboard Stripping

Strips from copied text:
1. Go-back links: `[[__-L4-L3-L2-L1|← L4]]`
2. Metadata section: `<section id="textfresser_meta_keep_me_invisible">...</section>`

## Conventions

- `pathParts` and `segmentIdChainToParent`: include Library root (e.g., `["Library", "A", "B"]`)
- `suffixParts`: exclude Library root, reversed (e.g., `["B", "A"]`)
- Suffix delimiter: configurable (default `-`)

