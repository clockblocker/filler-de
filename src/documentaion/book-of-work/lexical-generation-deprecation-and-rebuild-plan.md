# Lexical Generation Deprecation And Rebuild Plan

## Summary

Deprecate the current `src/packages/independent/lexical-generation` package by renaming it to `src/packages/independent/deprecated-lexical-generation`, keeping it runnable as frozen legacy code, and build a clean replacement at `src/packages/composed/lexical-generation`.

This is a hard clean break for the new package:
- no compatibility facade inside the new implementation
- no `PromptKind` in the public API
- no legacy schema ownership
- no app-specific note/path/formatting policy inside the new package
- `@textfresser/linguistics` is the only schema and linguistic source of truth

The new package is built first and integrated later. Plugging it into `textfresser` is out of scope for this plan.

## Locked Decisions

- Rename `src/packages/independent/lexical-generation` to `src/packages/independent/deprecated-lexical-generation`.
- Treat the deprecated package as dead wood:
  - keep it buildable and runnable
  - do not evolve it except for path/package maintenance needed by the rename
- Create the new implementation at `src/packages/composed/lexical-generation`.
- The new package is a hard app-facing API break.
- The new package must be reusable and unaware of the outside app world.
- `LexicalInfo`, `LexicalMeta`, and `SenseMatchResult` stay package-owned DTOs.
- `PromptKind` stays internal.
- The new package exposes only a small public runtime API.
- Persisted metadata compatibility is not required.
- The new package speaks native `@textfresser/linguistics` contracts.
- The new package should expose both:
  - high-level aggregated generation
  - low-level per-part generation
- Generic public prompt access disappears from the new package.
- `LexicalMeta` drops public `metaTag: string` ownership in favor of structured identity.
- The public API is a factory returning bound methods, not a bag of standalone functions.
- The rebuild is German-first in runtime scope, but should avoid baking legacy German-only vocabulary into its public shape.
- Zod is internal-only implementation detail at the package boundary.
- Translation is not part of phase 1 core rebuild scope.

## Staging Rule

The new package should not take over the live `@textfresser/lexical-generation` import path until integration time.

Reason:
- the repo currently routes that package name through TS paths, workspace dependencies, and root scripts
- taking over the name early would implicitly start the app cutover
- app cutover is explicitly out of scope for this phase

Recommended staging:
- deprecated package keeps the current live alias during the build-out phase
- new composed package uses a temporary package name during development
- integration later performs one atomic ownership swap

Recommended temporary package name:
- `@textfresser/lexical-generation-next`

Recommended final package-name ownership:
- build-out phase:
  - deprecated package owns `@textfresser/lexical-generation`
  - new package owns `@textfresser/lexical-generation-next`
- integration phase:
  - new package takes `@textfresser/lexical-generation`
  - deprecated package moves to `@textfresser/deprecated-lexical-generation`

Generic prompt-catalog ownership during build-out:
- generic prompt access remains on the deprecated package only
- the rebuilt package does not expose that surface
- during later integration, generic prompt access should either:
  - die with the old integration
  - or move into a separate prompt-assets-oriented package
- generic prompt access should not be reintroduced into the rebuilt lexical runtime package

Script ownership during build-out:
- root scripts stay pointed at the deprecated live package during build-out
- the new package owns only its package-local scripts during build-out by default
- if root-level convenience scripts are added for the new package, they must be explicitly named as `*-next`
- do not silently retarget existing root `codegen:prompts`, `prompt:test`, or `prompt:stability` scripts to the new package before integration

## Target Boundary

`@textfresser/linguistics`
- owns schemas
- owns native types
- owns native discriminators and enums
- is the only linguistic source of truth

new `lexical-generation`
- owns prompt execution orchestration
- owns prompt asset/codegen workflow
- owns generation-specific DTOs returned to callers
- owns selection resolution, disambiguation, and lexical-info generation workflows
- may flatten prompt IO contracts to satisfy generation API limitations

`textfresser`
- owns note-shaping policy
- owns path/id/tag formatting policy
- owns rendering and localization policy
- owns wiring of generation into the app

deprecated `lexical-generation`
- remains runnable
- remains legacy-only
- does not wrap the new package
- does not become a migration adapter

## Internal Design Constraints

The new package must preserve the two splits that are doing real work today.

### Split 1: per POS

Keep per-POS prompt routing.

Reason:
- one earlier step resolves selection and identifies POS / lemma kind
- narrower prompts make the work easier for weaker models
- prompt/schema pairs can stay flatter and simpler per route

