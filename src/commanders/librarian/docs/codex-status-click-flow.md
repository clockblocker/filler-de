# Codex Status Click Flow

Documents the flow when user clicks a checkbox in a codex file.

## Architecture Overview

```
User clicks checkbox
        ↓
CheckboxDetector (detector.ts)
        ↓
UserEventInterceptor emits CheckboxClicked event
        ↓
Librarian.handleCheckboxClicked()
        ↓
Tree.apply() with TreeAction
        ↓
propagateStatus() for sections
        ↓
Codex healing via healCodexForSection()
```

## Step 1: Click Detection

**File**: `src/managers/obsidian/user-event-interceptor/events/click/checkbox/detector.ts`

```typescript
// GenericClickDetector uses MOUSEDOWN in capture phase
// mousedown fires BEFORE browser toggles checkbox
// So checkbox.checked is PRE-toggle state (what user sees)
const wasChecked = checkbox.checked;

const payload = CheckboxCodec.encode({
    checked: wasChecked,  // PRE-toggle state (no inversion needed!)
    lineContent,
    splitPath,
});

// BLOCK Obsidian completely for codex checkboxes
evt.preventDefault();
evt.stopPropagation();
evt.stopImmediatePropagation();
```

**Key points**:
1. `GenericClickDetector` uses **mousedown** (not click) in **capture phase**
2. mousedown fires BEFORE browser toggles → `checkbox.checked` is already PRE-toggle
3. No inversion needed!
4. Must use all three: `preventDefault`, `stopPropagation`, `stopImmediatePropagation` to block Obsidian

## Step 2: Event Routing

**File**: `src/commanders/librarian/user-event-router/checkbox-event-router.ts`

Routes to `Librarian.handleCheckboxClicked()` with payload containing:
- `checked`: boolean (post-toggle state)
- `listItemText`: string (the checkbox label text)
- `filePath`: string (codex file path)

## Step 3: Librarian Handler

**File**: `src/commanders/librarian/librarian.ts` (~line 450)

```typescript
handleCheckboxClicked(payload: CheckboxClickPayload) {
    // 1. Parse listItemText to find which node was clicked
    // 2. Determine newStatus from payload.checked
    //    checked=true  → Done
    //    checked=false → NotStarted
    // 3. Create TreeAction to update node status
    // 4. Call tree.apply(action)
}
```

## Step 4: Tree Apply

**File**: `src/commanders/librarian/healer/library-tree/tree.ts`

```typescript
apply(action: TreeAction): Result<ApplyResult, TreeError> {
    // Updates node status in tree
    // For sections: calls propagateStatus()
    // Returns impacted section chains for healing
}
```

## Step 5: Status Propagation (Sections Only)

**File**: `src/commanders/librarian/healer/library-tree/tree.ts` (~line 280)

```typescript
propagateStatus(section: SectionNode, status: NodeStatus) {
    // Sets section.status = status
    // Recursively propagates to ALL children (sections + scrolls)
}
```

**Critical**: When clicking a section checkbox, the clicked status propagates DOWN to all descendants.

## Step 6: Status Computation

**File**: `src/commanders/librarian/healer/library-tree/codex/compute-section-status.ts`

```typescript
computeSectionStatus(section: SectionNode): NodeStatus {
    // Collects all descendant SCROLLS (leaves)
    // If all Done → Done
    // If all NotStarted → NotStarted
    // Otherwise → InProgress
}
```

**Key**: Section status is COMPUTED from descendant scrolls, not stored directly.

## Step 7: Codex Healing

After tree update, impacted codexes are healed:
1. Collect all nodes that belong to the codex
2. For each section: compute status from children
3. Generate markdown with correct checkbox states
4. Write to codex file

---

## Bug Scenario: Nested Section Checkbox

Tree structure:
```
P2 (section)
├── C2 (section)
│   ├── N22 (scroll)
│   └── N23 (scroll)
└── C1 (section)
```

### Expected Behavior
1. Click checked P2 → P2 + all children become unchecked
2. Click unchecked P2 → P2 + all children become checked

### Observed Bug
1. First click (uncheck P2): P2 + children all become CHECKED
2. Second click (uncheck P2): P2 stays checked, children become UNCHECKED

### Root Cause (CONFIRMED)
Two issues:
1. **Wrong assumption**: Code assumed `click` event, but `GenericClickDetector` uses `mousedown`
2. **Missing event blocking**: Obsidian was still processing the checkbox click

**Fix #1 - No inversion needed:**
`mousedown` fires BEFORE browser toggles, so `checkbox.checked` is already PRE-toggle state.
```typescript
// detector.ts - NO inversion!
const wasChecked = checkbox.checked;  // Already PRE-toggle
payload.checked = wasChecked;
```

**Fix #2 - Block Obsidian completely:**
```typescript
evt.preventDefault();
evt.stopPropagation();
evt.stopImmediatePropagation();
```

**Librarian logic (correct):**
```typescript
const newStatus = payload.checked
    ? TreeNodeStatus.NotStarted  // Was checked → uncheck
    : TreeNodeStatus.Done;       // Was unchecked → check
```

**Semantic contract:** `payload.checked` = "was checkbox checked when user clicked" (PRE-toggle state).

---

## Debug Logging Added

Debug logs added to trace flow (search for `DEBUG:` or `logger.info`):

1. **detector.ts** - Logs both POST-toggle and PRE-toggle(sent) states
2. **librarian.ts** - Logs `wasChecked → newStatus` mapping
3. **tree.ts** - Logs `propagateStatus` calls with section name and status
4. **compute-section-status.ts** - Logs computed status for sections

Remove these debug logs after verifying the fix works.
