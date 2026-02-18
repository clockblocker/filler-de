# Textfresser Propagation V2 - Architecture

> Scope: This document defines the v2 propagation architecture for Textfresser Generate. It covers propagation only (from a newly generated source entry to referenced target notes). It does not change Lemma routing, section generation prompts, or VAM dispatch internals.

---

## 1. Status

Design status: locked for v1 implementation.

This document is the source of truth for:

- Pipeline shape and phase boundaries
- IO vs pure algebra responsibilities
- Matching identity precedence
- Intent model and merge semantics
- Migration plan from the current propagation step

---

## 2. Goals and Non-Goals

### 2.1 Goals

1. Keep propagation deterministic, idempotent, and one-hop.
2. Keep section algebra pure (no Obsidian API, no VAM calls, no file reads/writes).
3. Support per-`<Lang, Unit, SurfKind, Pos>` specialization while preserving one shared pipeline.
4. Apply all updates with one write action per target note.
5. Make propagation testable with fast DTO-only unit tests.

### 2.2 Non-Goals (v1)

1. No recursive/transitive propagation.
2. No back-propagation from mutated target notes.
3. No global refactor of all section parsers in one shot.
4. No requirement to fully type every section on day one.

---

## 3. Core Invariants

1. One-hop only:
- A source entry generates intents.
- Intents are applied to targets.
- The run ends. No second-wave propagation.

2. Algebra purity:
- `src/linguistics/**` propagator logic is pure DTO in/DTO out.
- Only orchestrator/adapters may do IO and VAM action creation.

3. Identity precedence:
- `byStableId -> byDeterministicKey -> byHeader (fallback + warn)`.

4. Idempotency:
- Running the same propagation twice with same source/targets produces no changes on second run.

5. One target write:
- All intents for a target note are merged and applied before one final `VaultAction`.

---

## 4. Architectural Split

Propagation is one phase with three internal subparts:

1. Hydrate (IO):
- Resolve unresolved semantic targets to concrete note paths.
- Read target notes.
- Parse notes into DTO form.

2. Algebra (Pure):
- Build propagation intents per section.
- Match/create target entries in parsed DTO.
- Apply section mutations via deterministic merge rules.

3. Materialize (IO-bound output):
- Serialize canonical markdown.
- Build VAM dispatch actions (plus path-healing actions when needed).

Important: "pure" means no file/path API calls inside propagator algebra.

Stage mapping:

1. Algebra: Stage 1 (intent collection from source sections).
2. Hydrate: Stage 2 (path resolution) and Stage 6.1 (read/parse target note).
3. Materialize: Stage 6.3 (serialize) and Stage 7 (emit actions).

Stages 3-5 (validation, dedupe, grouping) are orchestration control stages spanning the phase.

---

## 5. Pipeline

```text
Source DictEntry
  -> Collect unresolved intents by section (pure)
  -> Resolve target paths (IO)
  -> Validate intents
  -> Dedupe intents by intentKey
  -> Group intents by targetPath
  -> For each target:
       read + parse target note
       match/create target entry
       apply section mutations
       serialize canonical note
       emit one VaultAction
  -> Dispatch via VAM
```

### 5.1 Stage 1: Intent Collection

For each source section:

- `resolveTargets(section) -> UnresolvedTargetRef[]`
- `buildIntents(section, unresolvedTargetRef) -> UnresolvedPropagationIntent[]`

Stage 1 is pure algebra. No path lookup or vault calls are allowed.

### 5.2 Stage 2: Path Resolution (IO)

Orchestrator resolves each unresolved target ref into a concrete `targetPath`.

- Path resolution uses existing resolver policy (library lookup, sharding fallback, healing-aware path helpers).
- Only orchestrator/adapters perform this step.
- If resolver cannot produce a valid dictionary target path, the intent is rejected at validation.

### 5.3 Stage 3: Validation

Reject intent when:

- `targetPath` is malformed
- Target is outside dictionary scope
- Self-targeting is forbidden by section policy and detected

### 5.4 Stage 4: Dedupe

Deduplicate intents by deterministic `intentKey`.

### 5.5 Stage 5: Group by Target

`Map<targetPath, PropagationIntent[]>`.

### 5.6 Stage 6: Apply

For each group:

1. Read and parse target note.
- If target note does not exist but resolved path is valid dictionary scope, treat as empty content and create-on-write during emit.
2. For each intent:
- Resolve target entry via matching cascade.
- Create entry when strategy says create and none matches.
- Apply mutation with section merge policy.
3. Serialize canonical note body/meta.

