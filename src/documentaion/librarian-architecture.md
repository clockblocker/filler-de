# Librarian Tree & Healing System — Architecture

> **Scope**: This document covers the tree/healing/codex half of the plugin (the "Librarian" commander). For the vocabulary/dictionary half, see `textfresser-architecture.md`. For E2E testing, see `e2e-architecture.md`.
>
> **Compatibility Policy (Dev Mode, 2026-02-20)**:
> - Textfresser is treated as green-field. Breaking changes are allowed; no backward-compatibility guarantees for Textfresser note formats, schemas, or intermediate contracts.
> - Librarian and VAM are stability-critical infrastructure. Changes there require conservative rollout, migration planning when persisted contracts change, and explicit regression coverage.

---

## 1. Vision

The Librarian manages a **hierarchical library** of user content inside an Obsidian vault. It enforces a bidirectional invariant between folder structure and filename suffixes, auto-generates index files (codexes), and tracks reading progress — all while staying invisible to the user.

**Core premise**: The user organizes content into nested folders (sections). The system keeps filenames, folder structure, index files, and metadata in sync automatically — no matter what the user renames, moves, or deletes.

**Properties of the managed library:**

1. **Self-healing** — renaming or moving files/folders triggers automatic suffix correction
2. **Auto-indexed** — each section folder gets a codex file listing its children with checkboxes
3. **Progress-tracked** — scroll status (Done/NotStarted) propagates through the tree
4. **Idempotent** — re-processing the same event produces no duplicate side effects
5. **Transactional** — healing actions are batched and dispatched atomically

---

## 2. Domain Model

The library models content as a tree of typed nodes:

```
Library (root SectionNode)
 ├─ SectionNode "German"
 │   ├─ SectionNode "Verbs"
 │   │   ├─ ScrollNode "laufen.md"
 │   │   └─ FileNode "conjugation-chart.pdf"
 │   └─ __-German.md  (codex — auto-generated index)
 ├─ SectionNode "Recipes"
 │   ├─ ScrollNode "Apfelkuchen.md"
 │   └─ __-Recipes.md  (codex)
 └─ ScrollNode "README.md"
```

| Concept | What it is | Vault representation |
|---------|-----------|---------------------|
| **SectionNode** | A folder that organizes content hierarchically | Folder: `Library/German/Verbs/` |
| **ScrollNode** | A markdown file the user reads | File: `laufen-Verbs-German.md` |
| **FileNode** | A non-markdown file (PDF, image, etc.) | File: `chart-Verbs-German.pdf` |
| **Codex** | Auto-generated index for a section | File: `__-Verbs-German.md` |

**SectionNode vs ScrollNode vs FileNode**: Sections are folders (branch nodes). Scrolls are `.md` files (leaf nodes with status). Files are everything else (leaf nodes, always status `Unknown`).

### 2.1 Tree Node Types

```typescript
type ScrollNode = {
  nodeName: NodeName;           // "laufen" — core name, no suffix
  kind: "Scroll";
  status: "Done" | "NotStarted" | "Unknown";
  extension: ".md";
};

type FileNode = {
  nodeName: NodeName;           // "chart"
  kind: "File";
  status: "Unknown";            // always Unknown for non-md files
  extension: string;            // ".pdf", ".png", etc.
};

type SectionNode = {
  nodeName: NodeName;           // "Verbs"
  kind: "Section";
  children: Record<TreeNodeSegmentId, TreeNode>;
};

type TreeNode = ScrollNode | FileNode | SectionNode;
```

**Source**: `src/commanders/librarian/healer/library-tree/tree-node/types/tree-node.ts`

---

## 3. The Central Invariant — Filename ↔ Path

**Invariant**: A leaf file's basename suffix must encode its folder path chain (reversed, excluding library root).

```
File at:       Library/German/Verbs/laufen-Verbs-German.md
                              ─────  ──────────────────
                              path    coreName + suffix

coreName:      "laufen"
suffixParts:   ["Verbs", "German"]    ← reversed path (sans root)
delimiter:     "-"
canonical:     "laufen-Verbs-German"
```

**Why?** This makes every file globally identifiable by its basename alone. Even if files are moved outside the library and back, the suffix encodes their intended location.

| Scenario | Before | After healing |
|----------|--------|--------------|
| Create file without suffix | `Library/A/B/Note.md` | `Library/A/B/Note-B-A.md` |
| Rename section folder | `Library/A/` → `Library/A2/` | All descendants: `*-A.md` → `*-A2.md` |
| Move file to new section | `Library/A/Note-A.md` → `Library/B/Note-A.md` | `Library/B/Note-B.md` |
| Move section folder | `Library/X/Y/` → `Library/Z/Y/` | Folder + all descendants' suffixes updated |

**Sections have no suffix** — their identity comes from their folder path directly.

