# Lexical Generation Workspace Migration Plan

## Goal

Make `lexical-generation` workspace-ready as the only lexical boundary that `textfresser` depends on.

The end state is:

- `textfresser` imports lexical semantics only from `lexical-generation`
- `textfresser` does not import language-specific linguistic contracts for lexical generation work
- `textfresser` does not reconstruct lexical truth from stored metadata
- lexical parsing, lexical tagging, and target-language-specific semantics stay hidden inside `lexical-generation`
- `src/linguistics/` no longer exists as a separate long-term boundary

## Locked Decisions

### Boundary ownership

- `textfresser` should treat `src/packages/lexical-generation/` as if it were an external package
- `textfresser` owns rendering, propagation, note mutations, and Obsidian orchestration
- `lexical-generation` owns lemma generation, sense disambiguation, lexical info generation, and lexical metadata semantics
- a larger internal lexical monolith is acceptable for now if it is hidden from `textfresser`
- `src/linguistics/` is transitional and should be dissolved rather than preserved as a parallel lexical boundary
- target-language-specific logic currently living under `src/linguistics/` should move into `src/packages/lexical-generation/internal/linguistics/`
- only language-independent lexical enums and types should remain available for `textfresser`
- those language-independent lexical primitives should be exported from the new boundary rather than imported from `src/linguistics/*`

### Public contract direction

The intended public API stays small:

- `createLexicalGenerationModule()`
- `generateLemma()`
- `disambiguateSense()`
- `generateLexicalInfo()`

The exact final export list is still to be tightened, but shrinkage should be aggressive.

### `LexicalInfo`

- `LexicalInfo` is sufficient for propagation as-is
- rendering sufficiency is not fully locked and can be revisited later
- `LexicalInfo` remains the generator-produced semantic DTO that `textfresser` consumes

### Persisted lexical bridge metadata

The persisted generator-owned bridge shape is:

```ts
type LexicalMeta<TTargetLang> = {
  metaTag: string;
  emojiDescription: string[];
};
```

Rules:

- `textfresser` stores `LexicalMeta` and passes it back unchanged
- `textfresser` must not parse `metaTag`
- `textfresser` must not branch on `metaTag`
- `textfresser` must not construct `metaTag`
- `LexicalMeta` is stored on every entry variant, not only lemma entries

### `metaTag`

- `metaTag` is a generator-owned transport/storage token
- `metaTag` is not a rich public grammar DTO
- `metaTag` must be derivable from `ResolvedLemma` alone
- `metaTag` therefore may encode only information already present in `ResolvedLemma`
- `surfaceKind` stays baked into `metaTag`
- the exact string format is still open
- `metaTag` stability as a persisted contract is accepted

### Sense identity

- `metaTag + emojiDescription` is the unique key for an entry
- `emojiDescription` is generated if and only if the generator decides that none of the stored `LexicalMeta` candidates describe the selected lemma in the attestation accurately enough
- once emitted for an entry, `emojiDescription` is persisted and reused
- existing sense entries do not get a regenerated `emojiDescription`

### Disambiguation

The intended mental model is:

`disambiguation = f(context, lemma, cache = LexicalMeta[])`

Rules:

- `textfresser` passes stored `LexicalMeta[]` to the generator
- generator parses `metaTag` back into structural meaning internally
- generator filters out non-lemma candidates internally
- generator narrows to the relevant LU and POS-like class internally
- generator chooses among candidate `emojiDescription` values internally
- target-language-specific parsing and coupling are acceptable inside `lexical-generation` as long as they stay hidden behind the boundary

### Parse failure fallback

If stored lexical metadata cannot be parsed:

1. try to parse existing entries
2. if parsing fails, create a new entry

This permissive fallback is accepted for now.

### Inspectability tradeoff

Opaque persisted metadata may reduce debugging inspectability.

That tradeoff is accepted because stronger boundaries between `textfresser` and lexical semantics are considered more valuable.

## Non-Goals

This plan does not yet lock:

- the exact final `SenseMatchResult` shape
- the exact final public type list
- whether `LexicalInfo` becomes generic over `TargetLang`
- the final rendering contract for every section
- whether `metaTag` parsing is public or internal-only

## Migration Plan

