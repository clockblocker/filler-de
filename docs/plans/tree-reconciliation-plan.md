# Tree Reconciliation & Codex Integration Plan

## Overview

After healing dispatch completes, update LibraryTree incrementally and regenerate codexes for impacted sections.

## Flow

```
User Action
    ↓
Healing Detection (Mode 1/2/3)
    ↓
Healing Dispatch (VaultActions)
    ↓
Tree Update (TreeActions)
    ↓
Collect Impacted Chains
    ↓
Codex Regeneration
    ↓
Codex Dispatch (VaultActions)
    ↓
Tree Update (CodexFileNode)
```

---

## 1. TreeAction Types

### Existing
- `CreateNode` - add new node
- `DeleteNode` - remove node and subtree
- `ChangeNodeName` - rename coreName (same parent)
- `ChangeNodeStatus` - update status with propagation

### New
- `MoveNode` - change parent (update `coreNameChainToParent`, relocate in tree)
  - Returns: `[oldParentChain, newParentChain]`

---

## 2. VaultAction → TreeAction Mapping

| VaultAction | TreeAction(s) |
|-------------|---------------|
| `CreateMdFile` | `CreateNode(Scroll)` |
| `CreateFile` | `CreateNode(File)` |
| `CreateFolder` | `CreateNode(Section)` |
| `DeleteMdFile` | `DeleteNode` |
| `DeleteFile` | `DeleteNode` |
| `DeleteFolder` | `DeleteNode` (cascades) |
| `RenameMdFile` (same folder) | `ChangeNodeName` |
| `RenameFile` (same folder) | `ChangeNodeName` |
| `RenameMdFile` (diff folder) | `MoveNode` |
| `RenameFile` (diff folder) | `MoveNode` |
| `RenameFolder` | `ChangeNodeName` or `MoveNode` |

**Detection**: Compare `from.pathParts` vs `to.pathParts`:
- Same → `ChangeNodeName`
- Different → `MoveNode`

---

## 3. CodexFileNode

New tree node type for codex files:

```typescript
type CodexFileNode = {
  type: "Codex";
  coreName: string; // e.g., "__SectionName"
  coreNameChainToParent: CoreNameChainFromRoot;
  tRef: TFile;
};
```

Naming: `__SectionName.md`
Location: Inside section folder (e.g., `Library/A/__A.md`)

---

## 4. Codex Content Structure

Each section's codex contains:

1. **Backlink to parent** (at top)
2. **Own direct children** - scrolls (toggleable) + files (non-toggleable)
3. **Grandchild scrolls** - scroll children of direct section children
4. **Section children** - up to 4 levels deep

### Format (existing, to preserve)

```markdown
[[__Parent|← Parent]]

- [ ] [[Note-A|Note]]
- [[File.pdf|File]]
	- [ ] [[ChildSection|ChildSection]]
		- [ ] [[Note-B-A|Note]]
```

### Key differences from legacy:
- Non-md files shown without checkbox: `- [[File.pdf|File]]`
- Md files (scrolls) shown with checkbox: `- [ ] [[Note|Note]]`
- Sections shown with checkbox (status from children)

### Checkbox meanings:
- `- [ ]` = NotStarted (scroll) or has NotStarted children (section)
- `- [x]` = Done (scroll) or all children Done (section)
- `- ` (no checkbox) = File (non-md), status Unknown

---

## 5. Impacted Chain Collection

After applying TreeActions, collect impacted chains:

```typescript
function collectImpactedChains(actions: TreeAction[]): CoreNameChainFromRoot[] {
  const chains: CoreNameChainFromRoot[] = [];
  for (const action of actions) {
    const result = tree.applyTreeAction(action);
    if (Array.isArray(result)) {
      // MoveNode returns [oldParent, newParent]
      chains.push(...result);
    } else {
      chains.push(result);
    }
  }
  return dedupeAndExpandAncestors(chains);
}
```

**Expand ancestors**: If `["A", "B", "C"]` is impacted, also include `["A", "B"]` and `["A"]`.