**Source**: `src/commanders/librarian/codecs/internal/suffix/`

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Managers (Event capture, FS abstraction)                       │
│  ├─ VaultActionManager     — FS dispatch, BulkVaultEvent emit   │
│  ├─ UserEventInterceptor   — checkbox clicks in codex           │
│  └─ ActionsManager         — command executor factory            │
├─────────────────────────────────────────────────────────────────┤
│  Librarian Commander (src/commanders/librarian/)                │
│  ├─ librarian.ts           — orchestrator, event loop           │
│  ├─ codecs/                — path ↔ tree coordinate encoding    │
│  ├─ healer/                — tree mutation, healing, codex       │
│  │   ├─ healer.ts          — apply actions, compute healing     │
│  │   ├─ healing-transaction.ts — batch + audit                  │
│  │   ├─ healing-computers/ — per-action-type healing logic      │
│  │   ├─ backlink-healing/  — go-back link management            │
│  │   └─ library-tree/      — tree, codex, tree-actions          │
│  │       ├─ tree.ts        — mutable tree structure             │
│  │       ├─ codex/         — codex generation + impact          │
│  │       ├─ tree-action/   — action types + vault adapter       │
│  │       └─ tree-node/     — node types + segment IDs           │
│  ├─ bookkeeper/            — content segmentation (pages/blocks) │
│  ├─ commands/              — user command handlers               │
│  ├─ librarian-init/        — bootstrap sequence                  │
│  ├─ section-healing/       — on-demand section creation          │
│  └─ vault-action-queue/    — serialized async processing         │
├─────────────────────────────────────────────────────────────────┤
│  Stateless Helpers                                               │
│  ├─ note-metadata/         — dual-format metadata (YAML + JSON) │
│  └─ go-back-link/          — [[← parent]] link management       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Segment IDs and Locators

### 5.1 Segment IDs

Every tree node has a **segment ID** — a deterministic string key derived from its properties. The separator is `‐` (small em-dash, NOT regular hyphen).

```
ScrollNode "laufen"  →  "laufen‐Scroll‐md"
FileNode "chart.pdf" →  "chart‐File‐pdf"
SectionNode "Verbs"  →  "Verbs‐Section‐"
```

Format: `{coreName}‐{NodeKind}‐{extension}`

Segment IDs serve as keys in the `SectionNode.children` record. They are deterministic (same node always produces the same ID) and collision-free within a parent.

**Source**: `src/commanders/librarian/codecs/segment-id/`

### 5.2 Node Locators

A **locator** identifies a node within the tree hierarchy:

```typescript
type ScrollNodeLocator = {
  targetKind: "Scroll";
  segmentId: "laufen‐Scroll‐md";
  segmentIdChainToParent: ["German‐Section‐", "Verbs‐Section‐"];
};
```

The chain includes all ancestors from root (exclusive) to parent (inclusive). Locators are the **canonical address** of a node, independent of filesystem state.

**Source**: `src/commanders/librarian/codecs/locator/`

---

## 6. Codec System

Codecs bridge between vault paths (filesystem) and tree coordinates (semantic). All codecs are stateless — rules are injected at construction.

```typescript
type Codecs = {
  suffix: SuffixCodecs;                           // basename ↔ coreName + suffixParts
  segmentId: SegmentIdCodecs;                     // node ↔ segment ID string
  splitPathInsideLibrary: SplitPathInsideLibraryCodecs;  // vault path ↔ library-scoped path
  splitPathWithSeparatedSuffix: SplitPathWithSeparatedSuffixCodecs;
  libraryPath: LibraryPathCodecs;
  locator: LocatorCodecs;                         // locator ↔ canonical split path
};
```

### 6.1 Dependency chain

```
suffix (no deps)
  ↓
segmentId (no deps)
  ↓
splitPathInsideLibrary (minimal deps)
  ↓
splitPathWithSeparatedSuffix (depends on suffix)
  ↓
libraryPath (depends on segmentId)
locator (depends on segmentId, suffix)
```

### 6.2 Codec Rules

```typescript
type CodecRules = {
  suffixDelimiter: string;            // "-"
  suffixDelimiterPattern: RegExp;     // /\s*-\s*/ (flexible matching)
  libraryRootName: string;            // "Library"
  libraryRootPathParts: string[];     // ["Library"]
  showScrollBacklinks: boolean;       // add [[← parent]] links
  hideMetadata: boolean;              // JSON (hidden) vs YAML (visible)
  languages: LanguagesConfig;
};
```

### 6.3 Key conversions

```
Vault SplitPath → library-scoped → separated-suffix → canonical → locator
                                                    ← locator → canonical → vault
```

**Example**: vault path `Library/German/Verbs/laufen-Verbs-German.md` →

1. **Library-scoped**: `{ pathParts: ["German", "Verbs"], basename: "laufen-Verbs-German" }`
2. **Separated suffix**: `{ coreName: "laufen", suffixParts: ["Verbs", "German"] }`
3. **Locator**: `{ segmentId: "laufen‐Scroll‐md", chain: ["German‐Section‐", "Verbs‐Section‐"] }`

**Source**: `src/commanders/librarian/codecs/`

---

## 7. Tree Actions — From Vault Events to Semantic Mutations

### 7.1 The Translation Pipeline

Raw Obsidian events become tree-level semantic actions through a 3-layer pipeline:

