# Lexical Generation Module Plan

## Goal

Extract Textfresser's LLM-backed lexical generation into a self-contained library-style module with a narrow public API and no Obsidian-specific runtime dependencies.

This module should own:

- lemma generation
- sense disambiguation against existing candidate senses
- lexical info generation
- prompt routing and prompt-smith usage
- result/error contracts for generation work

This module should not own:

- markdown section rendering
- propagation
- dict-entry serialization
- note path computation
- wikilink rewriting
- VAM or other Obsidian-facing file operations

## Agreed Decisions

- `prompt-smith` becomes an internal submodule/dependency of the new lexical generation module.
- `selection` is the raw user-selected span.
- `attestation` is a plain string containing the whole sentence/context used for lexical inference.
- Lemma generation returns a structured DTO, not a bare string.
- Sense matching is a third function, separate from both lemma generation and lexical info generation.
- Language pair and generation settings are bound on module creation. Reconfigure by rebuilding the module.
- `LexicalInfo` includes the resolved lemma DTO as one of its fields.
- `LexicalInfo` is a discriminated per-unit DTO family with closely aligned top-level shape.
- Generation APIs should not throw for ordinary model/runtime failures. Return `Result` with explicit failure kinds.
- The first setting to wire through is `generateInflections: boolean`, but the settings shape should be ready for future toggles.
- The only Obsidian-specific concern that should remain outside the module is fetching / persistence orchestration in the caller.

## Target Public API

Canonical shape:

```ts
const lexicalGeneration = createLexicalGenerationModule({
  targetLang,
  knownLang,
  settings,
  fetchStructured,
});

const generateLemma = lexicalGeneration.buildLemmaGenerator();
const disambiguateSense = lexicalGeneration.buildSenseDisambiguator();
const generateLexicalInfo = lexicalGeneration.buildLexicalInfoGenerator();

const lemmaResult = await generateLemma(selection, attestation);
const senseMatch = await disambiguateSense(
  lemmaResult,
  attestation,
  candidateSenses,
);

if (senseMatch.kind === "new") {
  const lexicalInfo = await generateLexicalInfo(lemmaResult, attestation);
}
```

Notes:

- If the old top-level `buildLemmaGenerator(targetLang, knownLang, ...)` naming is still desired, keep that as a thin wrapper over `createLexicalGenerationModule(...)`.
- The module creation boundary is the place where language pair, settings, retries, and transport are configured.

## Draft Contracts

### 1. Module Creation

```ts
type CreateLexicalGenerationModuleParams<TTargetLang> = {
  targetLang: TTargetLang;
  knownLang: KnownLanguage;
  settings: LexicalGenerationSettings<TTargetLang>;
  fetchStructured: StructuredFetchFn;
};
```

`fetchStructured` is the only required external runtime dependency for now. Keep logging, retries, and caching internal unless the implementation later proves they must be injected.

Exact contract:

```ts
type StructuredFetchFn = <T>(params: {
  requestLabel: string;
  systemPrompt: string;
  userInput: string;
  schema: ZodSchemaLike<T>;
  withCache?: boolean;
}) => Promise<Result<T, LexicalGenerationError>>;
```

This is the transport boundary, not a prompt boundary. The lexical generation module owns:

- prompt-smith usage
- prompt selection/routing
- input stringification
- mapping transport/model failures into `LexicalGenerationError`

### 2. Settings

```ts
type LexicalGenerationSettings<TTargetLang> = {
  generateInflections: boolean;
};
```

Keep the type open for more toggles later, but do not pre-build unused complexity in the first pass.

### 3. Lemma Result

Base requirement: preserve today's structured lemma DTO shape, but detach it from Obsidian-only attestation types.

```ts
type ResolvedLemma =
  | {
      linguisticUnit: "Lexem";
      lemma: string;
      posLikeKind: DeLexemPos;
      surfaceKind: SurfaceKind;
      contextWithLinkedParts?: string;
    }
  | {
      linguisticUnit: "Phrasem";
      lemma: string;
      posLikeKind: PhrasemeKind;
      surfaceKind: SurfaceKind;
      contextWithLinkedParts?: string;
    };
```