### Phase 1. Lock the generator-owned bridge in code

- add `LexicalMeta` to `lexical-generation`
- add a generator-owned helper that derives `LexicalMeta` or at least `metaTag` from `ResolvedLemma`
- document and then tighten the intended public exports of `src/packages/lexical-generation/index.ts`

Exit condition:

- stored lexical bridge metadata is generator-owned and no longer conceptually belongs to `linguistics/*` or `textfresser`

### Phase 2. Move disambiguation to stored generator metadata

- change disambiguation inputs so `textfresser` passes stored `LexicalMeta[]`
- remove the need for `textfresser` to assemble linguistics-rich candidate DTOs
- move non-lemma filtering and LU/POS-like narrowing fully into the generator

Exit condition:

- disambiguation consumes stored generator metadata directly

### Phase 3. Replace persisted lexical note metadata

- stop writing `DeEntity` and `GermanLinguisticUnit` for lexical-generation concerns
- persist generator-owned lexical metadata instead
- keep only non-lexical app metadata in `textfresser` where still needed

Exit condition:

- lexical persisted metadata no longer depends on `linguistics/de`

### Phase 4. Remove lexical truth reconstruction from `textfresser`

- delete or rewrite code that rebuilds language-specific lexical metadata from `LexicalInfo`
- remove metadata builders whose job is to convert generator DTOs into old linguistic contracts

Exit condition:

- `textfresser` no longer reconstructs lexical semantics from generator output

### Phase 5. Cut propagation and generation flows to generator-native DTOs

- replace lexical-generation-related `linguistics/*` imports in propagation and generation flows with generator public types
- keep filesystem and app policy in `textfresser`
- keep lexical semantics in `lexical-generation`

Exit condition:

- propagation and generation flows depend on generator-native DTOs for lexical concerns

### Phase 6. Shrink `textfresser` lexical imports aggressively

- audit every `linguistics/*` import in lexical generation paths
- remove lexical-generation-related imports first
- classify remaining imports into:
  - true app policy
  - still-unwanted lexical leakage
- move all target-language-specific `src/linguistics/*` code behind the `lexical-generation` boundary
- leave only language-independent lexical primitives available to `textfresser`

Exit condition:

- lexical-generation-related linguistic imports are gone from `textfresser`
- `src/linguistics/` is no longer acting as a separately consumed boundary for lexical features

### Phase 7. Tighten the generator public surface

- remove public exports that are too granular or unnecessary for the workspace boundary
- stop downstream code from importing generator internals or oversized public type dumps

Exit condition:

- `src/packages/lexical-generation/index.ts` exposes a small workspace-ready surface

### Phase 8. Rewrite tests by ownership

- generator tests cover:
  - module creation
  - `ResolvedLemma -> LexicalMeta`
  - disambiguation over stored `LexicalMeta[]`
  - `LexicalInfo`
  - field status behavior
- `textfresser` tests use generator fixtures and stop asserting language-specific lexical internals

Exit condition:

- generator behavior is tested without Obsidian concerns
- `textfresser` tests no longer know German lexical metadata internals

### Phase 9. Delete dead compatibility code

- remove old metadata builders
- remove prompt-dispatch leftovers used only by deleted paths
- remove stale docs and assumptions that still describe `textfresser` as a lexical-semantics owner

Exit condition:

- the old mixed boundary is fully gone

## Highest-Risk Cut

The highest-risk migration step is replacing persisted note metadata.

Once `DeEntity` and `GermanLinguisticUnit` stop being written for lexical-generation concerns, any code that still quietly depends on parsed legacy note metadata will break.

That dependency audit should happen before or during Phase 3.

## Success Criteria

The migration is done when:

- `textfresser` depends on `lexical-generation` for lexical semantics
- `textfresser` stores lexical metadata without understanding it
- stored lexical bridge metadata is generator-owned
- propagation depends on `LexicalInfo`
- disambiguation consumes stored `LexicalMeta[]`
- lexical-generation-related `linguistics/*` imports are gone from `textfresser`
- the generator public surface is small enough to treat as a workspace boundary
- target-language-specific code from `src/linguistics/` has been moved under `src/packages/lexical-generation/internal/linguistics/`
- only language-independent lexical primitives remain public to `textfresser`