```
BulkVaultEvent (raw Obsidian events + roots)
  ↓ Layer 1: Library Scope
makeLibraryScopedBulkVaultEvent()
  → filter to library-only events, convert to library-scoped paths
  ↓ Layer 2: Materialization
materializeScopedBulk()
  → expand folder events into per-node events (sections + leaves)
  ↓ Layer 3: Translation
translateMaterializedEvents()
  → infer policy + intent → produce TreeAction[]
```

**Source**: `src/commanders/librarian/healer/library-tree/tree-action/bulk-vault-action-adapter/`

### 7.2 Policy Inference

For Create and Rename events, the system infers a **policy** to determine how the basename maps to tree coordinates:

| Policy | When | Meaning |
|--------|------|---------|
| **NameKing** | File at library root (`Library/Note-A-B.md`) | Suffix defines hierarchy: coreName="Note", sections=["B","A"] |
| **PathKing** | File nested in folders (`Library/A/B/Note.md`) | Folder path defines hierarchy; suffix is ignored/healed |

```typescript
function inferCreatePolicy(splitPath): ChangePolicy {
  return splitPath.pathParts.length === 1
    ? ChangePolicy.NameKing   // direct child of Library root
    : ChangePolicy.PathKing;  // nested under Library folders
}
```

For Rename events, intent detection distinguishes:
- **Rename intent**: user changed the core name (same parent)
- **Move intent**: suffix changed → user wants to relocate

**Source**: `src/commanders/librarian/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent/`

### 7.3 Tree Action Types

```typescript
type TreeActionType = "Create" | "Delete" | "Rename" | "Move" | "ChangeStatus";
```

| Action | Fields | Produced by |
|--------|--------|-------------|
| **Create** | `targetLocator`, `observedSplitPath`, `initialStatus?` | File created in library |
| **Delete** | `targetLocator` | File/folder deleted |
| **Rename** | `targetLocator`, `newNodeName` | File/folder renamed (same parent) |
| **Move** | `targetLocator`, `newParentLocator`, `newNodeName`, `observedSplitPath` | File/folder moved to different parent |
| **ChangeStatus** | `targetLocator`, `newStatus` | Codex checkbox clicked |

All actions use **canonical tree locators** (segment IDs), not vault paths. The `observedSplitPath` is carried only for healing — it's the actual filesystem state that may need correction.

**Source**: `src/commanders/librarian/healer/library-tree/tree-action/types/tree-action.ts`

---

## 8. Healing System

### 8.1 The Healer

The Healer is the core engine. For each TreeAction, it:

1. **Disambiguates collisions** (Create only): if segment ID already occupied by a different file, assigns a new name
2. **Normalizes duplicates** (Create only): `"Untitled 2 1"` → `"Untitled 3"`
3. **Applies to tree**: `tree.apply(action)` → `{ changed, node }`
4. **Skips if idempotent**: if `changed === false`, returns empty
5. **Computes codex impact**: which sections need index regeneration
6. **Computes healing actions**: what filesystem renames are needed

```typescript
class Healer {
  getHealingActionsFor(action: TreeAction): HealerApplyResult {
    // 1. Collision detection (Create only)
    // 2. tree.apply(action) → { changed, node }
    // 3. If !changed → return empty
    // 4. computeCodexImpact(action)
    // 5. computeHealingForAction(action, node)
    return { changed, codexImpact, healingActions };
  }
}
```

**Source**: `src/commanders/librarian/healer/healer.ts`

### 8.2 Healing Per Action Type

| Action | Healing | Description |
|--------|---------|-------------|
| **Create** | `computeLeafHealing()` | Compare observed path vs canonical; emit RenameMdFile/RenameFile if different |
| **Delete** | None | Tree handles node removal; codex handles index update |
| **Rename (leaf)** | `computeLeafHealing()` | New canonical name with same suffix |
| **Rename (section)** | `computeDescendantSuffixHealing()` | Folder rename + all descendants' suffixes updated recursively |
| **Move (leaf)** | `computeLeafMoveHealing()` | New canonical with new suffix (new parent chain) |
| **Move (section)** | `computeSectionMoveHealing()` | Folder rename + recursive descendant suffix healing |
| **ChangeStatus** | None | No filesystem changes; only metadata/codex updates |

### 8.3 Leaf Healing

The simplest form: compare what the file IS named (observed) vs what it SHOULD be named (canonical from locator).

```typescript
function computeLeafHealingForScroll(
  locator: ScrollNodeLocator,
  observedSplitPath: SplitPathToMdFileInsideLibrary,
  codecs: Codecs,
): HealingAction[] {
  const canonical = buildCanonicalLeafSplitPath(locator, codecs);
  if (!splitPathsEqual(observedSplitPath, canonical)) {
    return [{ kind: "RenameMdFile", payload: { from: observed, to: canonical } }];
  }
  return [];
}
```

### 8.4 Recursive Descendant Suffix Healing

When a section is renamed/moved, all descendants need their suffixes updated. `computeDescendantSuffixHealing()` walks the subtree recursively:

```
For each child in section.children:
  If Section → recurse with updated old/new paths
  If Leaf → compute "observed" (old suffix + current location) vs "canonical" (new suffix)
    If different → emit rename action
```

