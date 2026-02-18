# Propagation V2 Phase 0 Capability Audit

Parent architecture doc:

- [`propagation-v2-architecture.md`](./propagation-v2-architecture.md)

Scope:

- Confirm whether existing Vault Action Manager (VAM) + Librarian lookup APIs can satisfy the minimum propagation IO surface for v2.
- Mark each capability as `covered` or `gap`.
- Propose only minimal adapter glue where needed.

Status: complete (implemented on February 18, 2026).

## Proposed Minimal Propagation IO Ports

```ts
type PropagationVaultPort = {
  readNoteOrEmpty(splitPath: SplitPathToMdFile): Promise<Result<string, string>>;
  readManyMdFiles(paths: ReadonlyArray<SplitPathToMdFile>): Promise<
    ReadonlyArray<
      | { kind: "Found"; splitPath: SplitPathToMdFile; content: string }
      | { kind: "Missing"; splitPath: SplitPathToMdFile }
      | { kind: "Error"; splitPath: SplitPathToMdFile; reason: string }
    >
  >;
  findCandidateTargets(params: {
    basename: string;
    folder?: SplitPathToFolder;
  }): ReadonlyArray<SplitPathToMdFile>;
  exists(path: AnySplitPath): boolean;
  buildTargetWriteActions(params: {
    splitPath: SplitPathToMdFile;
    transform: (content: string) => string;
  }): readonly VaultAction[];
};

type PropagationLibraryLookupPort = {
  findByLeafCoreName(coreName: string): ReadonlyArray<SplitPathToMdFile>;
};
```

Notes:

- `readNoteOrEmpty` is an adapter-level behavior ("missing file means empty"), not a raw VAM primitive.
- `readNoteOrEmpty` returns `Err` only for read/IO failures. Missing file maps to `ok("")`. Parse/validation/apply failures are handled in later stages, not in this port method.
- `readManyMdFiles` is the preferred Stage 6 hydrate API for already-resolved targets (bulk parallel reads with explicit missing/error outcomes).
- `readManyMdFiles` must classify "file vanished between `exists` and `readContent`" as `Missing`, not `Error`, to preserve create-on-write behavior under concurrent vault changes.
- Current v1 implementation may use message-based `"file not found"` detection due VAM string error contracts; this debt is tracked in [`error-contract-book-of-work.md`](./error-contract-book-of-work.md) (`EC-001`).
- `buildTargetWriteActions` returns actions to append to Generate's action list; v2 should keep dispatch outside the pure/apply phase.
- `buildTargetWriteActions` intentionally narrows transform to sync `(content) => string` for v2. Even though VAM supports async transforms, v2 apply/serialize is designed as pure synchronous DTO algebra.
- `findByLeafCoreName` is required for Library-hosted closed sets (for example prefixes/particles/prepositions) where path resolution must consult Librarian's leaf-core-name index.

## Capability Matrix

| Capability | Port method | Existing API(s) | Status | Notes |
|---|---|---|---|---|
| Read existing note content by split path (or empty when missing) | `readNoteOrEmpty` | `vam.exists(splitPath)`, `vam.readContent(splitPath)` | `covered` | `readContent` returns `Err` for missing files. Adapter can map `!exists` to `ok("")`, otherwise call `readContent`. No VAM change needed. |
| Bulk hydrate resolved target notes | `readManyMdFiles` | `vam.exists(splitPath)`, `vam.readContent(splitPath)` (parallelized in adapter) | `covered` | Implement in adapter with `Promise.all` over deduped target paths; return `Found/Missing/Error` per path and classify "file not found" read failures as `Missing` to preserve deterministic create-on-write behavior. |
| Resolve candidate target note paths by basename/policy | `findCandidateTargets` + `findByLeafCoreName` | `vam.findByBasename(basename, opts?)`, `librarian.findMatchingLeavesByCoreName(coreName)` (wired into `textfresserState.lookupInLibrary`) | `covered` | Current resolver policy is composition-level (`findByBasename` + Librarian core-name lookup + sharded fallback + healing in `target-path-resolver.ts`). Closed-set Library entries rely on the Librarian lookup branch. |
| Emit upsert/process actions for one target note | `buildTargetWriteActions` | `VaultActionKind.UpsertMdFile`, `VaultActionKind.ProcessMdFile`, existing pattern in `buildPropagationActionPair` | `covered` | Existing action pair pattern is sufficient. Port contract uses sync transform only (`(content) => string`) for v2 simplicity. VAM ensure-requirements can synthesize `UpsertMdFile(content:null)` when only `ProcessMdFile` is present. |
| Expose path-existence checks needed by resolver policy | `exists` | `vam.exists(splitPath)` | `covered` | Direct match for resolver and validation checks. |

Additional available capability (not required by the minimal v2 port):

- `vam.listAllFilesWithMdReaders(splitPathToFolder)` is available for recursive folder scans with per-file readers.
- This is useful for future resolver/index strategies, but not required for v2 Phase 0 because current propagation resolution is basename/policy-driven.

## Confirmed Gaps

None at VAM/Librarian port level for v2 propagation Phase 0.

## Required Phase 0 Deliverables (Adapter-Level Only)

1. Add a thin `PropagationVaultPort` adapter in `propagate-v2` orchestration code that:
   - Implements `readNoteOrEmpty` via `exists` + `readContent`.
   - Implements `readManyMdFiles(paths)` via parallelized reads with per-path `Found/Missing/Error` outcomes.
   - Treats "file not found" read failures as `Missing` (race-safe classification), not `Error`.
   - Wraps `findByBasename` (with optional folder scoping).
   - Centralizes write-action construction for one target note.
2. Add a thin `PropagationLibraryLookupPort` adapter that wraps Librarian leaf-core-name lookup (`findMatchingLeavesByCoreName`) as `findByLeafCoreName`.
3. Keep policy decisions (dictionary-scope validation, sharded fallback, healing-aware path choice) outside VAM and inside propagation resolver modules.
4. Do not add new VAM/Librarian methods unless a later phase reveals a concrete, test-proven gap.

## Evidence Snapshot (Current Code)

- VAM interface methods: `readContent`, `exists`, `findByBasename`, `dispatch`
  - `src/managers/obsidian/vault-action-manager/index.ts`
- Additional VAM inventory API: `listAllFilesWithMdReaders`
  - `src/managers/obsidian/vault-action-manager/index.ts`
- Librarian core-name lookup API: `findMatchingLeavesByCoreName`
  - `src/commanders/librarian/librarian.ts`
- Wiring from Librarian lookup into Textfresser state lookup (`lookupInLibrary`)
  - `src/main.ts`
  - `src/commanders/textfresser/textfresser.ts`
- Missing read behavior (`readContent` errors when file absent)
  - `src/managers/obsidian/vault-action-manager/impl/vault-reader.ts`
- Existing propagation path policy + healing + action pair helper
  - `src/commanders/textfresser/common/target-path-resolver.ts`
- Current generate propagation steps already consume these capabilities
  - `src/commanders/textfresser/commands/generate/steps/propagate-relations.ts`
  - `src/commanders/textfresser/commands/generate/steps/propagate-morphemes.ts`
  - `src/commanders/textfresser/commands/generate/steps/propagate-inflections.ts`
