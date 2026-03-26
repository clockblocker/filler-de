# Lexical Generation Module Plan

## Goal

Treat lexical generation as an importable package boundary inside the repo:

- thin public interface
- a small set of exposed types
- its own tests next to the generation code
- no Obsidian-specific runtime concerns in its public contract

`textfresser` should consume generated results and turn them into sections, propagation commands, and note mutations. It should not decide which lexical prompt to call or reconstruct linguistic truth from legacy shapes.

## Current Snapshot

The extraction has started, but the boundary is still mixed:

- `src/lexical-generation/` already exposes `createLexicalGenerationModule`, `ResolvedLemma`, `SenseMatchResult`, and `LexicalInfo`.
- `textfresser` now fails early when lexical generation initialization fails for an unsupported pair.
- `textfresser` no longer falls back from lexical generation into legacy direct prompt orchestration at runtime.
- `textfresser` still translates `LexicalInfo` back into legacy section DTOs in `lexical-info-compat.ts`.
- section applicability and header rendering still depend on compatibility-era shapes rather than a direct `LexicalInfo` render contract.

That means the generator is now the only lexical execution path, but not yet the render contract. It is still being adapted back into the old model.

## Architecture Decisions

- Keep the module where it is for now, but treat `src/lexical-generation/` as if it were an external package.
- The public boundary is a handful of tested functions plus exposed types.
- `LexicalInfo` is produced by lexical generation and is the semantic source of truth.
- `textfresser` calls `generateXxx()` functions in its chain and works from returned DTOs.
- `textfresser` owns rendering policy only.
- `LexicalInfo` carries raw semantic data only. No markdown-ish, wikilink-shaped, or prompt-shaped payloads belong in the public lexical contract.
- lexical generation owns semantic availability via `ready | error | disabled | not_applicable`.
- No runtime fallback from `textfresser` into legacy prompt-by-prompt generation.
- A clean break is allowed. Behavior does not need to preserve legacy quirks when they conflict with the new contract.
- `ResolvedLemma` is the canonical lemma DTO. `textfresser` may wrap it with command-local state, but should not maintain a competing semantic lemma contract.
- Unsupported language pairs fail early and visibly at command entry. Missing lexical generation must not silently route into legacy code.
- Public API should be direct methods (`generateLemma()`, `disambiguateSense()`, `generateLexicalInfo()`), not builder factories without a lifecycle reason.
- `LexicalInfo` is considered sufficient to render generated sections, apart from explicit non-lexical inputs such as translation/context/user-authored content.
- Generator tests should live with the generator code and avoid Obsidian specifics.
- `textfresser` unit tests should mock the generator or use `LexicalInfo` fixtures.
- end-to-end tests should keep covering the full real chain.

Status meanings:

- `ready`: applicable and successfully produced
- `disabled`: intentionally turned off by settings
- `not_applicable`: semantically irrelevant for this lemma/unit
- `error`: applicable, attempted, and failed

## Public Boundary

The boundary should stay small and explicit:

```ts
const lexicalGeneration = createLexicalGenerationModule({
  targetLang,
  knownLang,
  settings,
  fetchStructured,
});

const generateLemma = lexicalGeneration.generateLemma;
const disambiguateSense = lexicalGeneration.disambiguateSense;
const generateLexicalInfo = lexicalGeneration.generateLexicalInfo;
```

Publicly consumed types:

- `ResolvedLemma`
- `CandidateSense`
- `SenseMatchResult`
- `LexicalInfo`
- `LexicalInfoField`
- `LexicalMorpheme`
- `LexicalRelationKind`
- `LexicalGenerationError`
- `LexicalGenerationSettings`

Rules for the boundary:

- No public type may reference Obsidian, VAM, vault readers, note DTOs, or command state.
- No public type may reference `prompt-smith` schema types or other incidental generator internals.
- Public DTOs must be stable against prompt churn.
- Prompt selection, prompt-smith wiring, retries, and structured fetch orchestration stay inside the generator.
- `textfresser` should depend on the public types only, not generator internals.

## Target Ownership Split

Lexical generation owns:

- lemma generation
- sense disambiguation
- lexical info generation
- prompt routing and prompt-smith usage
- public generation DTOs and error contracts
- semantic applicability and per-field statuses

`textfresser` owns:

- section rendering
- propagation
- dict-entry serialization
- note path computation
- wikilink rewriting
- user-authored/context sections
- Obsidian/VAM orchestration

## Target End State

`textfresser` generate flow should look like this:

1. Resolve or create the working target as it already does.
2. Call generator functions for lemma, disambiguation, and lexical info.
3. Pass `LexicalInfo` plus minimal vault/context inputs into rendering code.
4. Render sections and build propagation commands from that data.
5. Apply note mutations.

What must be gone in the end:

- direct lexical prompt dispatch from `textfresser`
- runtime fallback from new generation to old generation
- `LexicalInfo` to legacy prompt-output compatibility adapters
- section logic that re-derives semantic applicability from legacy assumptions

## Refactor Strategy

### Phase 1. Freeze the package-style boundary

- Keep `src/lexical-generation/` as the only lexical generation entrypoint.
- Audit exports and remove anything not meant to be package-public.
- Confirm that the current public contract covers all generation consumers.
- Tighten docs so `LexicalInfo` is explicitly the source of truth.

Exit condition:

- a caller can use lexical generation without importing anything from `textfresser` or Obsidian-facing code

### Phase 2. Make `LexicalInfo` the render contract

- Audit every generated section in `textfresser`.
- For each section, identify whether it is:
  - fully renderable from `LexicalInfo`
  - renderable from `LexicalInfo` plus plain vault/context inputs
  - still depending on prompt output that is not represented in `LexicalInfo`