The key insight: `buildObservedLeafSplitPath()` uses the **OLD suffix** (what was on disk before section rename) combined with the **CURRENT path** (where the file is now after Obsidian moved it). This bridges the rename gap.

**Source**: `src/commanders/librarian/healer/healing-computers/`

### 8.5 Healing Actions

Four types, all library-scoped:

```typescript
type HealingAction =
  | { kind: "RenameMdFile";  payload: { from, to } }
  | { kind: "RenameFile";   payload: { from, to } }
  | { kind: "RenameFolder"; payload: { from, to } }
  | { kind: "DeleteMdFile"; payload: { splitPath } }
```

These are converted to vault-scoped `VaultAction[]` via `healingActionToVaultAction()` before dispatch.

**Source**: `src/commanders/librarian/healer/library-tree/types/healing-action.ts`, `src/commanders/librarian/codecs/healing-to-vault-action.ts`

### 8.6 Healing Transaction

`HealingTransaction` wraps a batch of tree actions with audit semantics:

```typescript
class HealingTransaction {
  apply(action: TreeAction): Result<HealerApplyResult, HealingError>
  getHealingActions(): HealingAction[]   // all accumulated
  getCodexImpacts(): CodexImpact[]       // all accumulated
  commit(): void                          // finalize
}
```

The Librarian creates a transaction per event batch. If any action fails, the transaction is abandoned. On success, `commit()` records to audit log.

**Source**: `src/commanders/librarian/healer/healing-transaction.ts`

---

## 9. Codex System

### 9.1 What is a Codex?

A codex is an **auto-generated markdown index file** for each section folder. It lists the section's children as a checkbox list with wikilinks.

**Naming**: `__-{SectionSuffix}.md` — the `__` prefix marks it as system-generated.

Example codex for section chain `[Library, German, Verbs]`:

```markdown
⬆️ [[__-German|German]]

- [x] [[laufen-Verbs-German|laufen]]
- [ ] [[sprechen-Verbs-German|sprechen]]
- [x] [[__-Irregular-Verbs-German|Irregular]]
  - [x] [[sein-Irregular-Verbs-German|sein]]
```

### 9.2 Codex Impact

When a TreeAction modifies the tree, `computeCodexImpact()` determines which codex files need updating:

```typescript
type CodexImpact = {
  contentChanged: SectionNodeSegmentId[][];   // sections needing content regeneration
  renamed: Array<{ oldChain, newChain, observedPathParts? }>;  // codex file needs rename
  deleted: SectionNodeSegmentId[][];          // codex should be deleted
  descendantsChanged: DescendantsStatusChange[];  // status propagation
  impactedChains: Set<string>;                // all impacted chains (for incremental updates)
};
```

Impact per action type:

| Action | Content changed | Renamed | Deleted |
|--------|----------------|---------|---------|
| Create | Parent + ancestors | — | — |
| Delete (leaf) | Parent + ancestors | — | — |
| Delete (section) | Parent + ancestors | — | Section itself |
| Rename (leaf) | Parent | — | — |
| Rename (section) | Parent + section itself | Section (old→new) | — |
| Move | Old parent + new parent + ancestors | Section (if section move) | — |
| ChangeStatus | Parent + ancestors | — | — |

**Source**: `src/commanders/librarian/healer/library-tree/codex/compute-codex-impact.ts`

### 9.3 Status Aggregation

Section status is **computed**, not stored. `computeSectionStatus()` aggregates from all descendant scrolls:

- All scrolls Done → section is Done (checkbox `[x]`)
- All scrolls NotStarted → section is NotStarted (checkbox `[ ]`)
- Mixed → section treated as not done (`[ ]`)

Status flows:
- **Upward**: leaf status change → ancestor codexes recalculated
- **Downward**: section checkbox click → all descendant scrolls updated
- **Direct**: scroll checkbox → scroll metadata updated

### 9.4 Codex Pipeline

```
TreeAction[] → computeCodexImpact() per action → CodexImpact[]
  ↓
merge impacts → deduplicate chains
  ↓
codexImpactToDeletions() → HealingAction[] (DeleteMdFile for old codexes)
codexImpactToRecreations() → VaultAction[] (UpsertMdFile + ProcessMdFile for new codexes)
  ↓
extractScrollStatusActions() → VaultAction[] (ProcessMdFile for scroll metadata updates)
  ↓
All dispatched in single vam.dispatch() batch
```

**Source**: `src/commanders/librarian/healer/library-tree/codex/`

---

## 10. Backlink Healing (Go-Back Links)

Each scroll and codex file can have a **go-back link** as its first line, pointing to its parent section's codex:

```markdown
 [[__-German|← German]]

# Content starts here...
```

**Format**: `[[__-{ParentSuffix}|← {ParentName}]]`

`getBacklinkHealingVaultActions()` runs on init and after renames/moves. It:
1. Collects all section chains and scroll infos from the tree
2. For non-root codexes: sets go-back link to parent codex
3. For scrolls: sets or strips go-back link based on `rules.showScrollBacklinks`

Uses `goBackLinkHelper.upsert()` which strips all existing go-back links first (prevents duplicates), then inserts a fresh one.

