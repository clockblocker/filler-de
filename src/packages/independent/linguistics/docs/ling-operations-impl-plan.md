# Implementation Plan: Ling Operations Internals

## Status

Proposed

## Summary

Add a new operation layer for converting between `Lemma`, `Surface`, and
`Selection` without changing the existing entity model.

Keep the operation API universal and thin. Push only genuinely linguistic logic
into language packs:

- synthetic lemma-surface normalization
- synthetic selection spelling defaults
- default inflection feature policies
- future morphology-specific realization rules

The initial implementation should cover only structural conversions that are
already well-defined by the current data model:

- `extract.surface.fromSelection`
- `extract.lemma.fromSurface`
- `convert.surface.toStandardFullSelection`
- `convert.lemma.toResolvedLemmaSurface`
- `convert.lemma.toStandardFullSelection`

Default-inflection synthesis should be designed for now, but implemented as a
separate later step.

## Context

The root API already exposes schemas and entity types and contains a stub for a
future `lingOperation` object in `src/index.ts`.

The current model already gives us enough information for structural conversion:

- `Selection` contains a `surface`
- `Surface` contains `language`, `discriminators`, `surfaceKind`,
  `normalizedFullSurface`, and `target`
- a resolved surface is just a surface whose `target` is a hydrated lemma

The model also has an important limitation:

- `Surface` does not preserve original orthographic spelling
- `Surface` only stores `normalizedFullSurface`

Because of that, converting `Surface -> Selection` cannot be a true roundtrip.
It must construct a synthetic selection.

## Goals

- Introduce a small, typed operation API over existing entities.
- Keep universal logic centralized.
- Keep language-specific logic isolated behind a narrow hook interface.
- Preserve current schema-first architecture.
- Make the public API ergonomic for both generic and language-bound use.

## Non-Goals

- Changing entity shapes.
- Adding full morphological generation in this change.
- Making `Surface -> Selection` recover original user spelling.
- Reworking the existing schema registries.
- Implementing every possible future conversion immediately.

## Proposed Public API

```ts
export const lingOperation = {
  forLanguage,
  convert: {
    surface: {
      toStandardFullSelection,
    },
    lemma: {
      toResolvedLemmaSurface,
      toStandardFullSelection,
    },
  },
  extract: {
    lemma: {
      fromSurface,
    },
    surface: {
      fromSelection,
    },
  },
} as const;
```

Notes:

- Prefer `lingOperation`, matching `lingSchemaFor` and `LingId`.
- Prefer `toResolvedLemmaSurface` over `toResolvedSurfaceOfLemma`.
- Expose both top-level generic functions and `forLanguage(language)` bound
  helpers.
- Bound helpers should throw on language mismatch, mirroring
  `LingId.forLanguage(...)`.
- Do not expose a public `lingOperation.English/...` style namespace for now.

## Ownership Split

### Universal

Universal code should own:

- top-level public API shape
- generic implementation of structural conversions
- narrowing and nullability rules
- registry dispatch by `value.language`
- common validation helpers
- common option handling and defaults
- language-bound adapter construction via `forLanguage(language)`

### Language packs

Language packs should own only the logic that cannot be inferred structurally:

- `normalizeLemmaSurface(lemma) -> normalizedFullSurface`
- `defaultSpelledSelectionFromSurface(surface) -> string`
- `getDefaultInflectionFeatures(lemma) -> partial inflection feature object`
- future morphology-aware synthetic inflection realization

If a hook is not provided, universal code should fall back to deterministic
defaults.

## Language Operation Pack Shape

Add one internal pack per language:

```ts
type LanguageOperationPack<L extends TargetLanguage> = {
  normalizeLemmaSurface: <LK extends LemmaKindFor<L>, D extends LemmaDiscriminatorFor<L, LK>>(
    lemma: Lemma<L, LK, D>,
  ) => string;
  defaultSpelledSelectionFromSurface?: <OS extends SurfaceOrthographicStatusFor<L>, SK extends SurfaceSurfaceKindFor<L, OS>, LK extends SurfaceLemmaKindFor<L, OS, SK>, D extends SurfaceDiscriminatorFor<L, OS, SK, LK>>(
    surface: Surface<L, OS, SK, LK, D>,
  ) => string;
  getDefaultInflectionFeatures?: <LK extends LemmaKindFor<L>, D extends LemmaDiscriminatorFor<L, LK>>(
    lemma: Lemma<L, LK, D>,
  ) => Record<string, unknown>;
};
```

Back it with an internal registry:

```ts
const operationPackByLanguage = {
  English: englishOperationPack,
  German: germanOperationPack,
  Hebrew: hebrewOperationPack,
} satisfies {
  [L in TargetLanguage]: LanguageOperationPack<L>;
};
```

## Conversion Semantics

### `extract.surface.fromSelection`

Behavior:

- if `selection.orthographicStatus === "Unknown"`, return `null`
- otherwise return `selection.surface`

