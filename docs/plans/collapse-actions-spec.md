# Collapse Actions Specification

## Goal

Minimize filesystem calls by collapsing multiple operations on the same file into a single operation. This is critical for performance when batching many actions.

## Key Principle

**Operations on the same file path should be combined when possible, with later operations taking precedence or being composed.**

## Collapsible Operations on Markdown Files

### 1. ProcessMdFile (Transform Operations)

**Behavior:** Multiple transforms on the same file should be composed into a single transform.

**Rules:**
- `ProcessMdFile` + `ProcessMdFile` → Compose transforms: `transform2(transform1(content))`
- Order matters: earlier transforms are applied first
- Result: Single `ProcessMdFile` with composed transform

**Example:**
```typescript
// Input:
[
  { type: ProcessMdFile, payload: { splitPath: "a.md", transform: (c) => c + "A" } },
  { type: ProcessMdFile, payload: { splitPath: "a.md", transform: (c) => c + "B" } }
]

// Output:
[
  { type: ProcessMdFile, payload: { splitPath: "a.md", transform: (c) => (c + "A") + "B" } }
]
```

**FS Calls Saved:** N-1 (if N processes, save N-1 read/write cycles)

---

### 2. ReplaceContentMdFile (Write Operations)

**Behavior:** Latest write wins; replaces all prior operations on the same file.

**Rules:**
- `ReplaceContentMdFile` + `ReplaceContentMdFile` → Keep latest
- `ReplaceContentMdFile` + `ProcessMdFile` → Keep `ReplaceContentMdFile` (write wins)
- `ProcessMdFile` + `ReplaceContentMdFile` → Apply process to write content, then replace with final write
  - Special case: If process comes after write, apply transform to write content and convert to write

**Example:**
```typescript
// Input:
[
  { type: ReplaceContentMdFile, payload: { splitPath: "a.md", content: "old" } },
  { type: ReplaceContentMdFile, payload: { splitPath: "a.md", content: "new" } }
]

// Output:
[
  { type: ReplaceContentMdFile, payload: { splitPath: "a.md", content: "new" } }
]
```

**FS Calls Saved:** N-1 writes

---

### 3. ProcessMdFile + ReplaceContentMdFile Interactions

**Behavior:** When both operations exist, determine final content without reading from disk.

**Rules:**

#### Case A: Write → Process
```typescript
// Input:
[
  { type: ReplaceContentMdFile, payload: { splitPath: "a.md", content: "hello" } },
  { type: ProcessMdFile, payload: { splitPath: "a.md", transform: (c) => c.toUpperCase() } }
]

// Output:
[
  { type: ReplaceContentMdFile, payload: { splitPath: "a.md", content: "HELLO" } }
]
```
- Apply transform to write content immediately
- Convert to single `ReplaceContentMdFile` with transformed content
- **FS Calls Saved:** 1 read + 1 write (no need to read from disk, no need for process step)

#### Case B: Process → Write
```typescript
// Input:
[
  { type: ProcessMdFile, payload: { splitPath: "a.md", transform: (c) => c + "!" } },
  { type: ReplaceContentMdFile, payload: { splitPath: "a.md", content: "new" } }
]

// Output:
[
  { type: ReplaceContentMdFile, payload: { splitPath: "a.md", content: "new" } }
]
```
- Write replaces process entirely (write is final state)
- **FS Calls Saved:** 1 read (process never executes)

#### Case C: Process → Process → Write
```typescript
// Input:
[
  { type: ProcessMdFile, payload: { splitPath: "a.md", transform: (c) => c + "A" } },
  { type: ProcessMdFile, payload: { splitPath: "a.md", transform: (c) => c + "B" } },
  { type: ReplaceContentMdFile, payload: { splitPath: "a.md", content: "final" } }
]

// Output:
[
  { type: ReplaceContentMdFile, payload: { splitPath: "a.md", content: "final" } }
]
```
- All processes discarded, final write wins
- **FS Calls Saved:** 2 reads (processes never execute)

---

### 4. RenameMdFile Operations

**Behavior:** Latest rename wins; duplicate identical renames are dropped.