**Source**: `src/commanders/librarian/healer/backlink-healing/`, `src/stateless-helpers/go-back-link/`

---

## 11. Note Metadata

### 11.1 Dual Format Support

The system supports two metadata storage formats:

**JSON Section** (hidden, authoritative):
```html
<section id="textfresser_meta_keep_me_invisible">
{"status":"Done","prevPageIdx":42}
</section>
```
Placed at the bottom of the file with 20 newlines of padding (invisible in Obsidian).

**YAML Frontmatter** (visible):
```yaml
---
status: Done
prevPageIdx: 42
---
```

### 11.2 Read/Write Strategy

- **Read**: tries JSON first, falls back to YAML
- **Write**: respects `rules.hideMetadata` setting (JSON if true, YAML if false)

### 11.3 Public API

```typescript
const noteMetadataHelper = {
  read(content, schema),       // Read metadata (JSON → YAML fallback)
  upsert(metadata),            // Write metadata (format per settings)
  strip(content),              // Remove all metadata
  toggleStatus(checked),       // Update status field
};
```

**Source**: `src/stateless-helpers/note-metadata/`

---

## 12. Event Loop — Runtime Processing

### 12.1 BulkVaultEvent

Obsidian emits individual file/folder events. The VaultActionManager coalesces them into batches:

```typescript
type BulkVaultEvent = {
  events: VaultEvent[];                    // all raw events
  roots: PossibleRootVaultEvent[];         // minimal semantic set
  debug: { startedAt, endedAt, trueCount, collapsedCount, reduced };
};
```

**Coalescing rules**:
- Quiet window: 250ms (flush when no new events)
- Max window: 2000ms (force flush)
- Rename chains collapsed: A→B, B→C becomes A→C
- Root reduction: folder rename covers descendant file renames

### 12.2 The Runtime Loop

```
BulkVaultEvent (from VaultActionManager)
  ↓
Librarian.handleBulkEvent(bulk)
  ↓
buildTreeActions(bulk, codecs, rules) → TreeAction[]
extractInvalidCodexesFromBulk(bulk, codecs) → HealingAction[]
  ↓
actionQueue.enqueue({ treeActions, invalidCodexActions })
  ↓
Librarian.processActions(treeActions, invalidCodexActions)
  ↓
For each treeAction:
  tx.apply(action) → { healingActions, codexImpact, changed }
  ↓
Merge: healingActions + invalidCodexActions
Process codex impacts → deletions + recreations
Extract scroll status actions
  ↓
assembleVaultActions(healingActions, codexRecreations, rules, codecs)
+ getBacklinkHealingVaultActions(healer, codecs, rules)
  ↓
vam.dispatch(allVaultActions)
  ↓
tx.commit()
```

### 12.3 VaultActionQueue

The queue serializes async processing — no two batches run concurrently. This prevents race conditions where one healing dispatch triggers events that interleave with another.

```typescript
class VaultActionQueue<T> {
  enqueue(item: T): Promise<void>     // waits until item is processed
  waitForDrain(): Promise<void>       // waits until queue is empty
}
```

**Source**: `src/commanders/librarian/vault-action-queue/vault-action-queue.ts`

---

## 13. Initialization — Bootstrap Sequence

On plugin load, the Librarian rebuilds the entire tree from vault state:

```
1. Read settings → create CodecRules + Codecs
2. Create empty Tree + Healer
3. Read all files from library root (vam.listAllFilesWithMdReaders)
4. For each file:
   a. Skip codex files (basename starts with "__")
   b. Convert to library-scoped path
   c. Infer policy (NameKing for root-level, PathKing for nested)
   d. Canonicalize to destination
   e. Build locator → CreateTreeLeafAction
   f. Read metadata → extract status (Done/NotStarted)
5. Apply all CreateTreeLeafActions via HealingTransaction
6. Find invalid codex files → delete actions
7. Scan for orphaned codexes → cleanup actions
8. Subscribe to vault events (BEFORE dispatch — catches cascading events)
9. Process codex impacts → deletions + recreations
10. Assemble: healing + codex + backlink actions
11. Single vam.dispatch(allVaultActions)
12. Wait for queue to drain
13. Commit transaction
```

**Source**: `src/commanders/librarian/librarian.ts:init()`, `src/commanders/librarian/librarian-init/`

---

## 14. Commands

### 14.1 Available Commands

| Command | Purpose |
|---------|---------|
| `SplitToPages` | Segment a long scroll into paginated folder structure |
| `SplitInBlocks` | Add Obsidian block markers (`^N`) to content |
| `GoToNextPage` | Navigate to next page sibling |
| `GoToPrevPage` | Navigate to previous page sibling |

### 14.2 Command Architecture

```typescript
type LibrarianCommandFn = (input: LibrarianCommandInput) => ResultAsync<void, CommandError>;

type LibrarianCommandInput = {
  commandContext: CommandContext & { activeFile: NonNullable<...> };
  librarianState: { librarian: Librarian; notify: NotifyFn; vam: VaultActionManager };
};
```

### 14.3 SplitToPages

