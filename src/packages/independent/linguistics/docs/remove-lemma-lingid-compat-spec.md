# Spec: Remove Legacy Lemma LingId DTO Compatibility

This is a Stage 1 subset of
`docs/language-carried-entities-simplification-spec.md`.

## Status

Proposed

## Summary

Remove `withLingIdLemmaDtoCompatibility` and stop treating legacy lemma DTOs with
`lingKind: "Lemma"` as supported input.

Keep the cross-field validation in selection surface schemas that ensures hydrated
lemma targets remain consistent with their containing surface.

Use this cleanup as the first step toward simplifying factory APIs and public type
inference now that `language` lives on the entities themselves.

## Context

The current codebase has two different mechanisms on the lemma/surface schema path:

1. `withLingIdLemmaDtoCompatibility`
   File: `src/lu/universal/ling-id-schema-compat.ts`
   Purpose: preprocess a lemma-like input and strip `lingKind` before validating.

2. `superRefine` in `buildSelectionSurfaceSchema`
   File: `src/lu/universal/factories/buildSelectionSurface.ts`
   Purpose: enforce consistency between a hydrated target lemma and the surface that
   contains it.

These mechanisms are not equivalent:

- `withLingIdLemmaDtoCompatibility` is a legacy-input shim.
- `superRefine` enforces real domain invariants.

Repo inspection shows no remaining in-repo producers of lemma DTOs carrying
`lingKind: "Lemma"`. The current LingId parser constructs plain lemma entities.

## Problem

`withLingIdLemmaDtoCompatibility` appears to preserve compatibility for an input
shape that is no longer produced by the current system.

Keeping it has downsides:

- It obscures the true accepted lemma shape.
- It adds schema wrapping and type casts without protecting core correctness.
- It makes downstream simplification harder because schema metadata gets hidden
  behind preprocess effects.

By contrast, the `superRefine` checks in `buildSelectionSurfaceSchema` still guard
against invalid hydrated targets and must remain unless replaced by an equivalent
mechanism.

## Goals

- Remove support for legacy lemma DTOs with `lingKind: "Lemma"`.
- Preserve all current public entity shapes and caller ergonomics.
- Preserve validation of hydrated target lemma consistency.
- Reduce schema indirection so later factory/type simplifications are easier.

## Non-Goals

- Removing `withLingIdSurfaceDtoCompatibility` in the same change.
- Rewriting the entire public type layer in this change.
- Changing serialized LingId wire format.
- Broad API redesign beyond compatibility removal and immediate cleanup.

## Proposed Changes

### 1. Remove lemma DTO compatibility wrapper

Delete `withLingIdLemmaDtoCompatibility` from
`src/lu/universal/ling-id-schema-compat.ts`.

Update all lemma schema builders to use their plain `z.object(...)` schemas
directly.

Affected areas include:

- English lexeme/morpheme/phraseme bundle builders
- German lexeme/morpheme/phraseme bundle builders
- Hebrew lexeme/morpheme/phraseme bundle builders
- Direct lemma schema definitions such as `german-noun.ts` and `german-verb.ts`

### 2. Keep surface compatibility and cross-field validation separate

Retain:

- `withLingIdSurfaceDtoCompatibility`
- `superRefine` in `buildSelectionSurfaceSchema`

Rationale:

- Surface compatibility still has an active integration point in
  `public-entities.ts`, where surface schemas are derived from selection schemas and
  wrapped for LingId DTO compatibility.
- `superRefine` enforces invariants that plain nested schema composition does not
  express:
  - hydrated lemma language matches surface language
  - hydrated lemma kind matches surface discriminators
  - hydrated lemma subkind matches surface discriminators

### 3. Make unsupported legacy behavior explicit

Add or update tests to state clearly that top-level lemma compatibility with
`lingKind: "Lemma"` is no longer supported.

This should mirror the existing guardrail style used for removed legacy surface
formats.

### 4. Treat this as an enabling cleanup for later simplification

After the compatibility wrapper is removed, a follow-up refactor can simplify the
factory stack by deriving language from lemma schemas rather than threading it
through every factory call.

That follow-up is out of scope for this change, but this proposal is meant to make
it easier.

## Detailed Design

### Before

Lemma schemas are commonly defined as:

1. create a strict/object lemma schema
2. wrap it with `withLingIdLemmaDtoCompatibility`
3. pass the wrapped schema into selection/surface builders

This means selection builders frequently receive effect-wrapped schemas that are
typed as if they were still plain schemas.

### After

Lemma schemas are plain schemas again:

1. create the lemma schema
2. export/use it directly
3. pass it unchanged into selection/surface builders

The removal should not alter accepted canonical entity shapes. It only removes the
legacy preprocessing path.

## Behavior Changes

### Accepted before

A lemma-like input such as:

```ts
{
  lingKind: "Lemma",
  language: "German",
  lemmaKind: "Lexeme",
  pos: "NOUN",
  canonicalLemma: "Haus",
  meaningInEmojis: "🏠",
  inherentFeatures: {},
}
```

could be preprocessed into a plain lemma object before validation.

### Accepted after

Only the plain lemma entity shape is accepted:

```ts
{
  language: "German",
  lemmaKind: "Lexeme",
  pos: "NOUN",
  canonicalLemma: "Haus",
  meaningInEmojis: "🏠",
  inherentFeatures: {},
}
```

### Unchanged

Selection and surface schemas must continue to reject hydrated target mismatches,
for example:

- German surface with English hydrated target
- surface discriminators saying `Lexeme/NOUN` while target is `Phraseme/Cliché`
- surface discriminators saying `Lexeme/NOUN` while target is `Lexeme/VERB`

## Risks

### External consumer breakage

If any external caller still submits legacy lemma DTO objects with `lingKind`, they
will start failing validation.

Mitigation:

- document the removal in the changelog/release notes
- add a focused regression test that demonstrates the new rejection behavior

### Hidden compatibility dependence

Because preprocess wrappers are permissive, some tests may not currently exercise
the legacy path directly.

Mitigation:

- add an explicit failing test for legacy lemma DTOs
- run the external public API and LingId suites after removal

## Migration

For consumers still passing legacy lemma DTOs:

1. stop including `lingKind`
2. pass the plain lemma entity shape directly

No wire-format migration is required because current LingId serialization/parsing
already uses plain lemma entities.

## Testing

Required test coverage:

- Existing public API tests still pass.
- Existing LingId parsing/serialization tests still pass.
- Existing internal schema mismatch tests still pass.
- New guardrail test proves lemma schemas reject legacy `lingKind`-decorated input.

Recommended commands:

```bash
bun test tests/external/public-api.test.ts
bun test tests/external/ling-id/ling-id-parsing.test.ts
bun test tests/external/ling-id/ling-id-serialization.test.ts
bun test tests/internal/german-noun.test.ts
```

Before finishing implementation work:

```bash
bun run typecheck:changed
```

## Acceptance Criteria

- `withLingIdLemmaDtoCompatibility` is removed from the codebase.
- No lemma schema builder imports or uses it.
- All supported lemma entities validate without preprocessing.
- Hydrated target mismatch validation remains intact.
- Legacy lemma DTO inputs with `lingKind: "Lemma"` are rejected.
- Public API types and runtime schema behavior for non-legacy inputs remain
  unchanged.

## Follow-Up Work

If this lands cleanly, next candidates are:

1. derive factory language from lemma schema literals instead of passing
   `language` through builder APIs
2. collapse `buildLemmaSelection` and `buildInflectionSelection` onto one internal
   core
3. simplify `public-entities.ts` by deriving exported generics from unions of
   inferred schemas rather than deep registry indexing
