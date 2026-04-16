# Spec: Simplify Linguistics Schemas and Types Now That Entities Carry Language

## Status

Proposed

## Summary

The linguistics package still carries substantial complexity from an older design
where language had to be threaded externally through factories, schema helpers, and
public type utilities.

Now that `language` is stored directly on lemma, surface, and selection entities,
we can simplify the package in four coordinated stages:

1. remove legacy lemma compatibility wrappers
2. stop threading `language` through the factory chain when it is already encoded
   in the lemma schema
3. collapse duplicate selection builders onto one internal core
4. simplify public exported generic types by deriving them from unions of inferred
   schemas rather than deep registry indexing

The public API should stay intact:

- callers can keep using `Lemma<...>`, `Selection<...>`, `Surface<...>`,
  `ResolvedSurface<...>`, and `UnresolvedSurface<...>`
- narrow concrete types should remain readable
- runtime schema behavior for supported inputs should remain stable

## Motivation

Three areas currently have unnecessary complexity:

### 1. Factory language plumbing

The builder chain passes language repeatedly even though lemma schemas already
encode it as a literal:

- bundle builder defines `language: z.literal("English" | "German" | "Hebrew")`
- the same builder passes `"English" | "German" | "Hebrew"` into
  `buildLemmaSelection`
- that passes it into `buildSelectionSurfaceSchema`
- that passes it into `buildKnownSelectionSchema`

This is duplicate information and creates boilerplate at every call site.

### 2. Public type reconstruction

`src/lu/public-entities.ts` reconstructs allowed combinations by indexing deep into
the registry structure with many helper types. Much of that machinery is now
recovering facts already present in the value shapes themselves:

- `language`
- `orthographicStatus`
- `surfaceKind`
- `lemmaKind`
- lemma subkind field

### 3. Schema metadata distortion

Some wrappers return effect schemas while the type layer continues to pretend the
schemas are still plain object schemas. This forces casts and makes simplification
harder.

## Goals

- Reduce internal schema/type complexity without breaking the public API.
- Remove redundant `language` plumbing from internal builders.
- Preserve narrow inferred literal types for public consumers.
- Keep cross-field surface/lemma invariant checks intact.
- Reduce `as ...` and `as unknown as ...` casts in the factory/schema path.

## Non-Goals

- Changing LingId wire format.
- Changing the shape of public entity objects.
- Removing all compatibility wrappers in one step regardless of active use.
- Reorganizing language-pack file layout.
- Rewriting unrelated feature-schema helpers.

## Current State

### What is still necessary

`superRefine` in `buildSelectionSurfaceSchema` is still semantically necessary. It
enforces invariants not expressed by simple nesting:

- hydrated target lemma language must match surface language
- hydrated target lemma kind must match discriminators
- hydrated target lemma subkind must match discriminators

Without those checks, impossible mixed objects validate successfully.

### What looks legacy

`withLingIdLemmaDtoCompatibility` appears to preserve support for an input shape
with `lingKind: "Lemma"` that is no longer produced by current in-repo LingId
parsing or serialization code.

### What is duplicated

The internal builder stack duplicates language in both:

- runtime arguments
- generic parameters

even though the lemma schema already contains a `language: z.literal(...)` field.

## Proposed Design

## Stage 1: Remove legacy lemma compatibility wrapper

### Change

Remove `withLingIdLemmaDtoCompatibility` and stop accepting lemma objects decorated
with `lingKind: "Lemma"`.

### Rationale

- it is legacy compatibility, not model validation
- it hides schema metadata behind preprocess effects
- it adds casts and makes later factory simplification harder

### Keep

- `withLingIdSurfaceDtoCompatibility`
- `superRefine` in `buildSelectionSurfaceSchema`

These solve different problems and should not be conflated.

### Outcome

Lemma schemas become plain schemas again, which makes downstream type extraction and
schema inspection less fragile.

