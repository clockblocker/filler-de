# Librarian & Healer Refactoring Plan

## Task
Copy this plan to `src/commanders/librarian-new/plans/refactoring-plan.md`

---

## Current State Analysis

### Librarian (611 lines)
**Mixed concerns:**
- Init: file reading, action building, subscription setup
- Event handling: bulk events + checkbox clicks
- Queue processing: serial batch execution
- Action conversion: TreeAction → HealingAction → VaultAction
- Codex impact assembly: merging, deletions, recreations

**Complex methods:**
- `buildInitialCreateActions()` (82 lines) - loops, policy inference, status reading
- `processActions()` (86 lines) - 5+ steps: apply, merge impacts, convert, dispatch
- `handleCheckboxClick()` (67 lines) - parsing + action construction

### Healer (593 lines)
**Mixed concerns:**
- Tree mutation delegation (via `tree.apply()`)
- Healing computation per action type
- Type dispatch/narrowing (action type → handler)
- Descendant suffix recursion
- Deferred healing (defined but UNUSED)

**Complex methods:**
- `computeMoveHealing()` (147 lines) - 3 branches: section/scroll/file
- `computeRenameHealing()` (87 lines) - section vs leaf logic
- `computeDescendantSuffixHealing()` (80 lines) - recursive traversal
- `computeLeafHealing()` (55 lines) - overloaded, type narrowing

### Tree (322 lines)
✓ Clean, focused, well-organized

---

## Recommended Extractions

### 1. From Librarian → Pure Functions

**A. `buildInitialCreateActionsFromFiles()`**
```
Location: new file `librarian-init/build-initial-actions.ts`
Input: files[], codecs, rules
Output: CreateTreeLeafAction[]
```
Extract lines 212-293. Pure transformation except file.read() which returns Promise.

**B. `assembleVaultActions()`**
```
Location: new file `librarian-init/assemble-vault-actions.ts`
```
Extract lines 558-566 from processActions(). Combines healing + codex → vault actions.

**C. `processCodexImpacts()`**
```
Location: new file `librarian-init/process-codex-impacts.ts`
```
Extract lines 536-556 from processActions(). Merges impacts, computes deletions/recreations.

### 2. From Healer → Separate Functions

**A. `computeSectionMoveHealing()` (HIGH PRIORITY)**
```
Location: `healer/healing-computers/section-move-healing.ts`
```
Extract lines 348-408 from computeMoveHealing(). Handles:
- Folder rename action construction
- Descendant suffix healing delegation

**B. `computeLeafMoveHealing()`**
```
Location: `healer/healing-computers/leaf-move-healing.ts`
```
Extract lines 411-436. Handles Scroll and File moves.

**C. `parseOldSectionPath()`**
```
Location: `healer/utils/old-section-path.ts`
```
Repeated pattern at lines 222-243 (Rename) and 318-336 (Move).
Extract as: `parseOldSectionPath(targetLocator, codecs) → Result<string[], Error>`

**D. `computeDescendantSuffixHealing()` → standalone pure function**
```
Location: `healer/healing-computers/descendant-suffix-healing.ts`
```
Move lines 513-592. Receives tree section, returns HealingAction[].
No `this` dependency except codecs (pass as param).

### 3. Consider Removing: Deferred Healing

`DirtyTracker`, `applyDeferred()`, `flushHealing()` are defined but never called.
Options:
- **Remove**: Clean up 40+ lines, simplify Healer
- **Complete**: Wire up for batch healing (if performance needed)

### 4. Optional: Strategy Pattern for Action Healers

Instead of switch-like dispatch in `computeHealingForAction()`:
```ts
interface ActionHealer<A extends TreeAction> {
  computeHealing(action: A, tree: Tree, codecs: Codecs): HealingAction[]
}

class CreateHealer implements ActionHealer<CreateTreeLeafAction> {...}
class MoveHealer implements ActionHealer<MoveNodeAction> {...}
```
Map: `{ Create: CreateHealer, Move: MoveHealer, ... }`

**Trade-off:** More files vs better isolation. Only do if Healer grows further.

---

## Proposed File Structure

```
librarian-new/
├── librarian.ts              (~350 lines after extraction)
├── librarian-init/
│   ├── build-initial-actions.ts
│   ├── assemble-vault-actions.ts
│   └── process-codex-impacts.ts
├── healer/
│   ├── healer.ts             (~350 lines after extraction)
│   ├── healing-computers/
│   │   ├── section-move-healing.ts
│   │   ├── leaf-move-healing.ts
│   │   └── descendant-suffix-healing.ts
│   └── utils/
│       └── old-section-path.ts
```

---

## Implementation Order

1. **Extract `computeDescendantSuffixHealing()`** - pure, no state, easiest
2. **Extract `parseOldSectionPath()`** - removes duplication
3. **Split `computeMoveHealing()`** into section/leaf helpers
4. **Extract `processCodexImpacts()` from Librarian**
5. **Extract `buildInitialCreateActions()`**
6. **Decide on deferred healing** - remove or complete
7. *(Optional)* Strategy pattern if still complex

---

## Decisions

1. **Remove deferred healing** - delete DirtyTracker, applyDeferred(), flushHealing()
2. **Pure functions** for healing computers - simpler, easier to test
