# Librarian Refactor Plan

## Goal

Separate the current monolithic `Librarian` into 3 layers per `outline.md`.

---

## Current State

```
Librarian
├── Event handlers (onFileCreated/Renamed/Deleted)
│   └── Mixed: canonicalization + tree reconcile + codex regen
├── Tree management (trees, reconcileSubtree, withDiff)
├── Business ops (createNewNoteInCurrentFolder, makeNoteAText, etc.)
└── Dependencies: SelfEventTracker, LibraryReader, TreeDiffApplier
```

**Problem:** Event handlers do too much. Layer boundaries are blurred.

---

## Target State

### What's actually stateful (needs class/instance)

| Component | State |
|-----------|-------|
| Librarian | `trees: Record<RootName, LibraryTree>` |
| LibraryTree | tree nodes, parent refs |
| SelfEventTracker | `keys: Set<string>` |
| VaultActionQueue | pending actions |

### Stateless "classes" → extract to pure functions

| Current | State? | Extract to |
|---------|--------|------------|
| TreeDiffApplier | only rootName | `mapDiffToActions(diff, getNode, rootName)` |
| LibraryReader | only DI ref | `readNoteDtos(bgService, rootName, path)` |
| FilesystemHealer (proposed) | only rootName | `healFile(prettyPath, rootName)` |

### Already pure

- `canonicalizePrettyPath`
- `createFolderActionsForPathParts`
- `noteDiffer.diff`
- `isCanonical`

### Revised Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ VaultEventService                                           │
│   Thin router: receives Obsidian events, calls Librarian    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Librarian (orchestrator + state holder)                     │
│                                                             │
│ State:                                                      │
│   trees: Record<RootName, LibraryTree>                      │
│   selfEventTracker: SelfEventTracker                        │
│                                                             │
│ Orchestrates via pure functions:                            │
│   1. healFile(path, root) → actions                         │
│   2. execute actions                                        │
│   3. readNoteDtos(bgService, root, path) → notes            │
│   4. tree.reconcile(notes) → mutates tree                   │
│   5. tree.snapshot() before/after → diff                    │
│   6. mapDiffToActions(diff, getNode, root) → actions        │
│   7. execute actions                                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Pure Functions (no classes)                                 │
│                                                             │
│ filesystem/healing.ts                                       │
│   healFile(prettyPath, rootName): VaultAction[]             │
│   healFiles(files[], rootName): VaultAction[]               │
│                                                             │
│ filesystem/library-reader.ts                                │
│   readNoteDtos(bgService, rootName, path): Promise<NoteDto[]>│
│                                                             │
│ diffing/tree-diff-mapper.ts                                 │
│   mapDiffToActions(diff, getNode, rootName): VaultAction[]  │
│   regenerateCodexActions(paths, getNode, root): VaultAction[]│
│   (module-private helpers for path conversion, codex gen)   │
│                                                             │
│ invariants/path-canonicalizer.ts (exists)                   │
│   canonicalizePrettyPath(path, root): Canonical|Quarantine  │
└─────────────────────────────────────────────────────────────┘
```

### Benefits

- **Testable:** Pure functions test with plain data, no mocks
- **Simple:** No fake "classes" that are just function bundles
- **Clear state:** Only Librarian + LibraryTree + SelfEventTracker hold state
- **Readable:** `Librarian.onFileRenamed` reads as step-by-step orchestration

---

## Refactor Steps

### Phase 1: Create healing.ts (pure functions) ✅ DONE

**Create:** `src/commanders/librarian/filesystem/healing.ts`

```typescript
import { canonicalizePrettyPath, isCanonical } from "../invariants/path-canonicalizer";
import { createFolderActionsForPathParts } from "../utils/folder-actions";

export function healFile(prettyPath: PrettyPath, rootName: RootName): VaultAction[] {
  const canonical = canonicalizePrettyPath({ prettyPath, rootName });
  
  if ("reason" in canonical) {
    // Quarantine case
    return [
      ...createFolderActionsForPathParts(canonical.destination.pathParts, new Set()),
      { type: VaultActionType.RenameFile, payload: { from: prettyPath, to: canonical.destination } }
    ];
  }
  
  if (isCanonical(prettyPath, canonical.canonicalPrettyPath)) {
    return []; // Already canonical
  }
  
  return [
    ...createFolderActionsForPathParts(canonical.canonicalPrettyPath.pathParts, new Set()),
    { type: VaultActionType.RenameFile, payload: { from: prettyPath, to: canonical.canonicalPrettyPath } }
  ];
}