---

## 6. Codex Regeneration

For each impacted section chain:

```typescript
function regenerateCodex(sectionChain: CoreNameChainFromRoot): VaultAction | null {
  const section = tree.getNode(sectionChain);
  if (!section || section.type !== "Section") return null;
  
  const content = generateCodexContent(section, maxDepth: 4);
  const codexPath = [...sectionChain, `__${section.coreName}.md`];
  
  const existingCodex = findCodexNode(section);
  if (existingCodex) {
    return { type: "UpdateMdFile", payload: { splitPath, content } };
  } else {
    return { type: "CreateMdFile", payload: { splitPath, content } };
  }
}
```

---

## 7. Implementation Phases

### Phase 1: MoveNode TreeAction
- [ ] Add `MoveNode` to `TreeActionType` enum
- [ ] Implement `moveNode()` in LibraryTree
- [ ] Return `[oldParentChain, newParentChain]`
- [ ] Unit tests

### Phase 2: VaultAction → TreeAction Translator
- [ ] Create `translateVaultAction(action: VaultAction): TreeAction`
- [ ] Handle all VaultAction types
- [ ] Detect rename vs move by comparing pathParts
- [ ] Unit tests

### Phase 3: CodexFileNode
- [ ] Add `Codex` to `TreeNodeType` enum
- [ ] Update tree building to recognize `__*.md` files
- [ ] Skip codex files in healing (they're system-managed)
- [ ] Unit tests

### Phase 4: Codex Content Generator
- [ ] `generateCodexContent(section, maxDepth)` pure function
- [ ] Collect scrolls: own + grandchild
- [ ] Collect sections: up to 4 levels
- [ ] Format as markdown with wikilinks
- [ ] Unit tests

### Phase 5: Impacted Chain Expansion
- [ ] `expandToAncestors(chains)` utility
- [ ] `dedupeChains(chains)` utility
- [ ] Unit tests

### Phase 6: Integration in Librarian
- [ ] After healing dispatch: translate actions → TreeActions
- [ ] Apply TreeActions, collect impacted chains
- [ ] Expand to ancestors
- [ ] Regenerate codexes for impacted sections
- [ ] Dispatch codex actions
- [ ] Apply codex TreeActions to tree

### Phase 7: E2E Tests
- [ ] Create file → codex updated
- [ ] Move file → both old and new parent codexes updated
- [ ] Delete file → codex updated
- [ ] Folder rename → all child codexes updated

---

## 8. Edge Cases

1. **Root codex**: `Library/__Library.md` - contains all top-level scrolls and sections
2. **Empty section**: Codex still exists, just empty content
3. **Codex file manually edited**: Overwritten on next regen (warn user?)
4. **Concurrent edits**: Queue-based dispatch prevents races

---

## 9. Files to Create/Modify

### New Files
- `src/commanders/librarian/types/codex-node.ts`
- `src/commanders/librarian/codex/codex-generator.ts`
- `src/commanders/librarian/codex/index.ts`
- `src/commanders/librarian/reconciliation/vault-to-tree.ts`
- `src/commanders/librarian/reconciliation/impacted-chains.ts`
- `tests/unit/librarian/codex/codex-generator.test.ts`
- `tests/unit/librarian/reconciliation/vault-to-tree.test.ts`

### Modified Files
- `src/commanders/librarian/types/literals.ts` - add MoveNode, Codex types
- `src/commanders/librarian/library-tree.ts` - add moveNode(), codex handling
- `src/commanders/librarian/librarian.ts` - integrate reconciliation flow
- `src/commanders/librarian/healing/mode-detector.ts` - skip codex files

---

## 10. Clarifications (Resolved)

1. **Debouncing**: Not needed. VaultActionManager handles batch dispatch correctly.
2. **User edits**: Allowed. Codexes overwritten on any status toggle click. User clicks `- [ ]` → triggers status recalc → codex regen.
3. **Parent links**: Yes, backlink at top: `[[__Parent|← Parent]]`