A single propagator may emit multiple intents for the same target note across different sections (for example morpheme propagation emitting both `Morphology:addBacklink` and `Tags:addTags`).

### 5.7 Stage 7: Emit

Emission is all-or-nothing:

1. Build all target updates in memory first.
2. If any target fails during apply/serialize, return `Err` and emit zero propagation actions.
3. Append propagation actions to command action list only after all targets succeed.

---

## 6. Type Contracts (v1)

The following types are canonical architecture contracts. Concrete file placement may vary.

Branded codes are compile-time safety guards. Runtime adapters still parse/normalize raw strings into these branded forms at architecture boundaries.

```ts
export type StableEntryId = string;
export type IntentKey = string;
export type CreationKey = string;

export type LangCode = string & { readonly __brand: "LangCode" };
export type UnitKindCode = string & { readonly __brand: "UnitKindCode" };
export type SurfaceKindCode = string & { readonly __brand: "SurfaceKindCode" };
export type PosCode = string & { readonly __brand: "PosCode" };

export type SourceEntryKey = {
  notePath: string;
  stableId: StableEntryId;
  lemma: string;
  lang: LangCode;
  unit: UnitKindCode;
  surface: SurfaceKindCode;
  pos: PosCode;
};

export type UnresolvedTargetRef<TLang extends string, TUnit extends string, TSurface extends string, TPos extends string> = {
  targetLemma: string;
  lang: TLang;
  unit: TUnit;
  surface: TSurface;
  pos: TPos;
};

export type TargetRef<TLang extends string, TUnit extends string, TSurface extends string, TPos extends string> = {
  targetPath: string;
  lang: TLang;
  unit: TUnit;
  surface: TSurface;
  pos: TPos;
};

export type RelationItemDto = {
  relationKind: string;
  targetLemma: string;
  targetWikilink: string;
};

export type MorphologyBacklinkDto = {
  relationType: "derived_from" | "compounded_from" | "used_in";
  value: string;
};

export type MorphologyEquationDto = {
  lhsParts: ReadonlyArray<string>;
  rhs: string;
};

export type InflectionItemDto = {
  form: string;
  tags: ReadonlyArray<string>;
};

export type RelationSectionDto = { kind: "Relation"; items: ReadonlyArray<RelationItemDto> };
export type MorphologySectionDto = {
  kind: "Morphology";
  backlinks: ReadonlyArray<MorphologyBacklinkDto>;
  equations: ReadonlyArray<MorphologyEquationDto>;
};
export type InflectionSectionDto = { kind: "Inflection"; items: ReadonlyArray<InflectionItemDto> };
export type TagsSectionDto = { kind: "Tags"; tags: ReadonlyArray<string> };

export type SectionPayloadByKind = {
  Relation: RelationSectionDto;
  Morphology: MorphologySectionDto;
  Inflection: InflectionSectionDto;
  Tags: TagsSectionDto;
};

export type EntryMatchCriteria =
  | { strategy: "byStableId"; stableId: StableEntryId }
  | {
      strategy: "byDeterministicKey";
      lang: LangCode;
      unit: UnitKindCode;
      surface: SurfaceKindCode;
      pos: PosCode;
      lemma: string;
    }
  | { strategy: "byHeader"; normalizedHeader: string }
  | { strategy: "createNew"; creationKey: CreationKey; template: NewEntryTemplate };

export type SectionMutation =
  | {
      sectionKind: "Relation";
      op: "addRelation";
      relationKind: string;
      targetLemma: string;
      targetWikilink: string;
    }
  | {
      sectionKind: "Morphology";
      op: "addBacklink";
      backlinkWikilink: string;
      relationType: "derived_from" | "compounded_from" | "used_in";
    }
  | {
      sectionKind: "Morphology";
      op: "addEquation";
      lhsParts: ReadonlyArray<string>;
      rhs: string;
    }
  | {
      sectionKind: "Inflection";
      op: "upsertInflection";
      tags: string[];
      headerTemplate: string;
    }
  | {
      sectionKind: "Tags";
      op: "addTags";
      tags: string[];
    };

export type PropagationIntent = {
  targetPath: string;
  entryMatch: EntryMatchCriteria;
  mutation: SectionMutation;

  sourceStableId: StableEntryId;
  sourceSection: string;
  sourceNotePath: string;

  creationKey?: CreationKey;
  intentKey: IntentKey;
};

export type UnresolvedPropagationIntent = Omit<PropagationIntent, "targetPath"> & {
  target: UnresolvedTargetRef<LangCode, UnitKindCode, SurfaceKindCode, PosCode>;
};
```