## Stage 2: Derive builder language from lemma schema

### Change

Stop accepting explicit `language` in:

- `buildSelectionSurfaceSchema`
- `buildKnownSelectionSchema`
- `buildLemmaSelection`
- `buildInflectionSelection`

Instead, derive `LanguageLiteral` from the lemma schema type and, where needed,
carry it via attached metadata.

### Target direction

Conceptually, the builder input should look more like:

```ts
buildLemmaSelection({
  lemmaIdentityShape,
  lemmaSchema,
  surfaceKind: "Lemma",
})
```

instead of:

```ts
buildLemmaSelection({
  language: "German",
  lemmaIdentityShape,
  lemmaSchema,
  surfaceKind: "Lemma",
})
```

### Constraint

This is straightforward at the type level:

```ts
type LanguageOf<Schema extends z.ZodTypeAny> = z.infer<Schema>["language"];
```

The runtime constraint is metadata access. If a schema is wrapped in a Zod effect,
its object `shape` and literal internals are not directly inspectable anymore.

### Implementation options

Preferred option:

- attach explicit metadata to schemas used by the builders, for example:
  - `languageLiteral`
  - `shape`
  - or a package-local schema descriptor object

Acceptable option:

- keep a small builder-only wrapper type that carries:
  - the Zod schema
  - the language literal
  - any object-shape metadata needed downstream

Avoid:

- relying on effect-wrapped schema internals as if they were stable object schemas

### Outcome

Language becomes a derived property instead of explicit builder plumbing.

## Stage 3: Unify duplicate selection builders

### Change

Keep public helpers:

- `buildLemmaSelection`
- `buildInflectionSelection`

But implement them as thin wrappers around one internal selection-schema core.

### Rationale

Today these builders are almost identical. The main difference is surface payload
construction:

- lemma/variant surface: `surfaceKind`
- inflection surface: `surfaceKind` plus `inflectionalFeatures`

Everything else is shared:

- lemma identity
- target union
- language literal handling
- known selection envelope

### Outcome

- less duplicate generic machinery
- fewer duplicate return casts
- simpler maintenance when adding validation or metadata

## Stage 4: Simplify public exported generic types

### Change

Rewrite `public-entities.ts` around unions of inferred schemas plus `Extract`, while
keeping the current generic API intact.

### Target direction

Derive:

- `AllLemma`
- `AllSelection`
- `AllSurface`
- `AllResolvedSurface`
- `AllUnresolvedSurface`

Then expose public generics as filters over those unions.

Conceptually:

```ts
type Lemma<
  L extends TargetLanguage = TargetLanguage,
  LK extends LemmaKind = LemmaKind,
  D extends string = string,
> = Extract<
  AllLemma,
  {
    language: L;
    lemmaKind: LK;
  } & LemmaSubKindConstraint<LK, D>
>;
```

Likewise for:

- `Selection`
- `Surface`
- `ResolvedSurface`
- `UnresolvedSurface`

### Why this is now viable

The value shapes already carry the key discriminators. The type system no longer
needs to reconstruct most constraints from registry topology.

### Requirements

This refactor must preserve:

- narrow `language` literal types
- readable concrete public types
- the current behavior validated in external public API tests

### Expected result

Most of the registry-indexing helpers in `public-entities.ts` should disappear or
become implementation details for schema assembly only, not public type
construction.

## Optional Cleanup

### Shrink `schema-targets.ts`

Keep:

- `featureSchema`
- feature value helpers

Reevaluate:

- `LemmaFor`
- `LemmaSchemaFor`
- `SelectionFor`
- `SelectionSchemaFor`

These abstractions are currently language-agnostic and weaker than the actual
language-carrying entities. They may still be useful for local authoring, but they
should justify their cost.

### Reduce cast pressure

Expected cast reductions after the main refactor:

- `as KnownSelectionSchemaFor`
- `as SelectionSurfaceSchemaFor`
- `as unknown as T`