Implication:
- prompt routing should remain keyed by native discriminators such as `Pos`, `PhrasemeKind`, `LemmaKind`, and `SurfaceKind`
- avoid legacy lexical vocab as routing keys

### Split 2: per part

Keep per-part prompt routing.

Reason:
- callers need shorter wait time through parallel generation
- callers may opt out of individual parts
- different parts have meaningfully different contracts and failure handling

Implication:
- the package should support internal parallel fan-out
- the package should also expose part-level generators directly

## Public API Shape

Do not expose `PromptKind`.

Do not expose generic prompt-catalog access.

Implication:
- the current public prompt API from legacy `lexical-generation` does not survive the rebuild
- any future generic prompt access, if still needed, belongs outside the new public package boundary
- `textfresser` should not depend on raw prompt-kind dispatch from the rebuilt package

Recommended public surface:
- `createLexicalGenerationClient(...)` returning methods:
  - `resolveSelection(...)`
  - `disambiguateSense(...)`
  - `generateLexicalInfo(...)`
  - `generateCore(...)`
  - `generateFeatures(...)`
  - `generateInflections(...)`
  - `generateMorphemicBreakdown(...)`
  - `generateRelations(...)`

Recommended structure:
- high-level API for ordinary callers
- low-level per-part API for reuse, selective generation, and testing

Recommended factory pattern:
- inject language config once
- inject transport/fetch once
- avoid app-specific globals
- keep package reusable outside `textfresser`

Factory failure boundary:
- `createLexicalGenerationClient(...)` should fail immediately for setup/configuration problems
- setup/configuration problems include:
  - unsupported target/runtime configuration
  - missing required prompt assets
  - invalid route registry/bootstrap state
- runtime methods should handle execution-time failures only

Low-level method input rule:
- `resolveSelection(...)` is the only public method that accepts raw selected text
- low-level per-part generators accept `ResolvedSelection` plus attestation/context
- aggregated `generateLexicalInfo(...)` should also operate on `ResolvedSelection` plus attestation/context
- callers must not be forced through repeated implicit lemma resolution when invoking multiple part generators

## Selection Resolution Contract

The new selection-resolution flow must stop speaking legacy lexical vocabulary at the semantic level.

Locked direction:
- the rebuilt selection prompt contracts use native concepts directly
- no legacy title-case lexical POS or unit names in the semantic contract
- no legacy surface-kind vocabulary in the semantic contract

Required semantic payload for resolved known selections:
- `lemmaKind`
- native discriminator:
  - `pos` for lexemes
  - `phrasemeKind` for phrasemes
  - `morphemeKind` if morphemes enter scope later
- native `surfaceKind`
- spelled surface / spelled lemma payload needed to construct the resulting native selection DTO

Implementation note:
- prompt IO may still be flattened for generation API and Zod reasons
- flat prompt IO does not justify reintroducing legacy semantic vocabulary

## DTO Rules

Keep generator-owned DTOs where the package adds value above raw schema access.

Keep package-owned:
- `LexicalInfo`
- `LexicalMeta`
- `SenseMatchResult`
- generation error/result contracts

Do not leak app policy into those DTOs.

Locked direction:
- `LexicalMeta` should no longer be `{ senseEmojis, metaTag }`
- replace public string tag identity with structured identity DTOs
- do not publish both structured and string identity from the rebuilt package during build-out
- if app storage later still requires a string tag, that serialization belongs outside this package boundary unless a later concrete need proves otherwise

Recommended identity shape:
- `LexicalMeta = { senseEmojis: string[]; identity: LexicalIdentity }`
- where `LexicalIdentity` is a structured canonical note-identity DTO derived from native discriminators

Minimum required `LexicalIdentity` shape:
- `lemmaKind`
- `discriminator`
- `surfaceKind`

Recommended discriminator domain:
- `Pos | PhrasemeKind | MorphemeKind`

Identity rule:
- `LexicalIdentity` contains only the stable canonical fields needed for sense matching and canonical note identity
- it does not contain note path, note id, serialized tag strings, `orthographicStatus`, or `inflectionalFeatures`

Disambiguation rule:
- compatibility filtering for stored senses should operate on `LexicalIdentity`
- string parsing of app-owned serialized tags is outside the rebuilt package boundary
- stored-sense matching operates on lemma-level identities only
- non-lemma inputs such as inflected or variant selections must normalize to canonical lemma identity before stored-sense matching

Compatibility note:
- textfresser tests that assert exact legacy tag strings are expected to break during integration
- string tag compatibility is not a goal