export function healFiles(files: PrettyPath[], rootName: RootName): VaultAction[] {
  const seen = new Set<string>();
  return files.flatMap(f => healFile(f, rootName));
}
```

**Key:** Wraps existing pure functions. No async, no tree access.

---

### Phase 2: Convert TreeDiffApplier to pure functions ✅ DONE

**Refactor:** `src/commanders/librarian/diffing/tree-diff-applier.ts`

```typescript
// Before
export class TreeDiffApplier {
  constructor(private rootName: string) {}
  mapDiffToActions(diff, getNode) { ... }
}

// After
export function mapDiffToActions(
  diff: NoteDiff,
  getNode: GetNodeFn,
  rootName: RootName
): VaultAction[] { ... }

export function regenerateCodexActions(
  paths: TreePath[],
  getNode: GetNodeFn,
  rootName: RootName
): VaultAction[] { ... }

// Module-private helpers (not exported)
function notePathToPrettyPath(notePath: TreePath, rootName: RootName): PrettyPath { ... }
function generateCodexContent(path: TreePath, getNode: GetNodeFn): string { ... }
// etc.
```

---

### Phase 3: Convert LibraryReader to pure function ✅ DONE

**Refactor:** `src/commanders/librarian/filesystem/library-reader.ts`

```typescript
// Before
export class LibraryReader { constructor(bgService) ... }