Some casts will remain around generic object construction, but the current volume
should decrease materially.

## Behavior Changes

### Intentionally changed

- legacy lemma DTOs with `lingKind: "Lemma"` are no longer accepted
- internal builder APIs no longer require explicit `language`

### Intentionally unchanged

- public runtime entity shapes
- LingId wire format
- support for surface compatibility preprocessing, unless separately removed later
- hydrated target mismatch rejection behavior

## Risks

### 1. Public type regressions

Risk:

- exported generic aliases become less readable
- concrete narrowed types widen unexpectedly
- some cases collapse to `any` or lose literal precision

Mitigation:

- keep external public API type assertions as the primary acceptance gate
- add more type-level assertions before deleting old machinery

### 2. Metadata handling complexity

Risk:

- language derivation becomes awkward if schema wrappers still erase shape/literal
  metadata

Mitigation:

- introduce explicit package-local schema metadata instead of poking through Zod
  effect internals

### 3. Hidden external compatibility dependence

Risk:

- downstream callers may still pass lemma DTOs with `lingKind`

Mitigation:

- treat this as an explicit breaking cleanup
- document it in release notes
- add a guardrail test that now rejects it

### 4. Refactor sequencing risk

Risk:

- trying to do all four stages at once will make failure modes hard to isolate

Mitigation:

- land in staged commits or staged PR-sized changes
- keep acceptance tests green after each stage

## Migration Strategy

### Recommended sequence

1. remove `withLingIdLemmaDtoCompatibility`
2. introduce metadata-preserving schema descriptors or schema-attached metadata
3. remove explicit `language` from builder APIs
4. unify selection builders internally
5. rewrite `public-entities.ts` on top of inferred unions and `Extract`
6. reconsider whether `schema-targets.ts` still needs its current exported types

### Rollback strategy

Each stage should be independently reversible:

- Stage 1 rollback: reintroduce lemma preprocess compatibility only
- Stage 2 rollback: restore explicit `language` args while keeping stage 1
- Stage 4 rollback: keep the simplified builders but revert only public type
  derivation

## Testing

Minimum validation after each stage:

```bash
bun test tests/external/public-api.test.ts
bun test tests/external/ling-id/ling-id-parsing.test.ts
bun test tests/external/ling-id/ling-id-serialization.test.ts
bun test tests/internal/german-noun.test.ts
```

Before finishing the full sequence:

```bash
bun run typecheck:changed
```

Recommended additional confidence checks:

- targeted tests for builder return types
- targeted tests for schema metadata helpers if introduced
- a regression test proving legacy lemma DTO input is rejected

## Acceptance Criteria

### Stage 1

- `withLingIdLemmaDtoCompatibility` is removed
- lemma schemas are plain schemas
- legacy lemma DTO input with `lingKind` is rejected

### Stage 2

- internal builder APIs no longer require explicit `language`
- language literals are still preserved in inferred output shapes

### Stage 3

- `buildLemmaSelection` and `buildInflectionSelection` delegate to one internal
  core
- duplicate builder type/cast logic is reduced

### Stage 4

- exported public generic aliases preserve existing ergonomics
- concrete type assertions in external public API tests still pass
- the deep registry-indexing helpers in `public-entities.ts` are materially reduced

## Open Questions

1. Should schema metadata live on the schema object itself or in an adjacent
   descriptor object?
2. Is `withLingIdSurfaceDtoCompatibility` still worth keeping after the type/factory
   cleanup, or should it be reviewed in a later pass?
3. Do language-pack authoring helpers still need `schema-targets.ts` aliases once
   the public type layer is simplified?

## Relationship To Narrower Spec

`docs/remove-lemma-lingid-compat-spec.md` is a valid Stage 1 subset of this
proposal.

If implementation proceeds as a larger effort, this document should be treated as
the parent spec and the narrower lemma-compat doc as an implementation slice.