## Prompt System Design

Keep the prompt system split by the two meaningful axes:
- part
- POS or equivalent native discriminator

Do not collapse the system into one giant generic prompt.

Do not make file decomposition itself the source of truth.

Recommended internal source of truth:
- an operation registry keyed by part and, when needed, by POS/discriminator

Recommended operation concept:
- each operation defines:
  - native routing conditions
  - flat input schema
  - flat output schema
  - prompt builder or prompt asset binding
  - examples/tests

Allowed internal decomposition:
- by part
- by POS
- by shared/common helpers

Discouraged decomposition:
- arbitrary micro-fragmentation that exists only as filesystem ceremony

This still allows a prompt-part tree, but only where the parts correspond to stable reusable semantics rather than incidental formatting slices.

## Schema Rules

The generation API has trouble with nested Zod types and discriminated unions. The new package must design around that constraint explicitly.

Rules:
- all code directly interacting with prompt generation uses `zod/v3`
- prompt-facing input/output contracts may be flatter than the internal native schemas
- prompt-facing contracts are adapters around native `@textfresser/linguistics` truth, not alternative truth
- mapping between flat prompt IO and native DTOs belongs inside the new package
- no public API contract should expose Zod schema types, Zod generics, or schema objects
- Zod stays an internal implementation detail of prompt routing, validation, and adapters

Do not revive:
- legacy lexical enums
- `schema-primitives` as a shadow schema layer
- old title-case POS / unit / surface vocabularies as primary contracts

## Aggregate Failure Semantics

`generateLexicalInfo(...)` should preserve partial-generation semantics.

Locked direction:
- aggregate generation returns field-level statuses
- aggregate generation does not hard-fail merely because one or more parts fail
- part opt-out remains representable at the field level

Recommended field model:
- `ready`
- `disabled`
- `not_applicable`
- `error`

Recommended hard-failure boundary:
- total failure is reserved for setup-level failures such as:
  - unsupported language
  - invalid routing
  - missing required prompt asset/configuration
  - transport/bootstrap failure before a meaningful aggregate result can be formed

Recommended part behavior:
- each part generator may fail independently
- aggregate orchestration should merge part outcomes into the returned `LexicalInfo`
- callers should be able to distinguish:
  - disabled by option
  - not applicable by linguistic route
  - failed generation

## Language Scope

The rebuild should be German-first in runtime scope.

Meaning:
- it is acceptable for phase 1 implementation coverage to target the current German workflow first
- it is not acceptable to reintroduce legacy German-only lexical vocabulary as the public conceptual model

Recommended approach:
- keep client configuration language-aware
- use native `@textfresser/linguistics` target-language types where that falls out naturally
- avoid over-designing full multi-language runtime support before the first integration
- allow later widening without forcing another public conceptual rewrite

Phase-1 runtime contract:
- the client may be configured in a language-aware way
- phase 1 implementation is only required to support the German target workflow
- non-German target flows should fail explicitly with unsupported-language errors
- the package should not pretend to support broader runtime coverage than it actually implements
- morpheme selection/routing is not required in phase 1
- phase 1 should treat morpheme-specific routing/generation as unsupported unless later explicitly added

## Translation Scope

Translation is not part of phase 1 of this rebuild.

Reason:
- the core objective is lexical generation rebuild, not generic prompt replacement
- current translation usage is coupled to the legacy public prompt API
- carrying translation into phase 1 would blur the package boundary and slow the core rebuild

Implication:
- remove `translateText(...)` and `translateWord(...)` from the phase 1 public surface
- if translation is needed later, decide then whether it belongs:
  - in this package as a separate capability
  - in `textfresser`
  - or in another package

## Migration Phases

### Phase 1: Freeze And Rename Legacy Package

1. Rename folder:
   - `src/packages/independent/lexical-generation`
   - to `src/packages/independent/deprecated-lexical-generation`
2. Rename package metadata to reflect deprecation.
3. Keep existing tests/scripts runnable under the deprecated package.
4. Repoint repo-local paths/scripts as needed so legacy code still works during the transition.
5. Do not change legacy internals beyond what the rename requires.

### Phase 2: Scaffold New Composed Package

1. Create `src/packages/composed/lexical-generation`.
2. Give it the temporary build-out package name:
   - `@textfresser/lexical-generation-next`
3. Add workspace package metadata, exports, tests, and build scripts.
4. Add TS path wiring for `@textfresser/lexical-generation-next` without disturbing the live `@textfresser/lexical-generation` alias.
5. Keep root scripts and existing app imports pointed at the deprecated live alias during build-out.
6. Establish a narrow public entrypoint and keep internals private.
7. Add package-local build/test/codegen scripts for the new package without claiming ownership of the existing root lexical-generation scripts.