### 4. Sense Disambiguation

```ts
type CandidateSense =
  | {
      id: string;
      linguisticUnit: "Lexem";
      posLikeKind: DeLexemPos;
      emojiDescription?: string[];
      ipa?: string;
      senseGloss?: string;
    }
  | {
      id: string;
      linguisticUnit: "Phrasem";
      posLikeKind: PhrasemeKind;
      emojiDescription?: string[];
      ipa?: string;
      senseGloss?: string;
    };

type SenseMatchResult =
  | { kind: "matched"; senseId: string }
  | { kind: "new" };
```

This function must not fetch vault state itself. The caller assembles candidate senses and passes them in.

### 5. Lexical Info

Top-level shape should stay close across units, while keeping truthful per-unit discriminations.

```ts
type LexicalInfoField<T> =
  | { status: "ready"; value: T }
  | { status: "disabled" }
  | { status: "not_applicable" }
  | { status: "error"; error: LexicalGenerationError };

type LexicalCore = {
  ipa: string;
  emojiDescription: string[];
};

type LexicalInfo =
  | {
      lemma: Extract<ResolvedLemma, { linguisticUnit: "Lexem" }>;
      core: LexicalInfoField<LexicalCore>;
      features: LexicalInfoField<LexemFeatures>;
      inflections: LexicalInfoField<LexemInflections>;
      morphemicBreakdown: LexicalInfoField<MorphemicBreakdown>;
      relations: LexicalInfoField<LexicalRelations>;
    }
  | {
      lemma: Extract<ResolvedLemma, { linguisticUnit: "Phrasem" }>;
      core: LexicalInfoField<LexicalCore>;
      features: LexicalInfoField<PhrasemFeatures>;
      inflections: LexicalInfoField<never>;
      morphemicBreakdown: LexicalInfoField<MorphemicBreakdown>;
      relations: LexicalInfoField<LexicalRelations>;
    };
```

Notes:

- `core` should contain generated enrichment like `ipa` and `emojiDescription`, not LU/POS/surfaceKind.
- `lemma` remains the source of truth for lexical identity and discriminants.
- `inflections` should be a first-class field, not hidden inside `features`.
- `LexemFeatures`, `PhrasemFeatures`, `LexemInflections`, `MorphemicBreakdown`, and `LexicalRelations` are module-owned public DTOs.
- First pass can keep those DTOs thin and close to today's shapes, but they must not be raw prompt output aliases. Prompt churn should not leak through the public API.
- `generateLexicalInfo(...)` should default to best-effort DTO assembly:
  - return top-level `Err(...)` only for hard-stop failures that prevent any coherent top-level result
  - use field-level `{ status: "error" }` when some sub-generation failed but a valid top-level DTO can still be returned
  - examples of top-level `Err(...)`: unsupported language pair, broken prompt routing, internal contract violation
  - examples of field-level `error`: enrichment/features/inflections/relations/morphemic breakdown prompt failure for an otherwise valid lemma

### 6. Error Contract

Use `Result<T, LexicalGenerationError>` across public generation functions.

Draft failure enum:

```ts
enum LexicalGenerationFailureKind {
  UnsupportedLanguagePair,
  PromptNotAvailable,
  InvalidModelOutput,
  FetchFailed,
  RetryExhausted,
  InternalContractViolation,
}
```

Each error should carry enough context to log/debug without requiring the caller to inspect thrown exceptions.

## Target Module Boundaries

Preferred new top-level area:

```text
src/lexical-generation/
```

Suggested initial layout:

```text
src/lexical-generation/
  index.ts
  create-lexical-generation-module.ts
  public-types.ts
  errors.ts
  settings.ts
  lemma/
  disambiguation/
  lexical-info/
  prompt-smith/
```

