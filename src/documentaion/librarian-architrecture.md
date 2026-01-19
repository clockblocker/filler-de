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
Obsidian API                     DOM Events
    ↓                                ↓
VaultActionManager          ClickInterceptor
    ↓ (BulkVaultEvent)              ↓ (CheckboxClickedEvent)
    └──────────────┬────────────────┘
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
3. **Queue**: events processed sequentially to maintain consistency

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

Pure functions for reading/writing note metadata (no Obsidian dependency).

- **Internal metadata** (`impl.ts`): Hidden `<section>` blocks appended to notes storing JSON; uses Zod for parsing
- **Frontmatter** (`frontmatter.ts`): YAML frontmatter parsing/serialization; conversion between frontmatter and internal format
- Returns `Transform` functions for use with `ProcessMdFile` actions

Key exports:
- `readMetadata(content, schema)` → parse internal metadata with Zod
- `upsertMetadata(meta)` → Transform to write internal metadata
- `parseFrontmatter(content)` → parse YAML frontmatter
- `migrateFrontmatter()` → Transform to convert YAML → internal format
- `upsertFrontmatterStatus(status)` → Transform to update YAML status

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

## DOM Interceptors

The plugin uses interceptor classes to handle DOM events and transform them into semantic actions.

### ClickInterceptor

`src/managers/obsidian/click-interceptor/`

Listens to DOM click events and emits semantic `ClickEvent` objects. Currently handles:
- **Checkbox clicks** in codex files → `CheckboxClickedEvent` with file path, line content, checked state

The Librarian subscribes to these events to update node status when users toggle checkboxes in codex files.

```
DOM click event
    ↓
ClickInterceptor.handleClick()
    ↓
CheckboxClickedEvent { splitPath, lineContent, checked }
    ↓
Librarian.handleCheckboxClick()
    ↓
TreeAction (ChangeStatus)
    ↓
Healing pipeline...
```

### ClipboardInterceptor

`src/managers/obsidian/clipboard-interceptor/`

Intercepts `copy` and `cut` events to strip redundant info from copied text:

1. **Go-back links** at start of content: `[[__-L4-L3-L2-L1|← L4]]`
2. **Metadata section**: `<section id="textfresser_meta_keep_me_invisible">...</section>`

Uses `META_SECTION_PATTERN` from `src/managers/pure/note-metadata-manager/impl.ts`.

## Conventions

- `pathParts` and `segmentIdChainToParent`: include Library root (e.g., `["Library", "A", "B"]`)
- `suffixParts`: exclude Library root, reversed (e.g., `["B", "A"]`)
- Suffix delimiter: configurable (default `-`)