Splits a long markdown file into paginated pages inside a new section folder:

1. Segment content into blocks via `splitStrInBlocksWithIntermediate()`
2. Group blocks into pages via `groupBlocksIntoPages()`
3. Build vault actions (create folder, create page files, delete original, add metadata)
4. Dispatch via VAM
5. Call `onSectionCreated()` → triggers `Librarian.triggerSectionHealing()` to create codex

The callback bypasses the normal event flow since the Librarian's self-event filter would ignore its own dispatched actions.

### 14.4 Codex Checkbox Interaction

When a user clicks a checkbox in a codex file:

```
mousedown event → CheckboxDetector → CheckboxPayload
  ↓
Handler.doesApply() → isCodexInsideLibrary() → true
  ↓
Handler.handle() → Librarian.handleCodexCheckboxClick(payload)
  ↓
parseCodexClickLineContent(line) → CodexClickTarget (Scroll or Section)
  ↓
payload.checked (PRE-toggle state) → compute newStatus (invert)
  ↓
Build ChangeNodeStatusAction
  ↓
actionQueue.enqueue({ treeActions: [action] })
```

`preventDefault + stopPropagation + stopImmediatePropagation` blocks Obsidian's own checkbox handler from reverting the change.

**Source**: `src/commanders/librarian/librarian.ts:handleCodexCheckboxClick()`

---

## 15. Bookkeeper — Content Segmentation

### 15.1 Unified Block-Page Pipeline

```
Content string
  ↓
splitStrInBlocksWithIntermediate() → Block[] (with charCount, intermediate markers)
  ↓
groupBlocksIntoPages() → Page[] (blocks already have markers)
  ↓
Format each page (heading insertion, metadata, go-back link)
```

### 15.2 Stream Processing

The segmenter uses a streaming pipeline for complex text processing:

- **LineScanner**: splits text into lines preserving structure
- **MarkdownProtector**: identifies and preserves markdown constructs (code blocks, tables)
- **DecorationStripper**: strips Obsidian-specific decorations for clean processing
- **SentenceSegmenter**: splits paragraphs into sentences at natural breaks

### 15.3 Page Metadata

Each page file gets navigation metadata:

```json
{ "noteKind": "Page", "prevPageIdx": 0, "nextPageIdx": 2 }
```

The `GoToNextPage` / `GoToPrevPage` commands read this metadata to navigate between siblings.

**Source**: `src/commanders/librarian/bookkeeper/`

---

## 16. Wikilink Alias Resolution

The Librarian provides alias resolution for wikilinks with suffixed basenames:

```
[[laufen-Verbs-German|laufen]]  →  displayed as "laufen"
[[__-Verbs-German|Verbs]]       →  displayed as "Verbs"
```

`resolveWikilinkAlias()` strips the suffix from the basename to produce a human-readable alias. Codex links get special handling (prefix `__` is detected and handled differently).

**Source**: `src/commanders/librarian/wikilink-alias/`

---

## 17. SplitPath Type System

### 17.1 Vault-Scoped (from VAM)

```typescript
type SplitPathToFolder = { kind: "Folder"; basename: string; pathParts: string[] };
type SplitPathToFile   = { kind: "File";   basename: string; pathParts: string[]; extension: string };
type SplitPathToMdFile = { kind: "MdFile"; basename: string; pathParts: string[]; extension: ".md" };
```

### 17.2 Library-Scoped (internal)

Same structure but `pathParts` excludes the library root. Created via `tryParseAsInsideLibrarySplitPath()`, converted back via `makeVaultScopedSplitPath()`.

### 17.3 Canonical with Separated Suffix

```typescript
type CanonicalSplitPathInsideLibrary = {
  kind: SplitPathKind;
  pathParts: string[];                    // WITH library root
  separatedSuffixedBasename: {
    coreName: string;                     // "laufen"
    suffixParts: string[];                // ["Verbs", "German"]
  };
  extension?: string;
};
```

This is the authoritative representation used by locators and healing.

**Source**: `src/managers/obsidian/vault-action-manager/types/split-path.ts`, `src/commanders/librarian/codecs/split-path-with-separated-suffix/`

---

## 18. Tree Implementation

### 18.1 Tree Class

The `Tree` manages a rooted tree of `TreeNode` objects:

```typescript
class Tree {
  apply(action: TreeAction): { changed: boolean; node: TreeNode | null }
  findSection(chain: SectionNodeSegmentId[]): SectionNode | undefined
  ensureSectionChain(chain: SectionNodeSegmentId[]): SectionNode
  getRoot(): SectionNode
}
```

### 18.2 Idempotency

`tree.apply()` returns `changed: boolean`. If the tree already reflects the action's target state, `changed === false` and no healing is computed. This prevents:

- Infinite loops from self-events (dispatched healing triggers new events)
- Duplicate healing on re-delivered events
- Unnecessary work on idempotent operations

### 18.3 Auto-Pruning

When a node is deleted, empty ancestor sections are automatically pruned:

```
Delete "Note" from Library/A/B/:
  → B becomes empty → pruned
  → A becomes empty → pruned
  → Library still has other children → kept
```

### 18.4 Section Chain Creation