---

## 7. Propagator Contracts

`Propagator<Src, Tgt>` is explicit and typed.

```ts
export type TargetRefOf<TgtEntry> = TgtEntry extends {
  lang: infer L extends string;
  unit: infer U extends string;
  surface: infer S extends string;
  pos: infer P extends string;
}
  ? TargetRef<L, U, S, P>
  : never;

export type UnresolvedTargetRefOf<TgtEntry> = TgtEntry extends {
  lang: infer L extends string;
  unit: infer U extends string;
  surface: infer S extends string;
  pos: infer P extends string;
}
  ? UnresolvedTargetRef<L, U, S, P>
  : never;

export interface Propagator<
  SrcEntry,
  TgtEntry,
  K extends keyof SectionPayloadByKind,
> {
  sectionKind: K;
  resolveTargets(input: {
    source: SrcEntry;
    section: SectionPayloadByKind[K];
  }): ReadonlyArray<UnresolvedTargetRefOf<TgtEntry>>;
  buildIntents(input: {
    source: SrcEntry;
    section: SectionPayloadByKind[K];
    target: UnresolvedTargetRefOf<TgtEntry>;
  }): ReadonlyArray<UnresolvedPropagationIntent>;
}
```

### 7.1 Why explicit `<Src, Tgt>`

1. Compile-time protection from nonsense source-target pairs.
2. Clear declaration of same-shape vs cross-shape propagation.
3. Easier registration and test coverage per linguistic slice.

---

## 8. Matching Engine

Matching is centralized in pipeline code, not inside propagators.

### 8.1 Precedence

1. `byStableId`
2. `byDeterministicKey`
3. `byHeader` (fallback only, log warning)

### 8.2 Deterministic Key

Key fields must be canonical and normalized:

- `lang`
- `unit`
- `surface`
- `pos`
- `lemma` (from canonical metadata/DTO, not from rendered header text)

Header text is never primary identity.

`byDeterministicKey` is a fallback only when stable ID matching is unavailable.

If lemma mutability is introduced in the future, deterministic-key matching must be revised with an explicit migration/rekey strategy.

### 8.3 Create-New Flow with `creationKey`

For create intents:

1. Intent carries `creationKey` and creation template.
2. Apply stage parses note and checks if same creation intent already resolved.
3. If missing, allocator picks next note-local index for the required ID prefix.
4. Stable entry id is minted during apply, not during intent creation.

This avoids pre-allocation races and still allows deterministic dedupe.

Concurrency assumption in v1:

- Apply + emit runs under a single Generate writer lock (single-flight coordinator) in one process.
- Without this serialization guarantee, concurrent runs can allocate colliding next indices for the same target note.
- If this assumption changes, allocator must add collision retry against latest note state before final emit.

---

## 9. Intent Key

`intentKey` is a deterministic hash over semantic payload, not rendered markdown.

Required input tuple:

- `sourceStableId`
- `sourceSection`
- `targetPath`
- `entryMatch` semantic identity fields
- `mutation` semantic fields
- `creationKey` (when present)

Never hash formatted line strings.

---

## 10. Propagator Registry and Selection

Registration is explicit and deterministic.

1. Registry key: `(lang, unit, surface, pos, sectionKind)`.
2. Multiple propagators for the same `sectionKind` are allowed only when source-shape keys differ.
3. If no propagator is registered for a source section, behavior is explicit no-op.
4. Execution order is deterministic by registry order to keep intent logs stable.

---

## 11. Merge Policies

Merge policies are explicit per section operation.

| Section | Operation | Policy | Notes |
|---|---|---|---|
| Relation | `addRelation` | Set-union | Deduplicate by `(relationKind, targetLemma)` semantic key. |
| Morphology | `addBacklink` | Set-union | Deduplicate by backlink target + relation type. |
| Morphology | `addEquation` | Set-union with semantic dedupe | Deduplicate by normalized equation signature. |
| Inflection | `upsertInflection` | Upsert | Match target entry first, then merge tags + normalize header. |
| Tags | `addTags` | Set-union | Deduplicate normalized tag tokens. |

Upsert conflict rules must be deterministic and order-independent.

---

### 11.1 DTO Identity Keys for Set-Union

