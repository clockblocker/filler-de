# Suffix Handling Invariants

## Core Principle

**The tree is suffix-agnostic. Suffixes are only reconstructed when needed for file I/O.**

## Invariant: Tree Structure

The `LibraryTree` stores only:
- `coreName`: The base name without suffix (e.g., `"Sonne"`)
- `coreNameChainToParent`: Path chain from root (e.g., `["Songs", "Rammstien"]`)
- `extension`: File extension (e.g., `"md"`)

**The tree NEVER stores or knows about suffixes.**

## Invariant: Canonical Basename Reconstruction

For a **healed tree** (where suffixes match paths), the canonical basename can be trivially reconstructed:

```typescript
function buildCanonicalBasename(
  coreName: CoreName,
  coreNameChainToParent: CoreNameChainFromRoot,
  suffixDelimiter: string
): string {
  // Suffix = reversed path chain
  const suffix = [...coreNameChainToParent].reverse();
  // Basename = coreName + suffix
  return suffix.length === 0 
    ? coreName 
    : [coreName, ...suffix].join(suffixDelimiter);
}
```

**Example:**
- `coreName = "Sonne"`
- `coreNameChainToParent = ["Songs", "Rammstien"]`
- `buildCanonicalBasename(...)` → `"Sonne-Rammstien-Songs"`

## Layer Responsibilities

### 1. Tree Layer (Suffix-Agnostic)
**Files:**
- `library-tree.ts` - Tree structure and mutations
- `tree-node.ts` - Node type definitions
- `tree-action.ts` - Tree action types

**Operations:**
- Tree mutations (create, delete, rename, move, status change)
- Tree queries (getNode, serializeToLeaves)
- Status propagation

**Never touches suffixes.**

### 2. Boundary Layer (Converts Between Tree ↔ Vault)
**Files:**
- `split-path-to-leaf.ts` - Vault → Tree: Parses basename to extract `coreName`
- `vault-to-tree.ts` - Vault → Tree: Translates VaultActions to TreeActions
- `tree-reader.ts` - Vault → Tree: Reads filesystem, creates tree

**Operations:**
- **Vault → Tree**: Parse basename with `parseBasename()` to extract `coreName` (strips suffix)
- **Tree → Vault**: Reconstruct basename with `buildCanonicalBasename()` when needed

### 3. File I/O Layer (Suffix-Aware)
**Files:**
- `metadata-service.ts` - Writes metadata to files
- `tree-reader.ts` - Reads file content (uses original paths during init)
- `setStatus()` in `librarian.ts` - Writes status to file metadata

**Operations:**
- When reading/writing files, reconstruct canonical basename from tree structure
- Use `buildCanonicalBasename(coreName, coreNameChainToParent, suffixDelimiter)`
- Build full path: `libraryRoot + "/" + coreNameChainToParent.join("/") + "/" + canonicalBasename + "." + extension`

### 4. Healing Layer (Suffix-Aware)
**Files:**
- `init-healer.ts` - Compares actual basename (with suffix) to expected (reconstructed)
- `create-handler.ts` - Computes if new files need suffix healing

**Operations:**
- Compares actual file basename (from vault) to expected basename (reconstructed from tree)
- Generates rename actions if mismatch

## Code Locations

### Where Suffixes Are Parsed (Vault → Tree)
1. `split-path-to-leaf.ts:31` - `parseBasename()` extracts `coreName`
2. `vault-to-tree.ts:99,139,162,212` - Parses basenames from VaultActions
3. `path-parsers.ts:33` - Parses basename for delete operations

### Where Suffixes Are Reconstructed (Tree → Vault)
1. `setStatus()` in `librarian.ts` - **NEEDS FIX**: Should use `buildCanonicalBasename()`
2. `init-healer.ts:72` - Reconstructs expected basename for comparison
3. `create-handler.ts:47` - Reconstructs basename for rename actions
4. `codex-builder.ts` - Reconstructs basenames for codex links

## Current Issues

### Issue: `setStatus()` reconstructs path incorrectly
**Location:** `librarian.ts:264`
**Problem:** Reconstructs path as `Library/Songs/Rammstien/Sonne.md` (no suffix)
**Should be:** Reconstruct canonical basename first, then build path

**Fix:**
```typescript
// Current (WRONG):
const path = `${this.libraryRoot}/${fullChain.join("/")}.${node.extension}`;

// Should be:
const canonicalBasename = buildCanonicalBasename(
  node.coreName,
  node.coreNameChainToParent,
  this.suffixDelimiter
);
const path = `${this.libraryRoot}/${node.coreNameChainToParent.join("/")}/${canonicalBasename}.${node.extension}`;
```

## Helper Functions

### `buildCanonicalBasename(coreName, coreNameChainToParent, suffixDelimiter)`
**Purpose:** Reconstruct canonical basename from tree structure
**Location:** `path-suffix-utils.ts:56`
**Use when:** Need to build file path from tree node

### `parseBasename(basename, suffixDelimiter)`
**Purpose:** Extract `coreName` from basename (strips suffix)
**Location:** `parse-basename.ts:11`
**Use when:** Converting vault file info to tree structure

### `computeSuffixFromPath(coreNameChain)`
**Purpose:** Compute suffix from path chain (reverses it)
**Location:** `path-suffix-utils.ts:14`
**Use when:** Building canonical basename

## Summary

1. **Tree = suffix-agnostic** - Only stores `coreName` and path chain
2. **File I/O = suffix-aware** - Reconstructs canonical basename when needed
3. **Boundary = converter** - Parses on input, reconstructs on output
4. **Healing = comparator** - Compares actual vs expected (reconstructed)