- If a generated section still needs lexical data that is not in `LexicalInfo`, add that data to the generator contract instead of rebuilding it in `textfresser`.

Exit condition:

- every generated lexical section has a defined input contract rooted in `LexicalInfo`

Section contract matrix to lock before Phase 3:

| Section | Lexical inputs | Non-lexical inputs | Owner | Failure behavior |
| --- | --- | --- | --- | --- |
| Header | `lemma`, `core`, noun `features.genus` or noun `inflections.genus` fallback | target language | lexical data from generator, render policy in `textfresser` | render common header when noun genus is unresolved |
| Tags | `features` | target language | lexical data from generator, render policy in `textfresser` | skip section on `not_applicable` or `error` |
| Attestation | none | attestation ref, target language | `textfresser` | always render |
| Relation | `relations` | target language | lexical data from generator, render policy in `textfresser` | skip section on field `error`, record failure |
| Translation | none | translation output, target language | non-lexical for now | skip section on translation failure, record failure |
| Morphem | `morphemicBreakdown` | target language | lexical data from generator, render policy in `textfresser` | skip section on field `error`, record failure |
| Morphology | `morphemicBreakdown` | optional translation, target language | mixed: lexical data from generator plus render inference in `textfresser` | skip section when morphemes are unavailable |
| Inflection | `inflections` | target language | lexical data from generator, render policy in `textfresser` | skip section on `disabled`, `not_applicable`, or field `error`; record failure only for `error` |

### Phase 3. Cut `textfresser` over to direct DTO consumption

- Change section building so it consumes `LexicalInfo` directly.
- Replace the current unpacking into `enrichmentOutput`, `featuresOutput`, `morphemOutput`, `nounInflectionOutput`, `otherInflectionOutput`, and `relationOutput`.
- Keep any additional non-lexical inputs explicit and easy to consume.
- Stop importing prompt-routing helpers and prompt kinds in `textfresser` for lexical generation work.

Exit condition:

- `generate-new-entry-sections.ts` no longer needs legacy lexical prompt DTOs as its internal working model

### Phase 4. Delete legacy mixed paths

- Remove `lexical-info-compat.ts`.
- Remove now-dead prompt dispatch helpers used only by the old path.
- Remove compatibility-era section applicability/header helpers that still require legacy enrichment-shaped data.

Exit condition:

- `textfresser` has one lexical generation path only

### Phase 5. Separate tests by ownership

- Keep generator tests under generator-owned folders.
- Expand generator tests to cover:
  - factory creation
  - lemma guardrails
  - sense disambiguation
  - lexical info statuses
  - hard-stop vs field-level failure behavior
  - public DTO mapping
- Change `textfresser` unit tests to use mocks or `LexicalInfo` fixtures instead of prompt-output-shaped fixtures.
- Keep or extend e2e tests for the real full chain.

Exit condition:

- generator behavior is tested without Obsidian
- `textfresser` tests no longer assert generator internals

### Phase 6. Shrink the remaining seam

- Remove stale types in `textfresser` that only existed for prompt output compatibility.
- Review `TextfresserState` so it stores lexical generation dependencies without duplicating lexical orchestration logic.
- Update architecture docs once the single path is stable.

Exit condition:

- the lexical boundary is small, explicit, and easy to reason about

## Concrete Code Targets

Primary cut points:

- `src/lexical-generation/public-types.ts`
- `src/lexical-generation/create-lexical-generation-module.ts`
- `src/lexical-generation/lemma/`
- `src/lexical-generation/disambiguation/`
- `src/lexical-generation/lexical-info/`
- `src/commanders/textfresser/commands/generate/steps/generate-new-entry-sections.ts`
- `src/commanders/textfresser/commands/generate/steps/lexical-info-compat.ts`
- `src/commanders/textfresser/state/textfresser-state.ts`

Deletion candidates once the cutover lands:

- the legacy branch in `generate-new-entry-sections.ts`
- `lexical-info-compat.ts`
- prompt-dispatch code that exists only to support the deleted branch

## Testing Plan

Generator-owned tests should live with the generation area and cover package behavior, not Obsidian orchestration.

Required generator test coverage:

- supported and unsupported module creation
- lemma retry and guardrail behavior
- disambiguation `matched` and `new`
- lexical info `ready`
- lexical info `disabled`
- lexical info `not_applicable`
- lexical info field-level `error`
- top-level hard-stop failures
- public DTO mapping for each supported lexical family

`textfresser` unit tests should cover:

- rendering sections from `LexicalInfo`
- propagation decisions from `LexicalInfo`
- minimal extra-context handling

e2e coverage should continue to assert:

- the full lemma to generate to render chain
- real vault mutations
- real plugin behavior under Obsidian

## Acceptance Criteria

- `src/lexical-generation/` is usable as a package-style module with a narrow public API.
- `textfresser` does not decide which lexical prompt to call.
- `LexicalInfo` is the semantic source of truth for generated lexical sections.
- `textfresser` renders from `LexicalInfo` directly instead of legacy compatibility DTOs.
- There is no runtime fallback from generator output back into legacy lexical prompt orchestration.
- Generator tests live with the generator and do not depend on Obsidian.
- `textfresser` unit tests mock the generator or consume `LexicalInfo` fixtures.
- e2e tests still cover the full live chain.

## Remaining High-Level Question

One architecture question still needs an explicit call during implementation:

- If any generated section still needs LLM-produced lexical data that is outside current `LexicalInfo`, that data should move into the lexical generation contract unless we intentionally classify that section as non-lexical.

That question should be resolved section-by-section during Phase 2, not hidden behind a compatibility adapter.