Rules:

- No imports from Obsidian managers, VAM, or Textfresser orchestration state.
- `prompt-smith` can be moved under this subtree or wrapped from its current location as an internal dependency during migration.
- Language-specific prompt routing can remain internal and use existing prompt assets until later cleanup.
- Compatibility adapters from `LexicalInfo` DTOs to existing Textfresser section formatters belong on the Textfresser side, not inside the extracted lexical generation module.

## Migration Plan

### Phase 1. Freeze contracts

- Introduce public DTOs and error/result types for the new module.
- Remove Obsidian-specific attestation types from lemma-generation-facing contracts.
- Define the canonical plain-string `attestation` contract and use it consistently.

### Phase 2. Build the module shell

- Create `src/lexical-generation/` with factory, public types, and internal subfolders.
- Add the internal `fetchStructured` abstraction.
- Add minimal unit tests for factory wiring and error passthrough.

### Phase 3. Move lemma generation

- Extract current lemma prompt invocation and guardrail logic from Textfresser orchestration into the new module.
- Keep output shape aligned with today's `DeLemmaResult` contract.
- Do not carry over note-rewrite, placeholder, or VAM logic.

### Phase 4. Move sense disambiguation

- Extract the LLM-based sense matching logic into the new module.
- Replace direct vault lookup assumptions with `candidateSenses` input.
- Keep the return value to `matched` vs `new`; do not entangle it with entry generation.

### Phase 5. Move lexical enrichment generation

- Extract prompt selection and structured output handling for:
  - core enrichment
  - features
  - inflections
  - morphemic breakdown
  - relations
- Return a resolved `LexicalInfo` DTO, not markdown strings.

### Phase 6. Adapt Textfresser callers

- Replace direct prompt-runner usage in Lemma/Generate flows with calls into the new module.
- Keep rendering, propagation, and note updates in Textfresser.
- Add Textfresser-side compatibility adapters from `LexicalInfo` DTOs to existing section formatters as an intermediate migration step.

### Phase 7. Remove old coupling

- Delete or shrink old prompt-runner call sites that now duplicate module behavior.
- Remove obsolete Textfresser-local lemma/disambiguation/generation types where replaced by shared lexical module contracts.
- Update architecture docs once the code path is stable.

## Explicit Non-Goals For First Pass

- No UI/streaming rendering of partially resolved lexical info.
- No attempt to move VAM, rendering, or propagation into the new module.
- No cache redesign unless extraction is blocked without it.
- No Node server packaging in this pass.
- No prompt asset rewrite unless required for boundary cleanup.

## Testing Plan

Minimum required:

- Unit tests for `generateLemma` contract mapping and guardrail behavior.
- Unit tests for `disambiguateSense` with `matched` and `new` cases.
- Unit tests for `generateLexicalInfo` status fields:
  - `ready`
  - `disabled`
  - `not_applicable`
  - `error`
- Unit tests proving no public API throws on ordinary fetch/model failures.
- Regression tests for Textfresser adapters that consume the extracted DTOs.

Follow-up:

- If extraction materially changes command flows, add focused CLI or orchestration tests around Lemma and Generate.

## Acceptance Criteria

- A caller can use the lexical generation module without importing Obsidian-specific types.
- Textfresser orchestration no longer decides which prompt to call for lemma, disambiguation, or lexical info generation.
- Lexical generation returns structured DTOs, not rendered markdown.
- `generateInflections` is wired through settings and reflected in `LexicalInfo`.
- Public generation calls return `Result` values with explicit failure kinds and do not rely on thrown exceptions for ordinary failures.
- Existing Textfresser behavior remains functionally intact after adapting to the new module.

## Open Follow-Ups After Extraction

- Decide whether to expose top-level convenience wrappers in addition to the module factory.
- Decide whether internal retries/caching should stay hidden or become configurable.
- Decide when to physically relocate or rewrite existing `prompt-smith` assets after the initial extraction lands.