This is purely universal.

### `extract.lemma.fromSurface`

Behavior:

- if `surface.target` is hydrated, return it
- otherwise return `null`

This is purely universal.

### `convert.lemma.toResolvedLemmaSurface`

Behavior:

- create a `surfaceKind: "Lemma"` surface
- copy `language` from lemma
- derive `discriminators` from the lemma identity fields
- set `target` to the hydrated lemma
- set `normalizedFullSurface` using the language pack hook

This is partly universal and partly language-pack-driven.

### `convert.surface.toStandardFullSelection`

Behavior:

- return a synthetic `Selection`
- `language` comes from `surface.language`
- `orthographicStatus` is always `"Standard"`
- `selectionCoverage` is always `"Full"`
- `surface` is reused as-is
- `spelledSelection` comes from:
  1. explicit option, else
  2. language hook, else
  3. `surface.normalizedFullSurface`

This is universal with an optional language hook.

### `convert.lemma.toStandardFullSelection`

Behavior:

- compose `toResolvedLemmaSurface`
- then compose `surface.toStandardFullSelection`

Do not duplicate logic.

## Planned Later Conversion

### `convert.lemma.toResolvedDefaultInflectionSurface`

This should not be folded into `toResolvedLemmaSurface`.

Reason:

- lemma-surface synthesis is structural and always available
- default-inflection synthesis is a language policy
- some languages/POS combinations may not have a meaningful default inflection

The later API should likely be:

```ts
lingOperation.convert.lemma.toResolvedDefaultInflectionSurface(...)
lingOperation.convert.lemma.toStandardFullDefaultInflectionSelection(...)
```

Both should return `null` when no default inflection policy exists.

## Overload Strategy

Use overloads only for return-type precision.

Recommended signatures:

```ts
fromSelection<L extends TargetLanguage>(
  selection: Selection<L, "Unknown">,
): null;

fromSelection<
  L extends TargetLanguage,
  OS extends Exclude<SelectionOrthographicStatusFor<L>, "Unknown">,
  SK extends SelectionSurfaceKindArg<L, OS>,
  LK extends SelectionLemmaKindArg<L, OS, SK>,
  D extends SelectionDiscriminatorArg<L, OS, SK, LK>,
>(
  selection: Selection<L, OS, SK, LK, D>,
): Surface<L, OS, SK, LK, D>;
```

```ts
fromSurface<
  L extends TargetLanguage,
  OS extends SurfaceOrthographicStatusFor<L>,
  SK extends SurfaceSurfaceKindFor<L, OS>,
  LK extends SurfaceLemmaKindFor<L, OS, SK>,
  D extends SurfaceDiscriminatorFor<L, OS, SK, LK>,
>(
  surface: ResolvedSurface<L, OS, SK, LK, D>,
): Lemma<L, LK, D>;

fromSurface<
  L extends TargetLanguage,
  OS extends SurfaceOrthographicStatusFor<L>,
  SK extends SurfaceSurfaceKindFor<L, OS>,
  LK extends SurfaceLemmaKindFor<L, OS, SK>,
  D extends SurfaceDiscriminatorFor<L, OS, SK, LK>,
>(
  surface: UnresolvedSurface<L, OS, SK, LK, D>,
): null;

fromSurface<
  L extends TargetLanguage,
  OS extends SurfaceOrthographicStatusFor<L>,
  SK extends SurfaceSurfaceKindFor<L, OS>,
  LK extends SurfaceLemmaKindFor<L, OS, SK>,
  D extends SurfaceDiscriminatorFor<L, OS, SK, LK>,
>(
  surface: Surface<L, OS, SK, LK, D>,
): Lemma<L, LK, D> | null;
```

Avoid overloads that introduce multiple semantic modes into one function.

These helper types do not need to become part of the public API. The operations
layer can define its own internal utility types instead of re-exporting private
type machinery from `public-entities.ts`.

## Internal Module Layout

Recommended files:

- `src/lu/public-operations.ts`
  Public exports and bound/generic operation builders
- `src/lu/internal/operations/shared.ts`
  Common guards and structural helpers
- `src/lu/internal/operations/operation-pack-registry.ts`
  Language pack registry
- `src/lu/language-packs/english/english-operations.ts`
- `src/lu/language-packs/german/german-operations.ts`
- `src/lu/language-packs/hebrew/hebrew-operations.ts`

Then re-export from `src/index.ts`.

Create the per-language operation-pack files in the first implementation pass
even if all three initially share the same `canonicalLemma` normalization
behavior. The seam is part of the design, not a later refactor.

## Implementation Phases

### Phase 1: universal extraction ops

Implement:

- `extract.surface.fromSelection`
- `extract.lemma.fromSurface`

These require no language hooks and establish the core public API shape.

### Phase 2: lemma-surface synthesis

Implement:

- language operation packs with `normalizeLemmaSurface`
- `convert.lemma.toResolvedLemmaSurface`