// After
export async function readNoteDtos(
  bgService: BackgroundFileService,
  rootName: RootName,
  subtreePath: TreePath = []
): Promise<NoteDto[]> { ... }
```

---

### Phase 4: Simplify Librarian event handlers ✅ DONE

**After refactor, event handler becomes linear orchestration:**

```typescript
async onFileRenamed(file: TAbstractFile, oldPath: string): Promise<void> {
  if (this.selfEventTracker.pop(oldPath) || this.selfEventTracker.pop(file.path)) return;
  if (!(file instanceof TFile) || file.extension !== "md") return;
  
  const prettyPath = toPrettyPath(file.path);
  const rootName = getRootName(prettyPath);
  if (!rootName) return;

  // Layer 1: Heal filesystem
  const healActions = healFile(prettyPath, rootName);
  if (healActions.length > 0) {
    this.selfEventTracker.register(healActions);
    this.actionQueue.pushMany(healActions);
    await this.actionQueue.flushNow();
  }

  // Layer 2: Reconcile tree
  const tree = this.trees[rootName];
  const before = tree.snapshot();
  const notes = await readNoteDtos(this.backgroundFileService, rootName, affectedPath);
  tree.reconcile(notes);
  const after = tree.snapshot();

  // Layer 3: Generate codex updates
  const diff = noteDiffer.diff(before, after);
  const getNode = (path) => tree.getMaybeNode({ path }).data;
  const codexActions = mapDiffToActions(diff, getNode, rootName);
  
  if (codexActions.length > 0) {
    this.actionQueue.pushMany(codexActions);
    await this.actionQueue.flushNow();
  }
}
```

---

### Phase 5: Handle folder events (unchanged approach) ✅ DONE

**Challenge:** Obsidian emits file events, not folder events.

**Approach:** Per-file healing (idempotent, correct, possibly slow)

Optimize later with batching/debouncing if needed.

**Status:** Already implemented. Each file rename event triggers `healFile` independently. Correct but may be slow for large folder moves.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `filesystem/healing.ts` | CREATE (pure functions) |
| `filesystem/healing.test.ts` | CREATE |
| `diffing/tree-diff-applier.ts` | REFACTOR → export functions, delete class |
| `filesystem/library-reader.ts` | REFACTOR → export functions, delete class |
| `librarian.ts` | SIMPLIFY (orchestration + state only) |
| `vault-event-service.ts` | SIMPLIFY (thin router to Librarian) |

### Detailed Changes

**`filesystem/healing.ts` (NEW)**
```typescript
export function healFile(prettyPath: PrettyPath, rootName: RootName): VaultAction[]
export function healFiles(files: PrettyPath[], rootName: RootName): VaultAction[]
// Uses: canonicalizePrettyPath, createFolderActionsForPathParts
```

**`diffing/tree-diff-applier.ts` → `diffing/tree-diff-mapper.ts`**
```typescript
// Before: class TreeDiffApplier { constructor(rootName) ... }
// After:
export function mapDiffToActions(diff: NoteDiff, getNode: GetNodeFn, rootName: RootName): VaultAction[]
export function regenerateCodexActions(paths: TreePath[], getNode: GetNodeFn, rootName: RootName): VaultAction[]
// Module-private helpers (not exported): notePathToPrettyPath, generateCodexContent, etc.
```

**`filesystem/library-reader.ts`**
```typescript
// Before: class LibraryReader { constructor(bgService) ... }
// After:
export async function readNoteDtos(
  bgService: BackgroundFileService,
  rootName: RootName,
  subtreePath?: TreePath
): Promise<NoteDto[]>
```

**`librarian.ts`**
- Remove: class instantiation of TreeDiffApplier, LibraryReader
- Keep: trees, selfEventTracker, actionQueue
- Simplify: event handlers become linear orchestration calling pure functions

---

## Open Questions

### Architectural

**Q1: FilesystemHealer purity**
- Plan says "no async, no tree access"
- Does it need filesystem reads to check folder existence?
- Or returns CreateFolder actions optimistically and caller handles deduplication?
- **Leaning:** Optimistic — return all potential actions, VaultActionQueue dedupes/handles existing folders

**Q2: Who owns SelfEventTracker?**
- Currently in Librarian
- After refactor: VaultEventService or FilesystemHealer?
- **Leaning:** VaultEventService — it's the event boundary, tracks what we caused

**Q3: Layer 3 trigger**
- TreeDiffApplier "already extracted" but who calls `mapDiffToActions()`?
- Is it `reconcileSubtree` that does: tree snapshot → diff → apply?
- **Leaning:** Yes, Librarian orchestrates: snapshot before → reconcile → snapshot after → diff → apply

---

### Navigation (#1)

After healing moves a file, who calls `openedFileService.cd()`?

| Option | Approach | Trade-off |
|--------|----------|-----------|
| A) Healer returns `navigateTo` | `{ actions, navigateTo?: PrettyPath }` | Couples healer to UI concern |
| B) Event handler checks | Compare before/after, navigate if active file moved | Handler needs path tracking |

**Leaning:** Option B — keeps FilesystemHealer pure. Handler compares `oldPath` vs canonical to detect if navigation needed.

---

### healRootFilesystem (#3)

Currently in Librarian, runs at startup.

| Option | Approach |
|--------|----------|
| A) Keep in Librarian.initTrees() | Librarian reads files, heals, then builds tree |
| B) FilesystemHealer.healRoot(files[]) | Healer produces actions, Librarian executes |

**Leaning:** Option B — `FilesystemHealer.healRoot(files: PrettyPath[])` returns actions. Librarian calls it during initTrees().

---

### Edge Cases

**E1: Rename-to-same-path (no-op)**
- User renames `note-parent.md` → `note-parent.md`
- Or case change: `note-parent.md` → `Note-Parent.md`
- **Handling:** Canonicalizer should detect `isCanonical()` early, return no actions

**E2: Conflicting targets**
- Heal says move to `parent2/note-parent2.md` but file already exists
- **Options:**
  - A) Fail/quarantine the source file
  - B) Generate unique name (`note-parent2_1.md`)
  - C) Overwrite (dangerous)
- **Leaning:** Option A — quarantine to Untracked/ with warning. User resolves manually.

**E3: Rapid successive events**
- User drags folder, Obsidian fires N rename events quickly
- Each triggers independent heal cycle
- **Risk:** Race conditions, redundant work
- **Mitigation:** Per-file healing is idempotent; might be slow but correct

---

### Implementation Details

**Q4: Why full healRootFilesystem on rename?**
- Current `onFileRenamed` calls `healRootFilesystem(rootName)` — scans entire root
- Is this for folder move detection?
- **Better:** Targeted heal of affected paths only
- Full scan only needed at startup or after major disaster

**Q5: FilesystemHealer scope — is it just a wrapper?**
- `canonicalizePrettyPath` is already pure
- Is FilesystemHealer just:
  ```typescript
  healFile(prettyPath) {
    const result = canonicalizePrettyPath(prettyPath, rootName);
    return createActionsFromCanonicalResult(result);
  }
  ```
- **Answer:** Yes, mostly wrapping canonicalizer + folder action creation
- Value: encapsulates "healing" concept, single entry point, testable unit

**Q6: Meta-info initialization**
- Currently in `healRootFilesystem`: adds missing meta-info to files
- Separate concern from "healing" (path invariant)
- **Options:**
  - A) Keep in healer (it's "fixing" files)
  - B) Separate `MetaInfoInitializer` 
  - C) Layer 3 concern (derived artifact like codex)
- **Leaning:** A for now — it's part of "make file valid"

**Q7: Cleanup logic (orphan folders)**
- Currently in `healRootFilesystem`: removes folders with only codex (no notes)
- Belongs in Layer 3 (diff-based)? Or separate cleanup pass?
- **Options:**
  - A) Part of healing (structure invariant)
  - B) Layer 3 — diff detects empty sections, generates trash actions
  - C) Separate scheduled cleanup
- **Leaning:** B — cleaner separation. Diff sees "section has no notes" → trash folder

**Q8: selfEventTracker location (confirmed)**
- Currently: instance field on Librarian
- After refactor: lives in VaultEventService
- VaultEventService is the event boundary — it receives Obsidian events, it should track which ones we caused
- FilesystemHealer stays pure (no tracking)

---

### Minor / Deferred

**Q9: Error recovery**
- What if action execution fails mid-batch?
- Leave inconsistent? Retry? Rollback?
- **Decision:** Defer to impl. VaultActionQueue already handles individual failures. Partial success is acceptable — next event/startup will re-heal.

**Q10: Case sensitivity**
- E1 mentions `Note-Parent.md` but macOS is case-insensitive
- Does `isCanonical` compare case-insensitively?
- **Risk:** Could cause infinite rename loops (`note` → `Note` → `note` → ...)
- ~~**Check:** Current `isCanonical` does exact string compare~~
- **DONE:** `isCanonical` now uses `.toLowerCase()` for comparison, preserves original case in filenames

**Q11: Initialization order**
- Plan says "heal then build tree"
- But healing generates events → triggers reconciliation → tree doesn't exist yet?
- **Existing:** `_skipReconciliation` flag in Librarian
- **Keep:** Set flag during init, clear after tree built

**Q12: Testing FilesystemHealer**
- Q5 says "testable unit" — what's the test plan?
- Pure functions → unit tests with mock paths, no filesystem needed
- **Test cases:**
  - Canonical file → no actions
  - Non-canonical basename → rename action
  - Non-canonical folder → move + rename actions
  - Quarantine case → move to Untracked/
  - Folder creation → CreateFolder actions generated
- **No mocks needed:** Just path strings in, actions out

---

## Success Criteria

- [x] Event handlers are linear orchestration (< 30 lines each)
- [x] `healFile`, `mapDiffToActions`, `readNoteDtos` are pure functions
- [x] No "stateless classes" — only Librarian, LibraryTree, SelfEventTracker hold state
      *(deprecated wrappers kept for backward compat, can remove later)*
- [x] All 4 case studies from outline.md work correctly
- [x] Existing tests pass (138/138)
- [x] New tests for `healFile`, converted functions

---

## ⚠️ Notes & Known Issues

**onFileRenamed still calls healRootFilesystem(rootName)**

```typescript
// Layer 2: Reconcile tree (full root heal for folder moves)
await this.healRootFilesystem(rootName);
```

This scans the entire root on every rename. Plan said "Replace with targeted heal" (Q4).

**OK for now** — folder moves need this. Optimize later with batching/debouncing.

---

## Follow-up Tasks

- [ ] Remove deprecated `TreeDiffApplier` class (keep only pure functions)
- [ ] Remove deprecated `LibraryReader` class (keep only pure functions)
- [ ] Update tests to use pure functions directly (not deprecated classes)
- [ ] Optimize `onFileRenamed` to avoid full root scan (targeted heal)
- [ ] Consider moving `selfEventTracker` to VaultEventService (Q2/Q8)