Move and Create actions may target sections that don't exist yet. `ensureSectionChain()` creates missing intermediate sections along the chain.

**Source**: `src/commanders/librarian/healer/library-tree/tree.ts`

---

## 19. Key File Index

| File | Purpose |
|------|---------|
| **Librarian Core** | |
| `librarian.ts` | Orchestrator: init, event loop, command dispatch, checkbox handler |
| `../base-command-error.ts` | Shared BaseCommandError used by LibrarianCommandError and TextfresserCommandError |
| `vault-action-queue/vault-action-queue.ts` | Serialized async processing queue |
| `librarian-init/build-initial-actions.ts` | Bootstrap: build Create actions from vault state |
| `librarian-init/process-codex-impacts.ts` | Merge and process codex impacts |
| `librarian-init/assemble-vault-actions.ts` | Convert healing + codex to VaultActions |
| `section-healing/section-healing-coordinator.ts` | On-demand codex creation for new sections |
| `list-commands-executable.ts` | Query available commands for a file |
| `page-navigation.ts` | Tree-based page sibling lookup |
| **Codecs** | |
| `codecs/index.ts` | Codec factory and public API |
| `codecs/rules.ts` | CodecRules configuration |
| `codecs/internal/suffix/` | Suffix parse/serialize/split |
| `codecs/segment-id/` | Segment ID encoding/decoding |
| `codecs/locator/` | Locator ↔ canonical path |
| `codecs/split-path-with-separated-suffix/` | Path + separated suffix |
| `codecs/healing-to-vault-action.ts` | HealingAction → VaultAction conversion |
| **Healer** | |
| `healer/healer.ts` | Core: apply actions, collision detection, healing dispatch |
| `healer/healing-transaction.ts` | Transaction wrapper with audit |
| `healer/healing-computers/compute-leaf-healing.ts` | Observed vs canonical comparison |
| `healer/healing-computers/descendant-suffix-healing.ts` | Recursive subtree suffix update |
| `healer/healing-computers/section-move-healing.ts` | Folder rename + descendant healing |
| `healer/healing-computers/leaf-move-healing.ts` | Leaf move healing |
| `healer/backlink-healing/` | Go-back link management |
| `healer/orphan-codex-scanner.ts` | Orphaned codex cleanup |
| **Library Tree** | |
| `healer/library-tree/tree.ts` | Mutable tree structure |
| `healer/library-tree/tree-node/types/tree-node.ts` | Node type definitions |
| `healer/library-tree/tree-node/types/atoms.ts` | TreeNodeKind, TreeNodeStatus |
| `healer/library-tree/tree-action/types/tree-action.ts` | Action type definitions |
| `healer/library-tree/types/healing-action.ts` | HealingAction type |
| **Tree Action Adapter** | |
| `healer/library-tree/tree-action/bulk-vault-action-adapter/index.ts` | `buildTreeActions()` entry point |
| `.../layers/library-scope/` | Vault → library scope conversion |
| `.../layers/materialized-node-events/` | Folder events → per-node events |
| `.../layers/translate-material-event/` | Policy/intent inference → TreeAction |
| `.../policy-and-intent/policy/infer-create.ts` | NameKing vs PathKing |
| `.../policy-and-intent/intent/infer-intent.ts` | Rename vs Move intent |
| **Codex** | |
| `healer/library-tree/codex/compute-codex-impact.ts` | TreeAction → CodexImpact |
| `healer/library-tree/codex/codex-impact-to-actions.ts` | CodexImpact → VaultActions |
| `healer/library-tree/codex/compute-section-status.ts` | Aggregate status from descendants |
| `healer/library-tree/codex/generate-codex-content.ts` | Build codex markdown |
| `healer/library-tree/codex/helpers.ts` | `isCodexSplitPath()`, `isCodexInsideLibrary()` |
| **Bookkeeper** | |
| `bookkeeper/split-to-pages-action.ts` | SplitToPages command handler |
| `bookkeeper/build-actions.ts` | Build page VaultActions |
| `bookkeeper/segmenter/` | Content segmentation pipeline |
| `bookkeeper/segmenter/block-marker/split-str-in-blocks.ts` | Block splitting |
| `bookkeeper/segmenter/page-formatter/block-page-accumulator.ts` | Block → page grouping |
| **Commands** | |
| `commands/types.ts` | LibrarianCommandFn, LibrarianCommandKind |
| `commands/navigate-pages.ts` | GoToNextPage / GoToPrevPage |
| `commands/split-in-blocks.ts` | SplitInBlocks |

---

## 20. Issues and Concerns Found During Investigation

### 20.1 Zod v4 Import in atoms.ts

`src/commanders/librarian/healer/library-tree/tree-node/types/atoms.ts` uses `import z from "zod"` (v4 default import) instead of `import { z } from "zod/v3"`. This is the same v3/v4 mismatch trap documented in MEMORY.md. While it may not cause runtime issues here (enums are simple), it violates the project-wide rule in CLAUDE.md: "always use `import { z } from "zod/v3"`".