DTO collections use `ReadonlyArray<T>`, but merge semantics are set-union/upsert by semantic identity keys.

Required dedupe keys:

1. `RelationItemDto`: `(relationKind, targetLemma)`.
2. `MorphologyBacklinkDto`: `(relationType, value)`.
3. `MorphologyEquationDto`: normalized equation signature `(lhsParts[], rhs)`.
4. `TagsSectionDto.tags`: normalized tag token.
5. `InflectionItemDto`: item identity is `form`; nested `tags` dedupe by normalized tag token.

Implementations must not use array position as identity.

---

## 12. Parsing and Serialization

### 12.1 Two-Tier Parsing (v1)

1. Typed DTO parsing for sections used by propagation.
2. Raw passthrough storage for unsupported sections.
3. Typed `MorphologySectionDto` parsing must preserve both `backlinks` and `equations`.

This allows migration without typing every section immediately.

### 12.2 Canonical Serialization

Serializer output is canonical and deterministic:

1. Stable section order by configured weight.
2. Stable line/item ordering where applicable.
3. Normalized whitespace and separators.
4. Stable hashtag and wikilink formatting for typed sections.
5. Raw passthrough sections are byte-preserving when untouched by mutations.
6. Raw passthrough sections are not normalized in Phase 2 (including line endings, whitespace, and blank lines).

Invariant: parse -> serialize -> parse yields equivalent DTO state.
Phase 2 characterization baseline for typed sections is DTO semantic equivalence plus deterministic canonical v2 serializer output, not byte-for-byte parity.

Canonicalization is expected and accepted on first touch for typed sections.

---

## 13. Validation and Error Handling

### 13.1 Validation Rules

Before apply:

1. Reject malformed target paths.
2. Reject targets outside dictionary scope.
3. Reject disallowed self-targets.
4. Reject unknown section operation pairs.
5. Missing target file at a valid resolved dictionary path is not a validation error (it is created on write).

### 13.2 Error Handling

1. Per-target apply failures are logged with intent provenance.
2. Failure policy is fail-fast for command-level correctness in v1.
3. Action emission is all-or-nothing: on any failure, no propagation actions are appended.
4. Generate-level behavior in v1 is strict fail-fast: if propagation fails, the full Generate command returns `Err` and emits zero actions (source note actions and propagation actions are both dropped for that invocation).
5. Errors return `CommandError` through existing neverthrow pipeline.
6. On failure, logging must include: `targetPath`, `intentKey`, and normalized error reason.
7. User-facing error notice must include the failing `targetPath` to make repair actionable.

---

## 14. Logging Rules

Use `src/utils/logger` only.

Recommended log points:

1. Intent collection count by section.
2. Validation rejects with reason and intent key.
3. Group sizes by target note.
4. Apply summary per target: matched/created entries, changed/unchanged.
5. Apply failure detail: `targetPath`, `intentKey`, error kind/message.
6. Final emitted action count.

Do not manually stringify objects.

---

## 15. Suggested Module Layout (v1)

This layout follows existing repository boundaries and keeps pure logic in linguistics/common modules.

```text
src/commanders/textfresser/commands/generate/steps/
  propagate-v2.ts                 # orchestrator: collect/validate/group/apply/emit
  propagate-v2-path-resolution.ts # unresolved target -> targetPath
  propagate-v2-validation.ts      # intent validation
  propagate-v2-grouping.ts        # dedupe + grouping helpers
  propagate-v2-matcher.ts         # centralized entry matching engine
  propagate-v2-apply.ts           # apply intents to parsed note DTO
  propagator-registry.ts          # source-shape + section dispatch

src/commanders/textfresser/domain/
  propagation/
    types.ts                      # target refs, intents, EntryMatchCriteria, mutations
    intent-key.ts                 # deterministic intent key helper
    creation-key.ts               # creation key helpers
    merge-policy.ts               # pure section merge policy table + dispatch

src/linguistics/
  ... per-slice pure propagators ...
```

No Obsidian/VAM imports from pure propagator modules.

---

## 16. Migration Plan

Do not attempt one-shot migration.

### 16.1 Phase 0 - Capability Audit (VAM + Ports)

Do this before implementing propagation v2 logic.

Status: complete (implemented on February 18, 2026).

1. Define a minimal propagation IO contract for v2 orchestrator needs (`PropagationVaultPort` + Librarian lookup port).
2. Map each required method to existing VAM/Librarian APIs.
3. Mark each capability as `covered` or `gap`.
4. Implement missing VAM/Librarian methods only for confirmed gaps.
5. Lock Phase 0 output as a short capability matrix in this section or an appendix.