### Phase 3: Define New Contracts

1. Define the public client/factory API.
2. Define generator-owned DTOs:
   - `LexicalInfo`
   - `LexicalMeta`
   - `SenseMatchResult`
   - generation errors
3. Define part-level result contracts.
4. Define selection/disambiguation contracts on top of native `@textfresser/linguistics`.
5. Define opt-in/opt-out generation options for parts.
6. Remove public prompt-kind-based access from the rebuilt package contract.
7. Define structured lexical identity instead of legacy string meta tags.
8. Lock low-level generator inputs to `ResolvedSelection` plus attestation/context.
9. Lock lemma-level identity normalization rules for stored-sense matching.

### Phase 4: Rebuild Prompt Routing

1. Build an internal operation registry keyed by:
   - part
   - native discriminator such as POS
2. Recreate prompt codegen around that registry.
3. Keep per-part and per-POS routing explicit.
4. Keep prompt IO schemas flat enough for the generation API.
5. Keep `PromptKind` or equivalent internal-only.

### Phase 5: Implement Runtime Flows

1. Implement `createLexicalGenerationClient(...)` with eager setup validation.
2. Implement `resolveSelection(...)`.
3. Implement `disambiguateSense(...)`.
4. Implement per-part generators.
5. Implement aggregated `generateLexicalInfo(...)` as orchestration over per-part generators.
6. Execute eligible part generations in parallel.
7. Support caller-level opt-out of individual parts.
8. Normalize non-lemma selections to lemma identity before stored-sense matching.
9. Return explicit unsupported-language errors for non-German target flows.
10. Return explicit unsupported-operation errors for morpheme-specific phase-1 gaps.

### Phase 6: Validate In Isolation

1. Add unit tests for selection resolution.
2. Add unit tests for disambiguation.
3. Add unit tests for each per-part generator.
4. Add unit tests for aggregated lexical-info generation.
5. Add tests for routing by native discriminators.
6. Add tests covering flat prompt IO adapters versus native internal DTOs.
7. Verify the new package without plugging it into `textfresser`.

### Phase 7: Later Integration Patch

Out of scope for this plan, but the intended later cutover is:

1. make the new package own `@textfresser/lexical-generation`
2. move the deprecated package to `@textfresser/deprecated-lexical-generation`
3. rewrite app imports
4. update root scripts and TS paths
5. integrate the new runtime into `textfresser`
6. eventually delete the deprecated package

## Acceptance Criteria For This Plan

The plan is successful when all of the following are true:

- the deprecated package has been renamed and frozen
- the new composed package exists as an isolated workspace package
- the new package does not import legacy lexical-generation internals
- the new package imports linguistic truth only from `@textfresser/linguistics`
- the new package preserves:
  - per-POS routing
  - per-part routing
  - parallel part generation
  - part opt-out
  - flat prompt IO boundaries where needed by the generation API
- the new package exposes both:
  - high-level aggregated generation
  - low-level per-part generation
- root build/test/codegen scripts remain owned by the deprecated package during build-out unless explicitly duplicated as `*-next`
- `PromptKind` is not part of the public API
- generic prompt access is not part of the public API
- public DTOs do not expose `metaTag: string`
- public DTOs do not expose Zod schema types
- `LexicalIdentity` is present as structured identity and includes at least:
  - `lemmaKind`
  - `discriminator`
  - `surfaceKind`
- aggregate lexical generation preserves field-level partial-failure semantics
- aggregate lexical generation reserves total failure for setup/bootstrap/routing failures
- non-German target flows fail explicitly as unsupported
- stored-sense matching uses lemma-level identity normalization
- morpheme-specific routing/generation is either implemented explicitly or fails explicitly as unsupported in phase 1
- no app integration is required yet

## Non-Goals

- plugging the new package into `textfresser`
- preserving old package API compatibility inside the new package
- preserving persisted lexical metadata formats
- keeping legacy linguistic vocab alive as a compatibility layer
- making the deprecated package a wrapper around the new package

## Open Implementation Notes

- The current repo still points the live lexical-generation alias at the old package through TS paths and root scripts. That must remain true until the integration patch.
- Because `composed/` packages may depend on `independent/` packages but not the reverse, the deprecated package cannot safely delegate to the new package.
- The new package should be designed so app integration later is mostly wiring, not another internal redesign.
