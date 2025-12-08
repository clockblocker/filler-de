# Librarian Separation of Concerns Refactor

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Vault Event                              │
│         (create / rename / delete / move (same as rename))  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: Filesystem Invariant (Imperative)                 │
│  ─────────────────────────────────────────                  │
│  • Canonicalize paths (basename ↔ folder must match)        │
│  • Create folders as needed                                 │
│  • Move files to canonical locations                        │
│  • Navigate view to new location                            │
│  Output: VaultActions executed immediately                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: Tree (Declarative State)                          │
│  ─────────────────────────────────────                      │
│  • Reconcile from filesystem (after Layer 1 settles)        │
│  • Source of truth for codexes, sections, statuses          │
│  • Path traversal for filename encoding                     │
│  • No filesystem side effects                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: Diff → Derived Artifacts                          │
│  ─────────────────────────────────────                      │
│  • Compare tree snapshots (before/after)                    │
│  • Regenerate codexes for affected sections                 │
│  • Propagate status updates                                 │
└─────────────────────────────────────────────────────────────┘
```

## Key Principle

**Filesystem events → heal → reconcile tree → diff → codexes**

- No tree mutation triggers filesystem (avoids feedback loops)
- Tree is read-model, filesystem is source of truth for structure
- Basename ↔ folder invariant is enforced uniformly regardless of event source

---

## Case Studies

### Case 1: User Renames Basename (implies folder move)

```
Event: parent/note-parent.md → parent/note-parent2.md
       (user renamed file in place)
        ↓
[Layer 1] Current: folder=parent, basename="note-parent2"
          Decode "note-parent2" → treePath ["parent2", "note"]
          Folder (parent) ≠ decoded folder (parent2)
          → Basename encodes different location
          Create parent2/ if needed
          Move file: parent/note-parent2.md → parent2/note-parent2.md
          Navigate to new location
        ↓
[Layer 2] Reconcile tree from filesystem
          Tree now has note at ["parent2", "note"]
          (was at ["parent", "note"])
        ↓
[Layer 3] Diff: parent/ lost a note, parent2/ gained one
          Regenerate codexes for parent/, parent2/
          Cleanup empty parent/ if no other notes
```

---

### Case 2: User Moves File to Different Folder

```
Event: parent/note-parent.md → parent2/note-parent.md
       (user moved file via drag-drop or file explorer)
        ↓
[Layer 1] Current: folder=parent2, basename="note-parent"
          Decode "note-parent" → treePath ["parent", "note"]
          Folder (parent2) ≠ decoded folder (parent)
          → Folder is truth for location
          Canonical basename = "note-parent2"
          Rename file: parent2/note-parent.md → parent2/note-parent2.md
        ↓
[Layer 2] Reconcile tree from filesystem
          Tree: note moved from ["parent", "note"] → ["parent2", "note"]
        ↓
[Layer 3] Diff: parent/ lost note, parent2/ gained note
          Regenerate codexes for parent/, parent2/
          Cleanup empty parent/ if no other notes
```

---

### Case 3: User Moves/Renames Entire Folder

```
Event: parent → grandparent/parent
       (user moved entire folder into grandparent/)
        ↓
[Layer 1] Scan all files in grandparent/parent/
          For each file (e.g., note-parent.md):
            Current folder: ["grandparent", "parent"]
            Decoded treePath: ["parent", "note"]
            Canonical for new location: ["grandparent", "parent", "note"]
            Canonical basename: "note-parent-grandparent"
            → Rename: note-parent.md → note-parent-grandparent.md
          
          If nested folders exist (grandparent/parent/child/):
            Same process recursively for all descendants
        ↓
[Layer 2] Reconcile tree from filesystem
          All notes now under ["grandparent", "parent", ...]
          Old section ["parent"] gone
          New section ["grandparent", "parent"] exists
        ↓
[Layer 3] Diff: 
          removedSections: [["parent"]]
          addedSections: [["grandparent"], ["grandparent", "parent"]]
          Notes show as moved (removed + added with new paths)
          Regenerate all affected codexes
```

---

### Case 4: User Moves Subfolder to Different Parent

```
Event: parent/child → parent2/child
       (user moved child folder from parent/ to parent2/)
        ↓
[Layer 1] Scan all files in parent2/child/
          For each file (e.g., note-child-parent.md):
            Current folder: ["parent2", "child"]
            Decoded treePath: ["parent", "child", "note"]
            Canonical for new location: ["parent2", "child", "note"]
            Canonical basename: "note-child-parent2"
            → Rename: note-child-parent.md → note-child-parent2.md
        ↓
[Layer 2] Reconcile tree from filesystem
          Section ["parent", "child"] → ["parent2", "child"]
          Notes under child/ now have parent2 ancestry
        ↓
[Layer 3] Diff:
          removedSections: [["parent", "child"]]
          addedSections: [["parent2", "child"]] (parent2 might already exist)
          Notes moved accordingly
          Regenerate codexes for parent/, parent2/, parent2/child/
          Cleanup empty parent/ if needed
```

---

## Pattern Summary

| Event Type | Layer 1 (Filesystem) | Layer 2 (Tree) | Layer 3 (Diff) |
|------------|---------------------|----------------|----------------|
| Rename basename | Move file to encoded folder | Note path changes | Codexes for old+new sections |
| Move file | Fix basename to match folder | Note path changes | Codexes for old+new sections |
| Move/rename folder | Fix all basenames inside | Section path changes | Codexes for all affected |

**Key insight:** Layer 1 always does the same thing—ensure `basename ↔ folder` invariant. The *source* of mismatch varies, but the *fix* is uniform.