**Same issue in**: `src/commanders/librarian/healer/library-tree/tree-action/bulk-vault-action-adapter/layers/translate-material-event/policy-and-intent/intent/types.ts` — uses `import z from "zod"`.

**Risk**: If these schemas ever compose with v3 schemas (e.g., passed to a function expecting v3 ZodType), it can cause `keyValidator._parse is not a function` at runtime.

### 20.2 Typos in File/Folder Names

Several filenames contain typos that may cause confusion:
- `traslate-rename-materila-event.ts` — should be `translate-rename-material-event.ts`
- `make-event-libray-scoped.ts` — should be `make-event-library-scoped.ts`
- `enshure-all-examples-match-schema.ts` (in prompt-smith) — should be `ensure`
- `generated-promts/` — should be `generated-prompts`

These are cosmetic but hurt `grep`-ability and discoverability.

### 20.3 `as` Casts in Healer Collision Detection

`healer.ts` lines 101-154 use several `as` casts during collision detection:

```typescript
const createAction = action as CreateTreeLeafAction;  // line 101
actionToApply = { ...createAction, targetLocator: { ... } } as CreateTreeLeafAction;  // line 154
```

The CLAUDE.md rules say to avoid `as` unless undocumented Obsidian APIs. These could potentially be eliminated with better type narrowing (the `action.actionType === TreeActionType.Create` guard already narrows, but the `action` variable type may not be leveraging discriminated union narrowing properly).

### 20.4 `as` Casts in buildInitialCreateActions

`librarian-init/build-initial-actions.ts` has several `as` casts at lines 142, 146, 197-200, 206-208:

```typescript
const mdPath = observedPath as SplitPathToMdFileInsideLibrary;
const vaultMdPath = makeVaultScopedSplitPath(mdPath, rules) as SplitPathToMdFile;
```

These are inside a `file.kind === SplitPathKind.MdFile` check that should enable narrowing, but the library-scoped types don't participate in the discriminated union. A structural refactor of the inside-library types to use discriminated unions could eliminate these.

### 20.5 Deep Nesting in bulk-vault-action-adapter

The tree-action adapter lives at a very deep path:
```
healer/library-tree/tree-action/bulk-vault-action-adapter/
  layers/translate-material-event/policy-and-intent/policy/infer-create.ts
```

That's 9 levels deep from `src/commanders/librarian/`. While the layer separation is architecturally clean, it makes navigation and imports painful. Some consolidation (e.g., flattening `policy-and-intent/policy/` into `policy/`) could help without losing clarity.

### 20.6 Full Codex Regeneration (Not Incremental)

The codex system regenerates entire codex files rather than patching them. `impactedChains` enables knowing WHICH codexes to regenerate (O(k)), but the regeneration itself rewrites the full file content. For large sections with many children, this could be wasteful. However, given that codex files are typically small, this is likely acceptable as a pragmatic tradeoff.

### 20.7 Backlink Healing Runs on Every Event Batch

`getBacklinkHealingVaultActions()` iterates ALL section chains and ALL scrolls in the tree to produce ProcessMdFile actions. This runs after every bulk event, not just rename/move events. For a large library (hundreds of scrolls), this could produce many no-op ProcessMdFile actions that still need to be dispatched and filtered by VAM. Scoping backlink healing to only impacted subtrees (using codex impact chains) would be more efficient.

### 20.8 No Rollback on Transaction Failure

`HealingTransaction` has `commit()` but no real rollback. If a tree action fails mid-batch, the tree is left in a partially modified state (earlier actions already applied). The transaction simply stops processing further actions and logs the error. True rollback would require snapshotting tree state before the batch — likely overkill for now, but worth noting.

### 20.9 Debug Fields on Librarian Class

The Librarian class has four public `_debug*` fields:

```typescript
public _debugLastBulkEvent: BulkVaultEvent | null = null;
public _debugLastTreeActions: TreeAction[] = [];
public _debugLastHealingActions: HealingAction[] = [];
public _debugLastVaultActions: VaultAction[] = [];
```

These are useful for testing/debugging but add state to the class. A dedicated debug/telemetry observer pattern could keep the core class cleaner.

### 20.10 SplitPath Schema Uses Zod v4

`src/managers/obsidian/vault-action-manager/types/split-path.ts` uses `import { z } from "zod"` (note: not `"zod/v3"`). Same for `vault-event.ts` which uses `import z from "zod"`. These are in the managers layer, not in prompt-smith, so the mismatch risk is lower — but it still violates the project-wide convention.

### 20.11 Missing Documentation Link

The CLAUDE.md references `librarian-architrecture.md` (with typo) and `librarian-pieces.md` in `src/documentaion/`, but neither file existed before this document. The `librarian-pieces.md` is still missing.

### 20.12 Checkbox Event Handling Fragility

The codex-status-debug.md documents a race condition where Obsidian's own checkbox handler reverts changes made by the plugin's mousedown handler. The fix uses `preventDefault + stopPropagation + stopImmediatePropagation` on mousedown, plus one-time mouseup/click blockers. This is fragile — Obsidian updates could change the event handling order and re-introduce the bug. A more robust approach might be to apply the changes asynchronously (e.g., next microtask) after Obsidian's handlers complete.
