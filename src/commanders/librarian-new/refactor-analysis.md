# Librarian & Healer Critical Review

## Executive Summary

The system works but has accumulated complexity. Key issues:
1. **Redundant tree traversals** - same tree walked 2-4x per operation
2. **Post-mutation node lookups** - must search for nodes after renaming them
3. **Full codex regeneration** - regenerates ALL codexes on ANY change
4. **Multi-layer path transformations** - 3+ representations converted repeatedly
5. **Fire-and-forget click handler** - race condition risk

---

## Issue 1: Redundant Tree Traversals

**Problem**: Codex logic traverses tree multiple times per operation.

```
codexImpactToRecreations():
  collectAllSectionChains()  → full tree walk #1
  collectAllScrolls()        → full tree walk #2
```

**Also**: `buildMovedCodexPath()` re-parses ALL segment IDs in chains.

**Fix**: Single traversal returning `{ sections, scrolls, parsedNames }`.

---

## Issue 2: Post-Mutation Node Lookup

**Problem** (healer.ts:151-157, 257-263): After renaming a node, segment ID changes. Must iterate siblings to find it:

```typescript
// After rename, old segmentId is stale
const node = Object.values(parent.children).find(n => n.nodeName === newName);
```

**Root cause**: Segment ID = encoded(nodeName + type). Rename changes ID.

**Alternative A**: Tree.apply() returns reference to mutated node
**Alternative B**: Store stable node IDs separate from segment IDs
**Alternative C**: Pass node reference into healing computation (current design pre-finds node)

---

## Issue 3: Full Codex Regeneration

**Problem** (codex-impact-to-actions.ts:135-156): ANY tree change regenerates ALL codexes.

```typescript
const allSectionChains = collectAllSectionChains(tree, codecs);
for (const chain of allSectionChains) {
  // Generate codex for EVERY section, not just impacted ones
}
```

**Why this matters**: Large libraries pay O(n) codex generation cost for leaf edits.

**Alternative**: Only regenerate codexes in `codexImpact.contentChanged` + ancestors.

---

## Issue 4: Path Representation Layers

**Current flow**:
```
TreeNodeLocator
  → sectionChainToPathParts()
  → buildCanonicalLeafSplitPath()
  → locatorToCanonicalSplitPathInsideLibrary()
  → pathPartsWithRootToSuffixParts()
  → final SplitPath
```

Each step involves codec calls and intermediate allocations.

**Alternative**: Single `computeCanonicalPath(locator): SplitPath` that does all steps internally.

---

## Issue 5: Descendant Suffix Healing Complexity

**Problem** (healer.ts:465-544): When folder moves, must update ALL descendant suffixes. Current approach:

1. Build `oldSuffixPathParts` from old location
2. Build `actualCurrentPath` from new location
3. For each leaf: combine old suffix + current path + node name
4. Compare to canonical, emit rename if different

Three separate path representations must stay perfectly synchronized.

**Alternative**: Store suffix as derived property, recompute on access rather than heal.

---

## Issue 6: Queue Drain Polling

**Problem** (librarian.ts:472-492): Uses polling to detect queue drain:

```typescript
// 5 consecutive 100ms checks = 500ms stability window
while (stableCount < 5) {
  await sleep(100);
  if (queue.length === 0 && !processing) stableCount++;
  else stableCount = 0;
}
```

**Fragility**: Events arriving at wrong time reset stability counter.

**Alternative**: Event-based signaling with Promise resolution when queue truly empties.

---

## Issue 7: Fire-and-Forget Click Handler

**Problem** (librarian.ts:378):
```typescript
void this.enqueue([action]);  // Promise not awaited
```

If plugin unloads during processing, click action may be lost.

**Fix**: Track pending promises, await on unload.

---

## Alternative Architectural Approaches

### Approach A: Declarative Diff-Based Healing

**Current**: Imperative per-action healing computation.

**Alternative**:
1. Snapshot tree state before action
2. Apply action
3. Diff old vs new state
4. Generate healing from diff

**Pros**: Single unified healing logic, no per-action-type handlers
**Cons**: Snapshot overhead, harder to debug specific actions

### Approach B: Event Sourcing with Projections

**Current**: Mutable tree + immediate healing.

**Alternative**:
1. Store TreeActions as append-only event log
2. Tree state = projection of event log
3. Healing = separate projection comparing "observed" vs "canonical" projections

**Pros**: Time-travel debugging, replay capability, clear separation
**Cons**: More infrastructure, memory overhead

### Approach C: Pull-Based Lazy Healing

**Current**: Push healing immediately after each action.

**Alternative**:
1. Mark nodes as "dirty" when actions applied
2. Batch healing computation on idle or explicit flush
3. Coalesce multiple actions into single healing pass

**Pros**: Fewer redundant heals for rapid changes, better batching
**Cons**: Delayed consistency, more complex dirty tracking

### Approach D: Simplified Path Model

**Current**: Multiple path representations (Locator, SplitPath, pathParts, suffixParts).

**Alternative**: Single canonical path type with lazy suffix computation:
```typescript
type LibraryPath = {
  segments: string[];  // ["Library", "recipe", "pie", "Note.md"]
  get suffix(): string[] { /* computed from segments */ }
  get basename(): string { /* computed */ }
};
```

**Pros**: Single source of truth, no conversion overhead
**Cons**: Breaking change, requires codec refactor

---

## Questions for Discussion

1. **Full codex regen**: Is this intentional for consistency, or just simpler? Would incremental codex updates be worth the complexity?

2. **Descendant suffix healing**: Could suffixes be computed lazily on file access rather than eagerly healed? Would Obsidian notice if suffixes are "wrong" temporarily?

3. **Queue drain polling**: Is there a specific reason for polling vs event-based? Was there a bug this solved?

4. **Path representations**: Are all the intermediate types (Locator, SplitPath variants, pathParts) necessary, or historical accumulation?

5. **Codex as projection**: Could codex content be computed on-demand rather than stored? Would this simplify or complicate?

6. **Error handling**: Current approach mixes `Result<T,E>` and throws. Intentional per-context or should unify?

---

## Recommended Priority

If simplifying:

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 1 | Single tree traversal for codex | Medium | High - performance |
| 2 | Incremental codex updates | Medium | High - performance |
| 3 | Return node ref from apply() | Low | Medium - code clarity |
| 4 | Event-based queue drain | Low | Medium - reliability |
| 5 | Unified path type | High | High - simplicity |
| 6 | Pull-based lazy healing | High | Medium - batching |