Start with a conservative normalization rule:

- default to `lemma.canonicalLemma`

Language packs can later override this if needed.

### Phase 3: synthetic selection wrapping

Implement:

- `convert.surface.toStandardFullSelection`
- `convert.lemma.toStandardFullSelection`

Use an options bag from day one:

```ts
toStandardFullSelection(surface, options?: { spelledSelection?: string })
```

Default `spelledSelection` to `surface.normalizedFullSurface` unless a language
hook or explicit option overrides it.

### Phase 4: tests and guardrails

Add runtime tests and type tests for:

- nullability behavior
- preserved generic narrowing by language/surface kind/discriminator
- `Unknown` selection handling
- resolved vs unresolved surface handling
- correct structural composition for lemma conversion

### Phase 5: later inflection policy

Design and add later:

- `getDefaultInflectionFeatures`
- default inflection synthesis ops

Keep it out of the first implementation to avoid mixing structural and
language-policy concerns.

## Detailed Implementation Notes

### Detecting resolved vs unresolved surface

Use the same conceptual rule already present in resolved surface schema logic:

- resolved target has lemma identity fields such as `lemmaKind`
- unresolved target is only `{ canonicalLemma: string }`

Prefer one shared internal guard rather than repeating object-shape checks in
multiple functions.

### Building discriminators from lemma

Universal code should derive discriminators from lemma kind:

- `Lexeme` -> `lemmaSubKind = lemma.pos`
- `Morpheme` -> `lemmaSubKind = lemma.morphemeKind`
- `Phraseme` -> `lemmaSubKind = lemma.phrasemeKind`

This logic should stay universal because it mirrors the existing schema builders.

### Validation strategy

Operation functions should construct structurally correct objects directly.

Optionally, in tests or internal assertions, validate outputs against existing
schemas:

- `ResolvedSurfaceSchema[lang]...`
- `SelectionSchema[lang]...`

Do not make every operation call pay schema-validation cost unless there is a
clear need for it.

## API Ergonomics

Support both styles:

```ts
lingOperation.extract.surface.fromSelection(selection)
lingOperation.forLanguage("German").extract.surface.fromSelection(selection)
```

Guidelines:

- generic top-level calls are best for values that already carry `language`
- `forLanguage(language)` is best for pipelines that are already language-scoped
- both should share the same underlying implementation
- bound helpers should assert that input values match the bound language and
  throw on mismatch

## Risks

### Risk: synthetic selection looks more authoritative than it is

`Surface -> Selection` creates a synthetic `spelledSelection`.

Mitigation:

- document that it is synthetic
- keep the default deterministic and simple
- avoid pretending it is a reversible roundtrip

### Risk: inflection defaults get forced too early

If default inflection generation is included in the first pass, the API will
likely encode weak assumptions that are hard to unwind.

Mitigation:

- keep lemma-surface synthesis separate from default-inflection synthesis

### Risk: overload complexity hurts readability

Too many public overloads could make the API harder to understand than the
runtime behavior.

Mitigation:

- use overloads only for nullability/narrowing
- keep operation names explicit

## Testing

Add focused tests for:

- `fromSelection` returns `null` for `Unknown`
- `fromSelection` preserves exact `surface` for known selections
- `fromSurface` returns lemma for resolved surfaces
- `fromSurface` returns `null` for unresolved surfaces
- `toResolvedLemmaSurface` produces a valid resolved lemma surface
- `toStandardFullSelection` produces a valid standard full selection
- `lemma.toStandardFullSelection` matches composition of the two lower-level ops
- `forLanguage(language)` preserves language matching rules

Recommended commands:

```bash
bun test tests/external/public-api.test.ts
bun test
bun run typecheck:changed
```

## Acceptance Criteria

- `lingOperation` is exported from the root API.
- The first five structural operations are implemented.
- Language-specific logic is accessed only through internal operation packs.
- No entity shape changes are required.
- Top-level and language-bound APIs both work.
- Tests cover nullability, narrowing, and synthetic-conversion behavior.

## Resolved Decisions

1. `lingOperation.forLanguage(language)` should throw on language mismatch.
   This keeps the bound API honest and catches invalid mixed-language pipelines
   early.
2. The operations layer should keep its own internal helper types rather than
   expanding the public type surface with new exports from `public-entities.ts`.
3. `convert.surface.toStandardFullSelection` should accept an options bag from
   day one, starting with `{ spelledSelection?: string }`.
4. Per-language operation-pack files should exist from the first pass even if
   their initial implementations are nearly identical.
5. Synthetic selections should not be marked as synthetic in this pass because
   that would require entity-shape changes.
6. Initial lemma-surface normalization should default to
   `lemma.canonicalLemma` for all current languages unless a concrete need
   appears during implementation.

## Open Questions

1. When default inflection synthesis arrives, should unsupported POS return
   `null` or a result object with a reason?