Phase 0 output is tracked in:

- [`propagation-v2-phase0-capability-audit.md`](./propagation-v2-phase0-capability-audit.md)

Recommended contract surface:

1. Read existing note content by split path (or empty when missing).
2. Bulk read resolved target note paths with explicit per-path `Found`/`Missing`/`Error` outcomes (`readManyMdFiles`).
3. Resolve candidate target note paths by basename/policy using both VAM lookups and Librarian leaf-core-name lookup.
4. Emit upsert/process actions for one target note.
5. Expose path-existence checks needed by resolver policy.

### 16.2 Phase 1 - Contracts and Guardrails

1. Add propagation v2 contracts/types.
2. Add lint or boundary checks blocking IO imports in propagator modules.
3. Add unit tests for intent key determinism and merge helpers.

### 16.3 Phase 2 - Adapter Layer

1. Build typed parser/serializer adapters needed by v2 apply.
2. Add characterization tests using this baseline: typed sections assert DTO semantic equivalence + deterministic canonical v2 serializer output; raw passthrough asserts byte-preserving output.
3. Keep Wikilink adapter scope minimal for v2 migration: support basic `WikilinkDto { target, displayText? }` only where required by parser/serializer boundaries.
4. Exotic wikilinks (anchors, embeds, alias suffix decorations) are passthrough in Phase 2; when target extraction is unparseable for intent-building, log warning and skip that specific intent (not a hard run error).
5. Explicitly defer suffix-decoration parsing/typing to Post-v1 Book of Work (TBD), unless a concrete Phase 2 blocker is discovered.
6. Canonicalize typed Morphology backlink output (normalize surrounding whitespace in wikilink values) so semantically equal backlinks serialize identically.
7. Defer semantic inflection diffing work by default; keep current Phase 1 diffing unless concrete readability/performance issues are observed.

### 16.4 Phase 3 - Orchestrator Skeleton

1. Introduce `propagate-v2` step behind one global feature flag: `propagationV2Enabled`.
2. Keep v1/v2 routing inside a propagation wrapper/facade (Generate entrypoint calls one propagation interface).
3. Keep v2 strict fail-fast semantics (`Err` short-circuits Generate and no actions are emitted/dispatched).
4. Wire validation, dedupe, grouping, apply, emit flow incrementally behind this flag.

### 16.5 Phase 4 - First Vertical Slice

1. Migrate one slice first (`de/lexem/noun` inflection and relation-adjacent behavior).
2. Verify parity and idempotency against current flow.

### 16.6 Phase 5 - Incremental Rollout

1. Migrate remaining section propagators one by one.
2. Keep tests green per slice.
3. Remove legacy propagation once v2 fully covers active behavior.

### 16.7 Coexistence Rule During Migration

Do not mix v1 and v2 propagation writes within a single Generate invocation.

1. Phase 3 routing is global by `propagationV2Enabled` (single engine per invocation).
2. Phase 4+ migrates to per-slice routing once first vertical slices are production-ready.
3. If a slice is not migrated in the per-slice phase, run full v1 for that invocation.

---

## 17. Test Strategy

### 17.1 Unit Tests (pure)

1. `resolveTargets` and `buildIntents` per propagator.
2. Intent key determinism and dedupe.
3. Merge policy behavior for each operation.
4. Matching precedence and fallback behavior.

### 17.2 Integration Tests (step-level)

1. End-to-end propagation over in-memory note strings.
2. One write action per target note invariant.
3. Validation rejections for malformed/out-of-scope targets.

### 17.3 Regression/Property Tests

1. Idempotency: second run produces no changes.
2. Canonical serialization stability.

---

## 18. Performance Expectations

1. Grouping by target note bounds writes to O(number of touched targets).
2. One parse/serialize cycle per touched target note.
3. Intent collection remains linear in number of source sections and extracted references.

---

## 19. Post-v1 Book of Work

Post-migration deferred work is tracked in:

- [`post-migration-book-of-work.md`](./post-migration-book-of-work.md)

---

## 20. Implementation Checklist

1. Add `propagation-v2` contracts.
2. Implement `intentKey` helper and tests.
3. Implement centralized matcher and tests.
4. Implement merge policy dispatcher and tests.
5. Implement orchestrator behind flag.
6. Migrate noun slice and add idempotency test.
7. Roll out remaining slices.
8. Remove legacy step.