**Rules:**
- `RenameMdFile` + `RenameMdFile` (same from→to) → Drop duplicate
- `RenameMdFile` + `RenameMdFile` (different to) → Keep latest
- Key by `from` path (source file path)

**Example:**
```typescript
// Input:
[
  { type: RenameMdFile, payload: { from: "a.md", to: "b.md" } },
  { type: RenameMdFile, payload: { from: "a.md", to: "c.md" } }
]

// Output:
[
  { type: RenameMdFile, payload: { from: "a.md", to: "c.md" } }
]
```

**FS Calls Saved:** 1 rename operation

**Note:** Rename changes the file path, so subsequent operations on the old path are invalid. Operations on the new path should be handled separately.

---

### 5. CreateMdFile + Other Operations

**Behavior:** Create can be combined with initial content operations.

**Rules:**
- `CreateMdFile` + `ReplaceContentMdFile` → Merge into `CreateMdFile` with final content
- `CreateMdFile` + `ProcessMdFile` → Not applicable (can't process non-existent file)
- `CreateMdFile` + `TrashMdFile` → Drop create (trash wins)
- `CreateMdFile` + `RenameMdFile` → Keep both (create first, then rename)

**Example:**
```typescript
// Input:
[
  { type: CreateMdFile, payload: { splitPath: "a.md", content: "initial" } },
  { type: ReplaceContentMdFile, payload: { splitPath: "a.md", content: "final" } }
]

// Output:
[
  { type: CreateMdFile, payload: { splitPath: "a.md", content: "final" } }
]
```

**FS Calls Saved:** 1 write (create with final content directly)

---

### 6. TrashMdFile + Other Operations

**Behavior:** Trash invalidates all other operations on the same file.

**Rules:**
- `TrashMdFile` + any operation → Keep `TrashMdFile` only
- Trash is terminal: no point in processing/writing/renaming a trashed file
- Exception: `CreateMdFile` + `TrashMdFile` → Drop both (create then trash = no-op)

**Example:**
```typescript
// Input:
[
  { type: ProcessMdFile, payload: { splitPath: "a.md", transform: (c) => c + "!" } },
  { type: TrashMdFile, payload: { splitPath: "a.md" } }
]

// Output:
[
  { type: TrashMdFile, payload: { splitPath: "a.md" } }
]
```

**FS Calls Saved:** All operations before trash (process never executes)

---

## Collapse Algorithm

### Key Generation

For each action, generate a key:
- **Path-based actions** (Create, Trash, Process, ReplaceContent): Key by `splitPath`
- **Rename actions**: Key by `from` path (source)

### Collapse Rules (Priority Order)

1. **Trash wins** - If any action is Trash, drop all others on same key
2. **Write wins over Process** - If Write exists, apply Process to Write content if Process comes after
3. **Latest Write wins** - Multiple writes → keep latest
4. **Compose Processes** - Multiple processes → compose transforms
5. **Latest Rename wins** - Multiple renames → keep latest (drop identical)
6. **Create + Write merge** - Create with content can merge with Write

### Implementation Notes

- Process operations are **pure transforms** - they don't need file content during collapse
- When Process comes after Write, apply transform **synchronously** during collapse (transform is pure)
- When Write comes after Process, discard Process (Write is final state)
- Rename changes file identity - operations on old path vs new path are separate keys

## Performance Impact

**Best Case:** N operations on same file → 1 filesystem operation
- Example: 10 processes on same file → 1 read + 1 write (instead of 10 reads + 10 writes)

**Typical Case:** Mixed operations → Significant reduction
- Example: Write → Process → Write → Process → Write → 1 write (instead of 5 operations)

## Edge Cases

1. **Rename chain:** `a.md → b.md` then `b.md → c.md`
   - These are different keys (different `from` paths)
   - Should collapse to single rename: `a.md → c.md` (future optimization)

2. **Create + Trash:** Should collapse to no-op (drop both)

3. **Process on non-existent file:** Invalid, but handled gracefully (process will fail at execution)

4. **Write with empty content:** Still valid, should be preserved
