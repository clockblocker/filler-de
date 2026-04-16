# Implementation Plan: `src/ling-id/public.ts`

## Status

Proposed

## Summary

Implement `src/ling-id/public.ts` as the new public home of the Ling ID API,
with the same external ergonomics as the current `src/old-ling-id/public.ts`:

- `LingId.forLanguage(language)`
- `buildToLingConverters(language)`
- namespace-style public types on `LingId`

Unlike `lu/public-operations.ts`, the Ling ID layer should stay almost entirely
universal. For the current ID format, language packs should not own parsing or
serialization logic. The wire format is structural and derived from the entity
model; the only language-specific datum in the wire format is the language code
in the header, which belongs in a tiny universal registry, not in per-language
packs.

## Goals

- Move the Ling ID implementation out of `src/old-ling-id/`.
- Keep the current public API shape stable.
- Centralize universal codec mechanics under `src/ling-id/internal/`.
- Avoid introducing language packs unless a real wire-format divergence appears.
- Reduce duplication with `lu/public-operations.ts` where normalization and
  resolved lemma-surface construction are already defined.

## Non-Goals

- Changing the Ling ID wire format.
- Rebranding IDs from `string` to opaque/branded strings in this step.
- Adding new Ling ID kinds.
- Making Ling ID parsing schema-driven.
- Introducing per-language customization without a concrete need.

## Proposed Public API

`src/ling-id/public.ts` should export the same curated surface as the legacy
module.

```ts
export type {
  LingIdResolvedSurface,
  LingIdSelection,
  ParsedShallowSurfaceDto,
  ParsedSurfaceResult,
  ResolvedSurfaceLingId,
  ShallowSurfaceLingId,
  SurfaceLingId,
} from "./types";

export type LingConverters<L extends TargetLanguage> = {
  getSurfaceLingId: {
    (value: Lemma<L>): ResolvedSurfaceLingId;
    (
      value:
        | LingIdSelection<L>
        | LingIdResolvedSurface<L>
        | SerializableSurface,
    ): SurfaceLingId | ResolvedSurfaceLingId;
  };
  getShallowSurfaceLingId: (
    value:
      | LingIdSelection<L>
      | LingIdResolvedSurface<L>
      | ParsedShallowSurfaceDtoFor<L>
      | SerializableSurfaceShell,
  ) => ShallowSurfaceLingId;
  parseSurface: (
    id: SurfaceLingId | ResolvedSurfaceLingId,
  ) => ParsedSurfaceResult<L>;
  parseShallowSurface: (
    id: ShallowSurfaceLingId,
  ) => ParsedShallowSurfaceDtoFor<L>;
};

export const LingId = {
  forLanguage: buildToLingConverters,
} as const;
```

Notes:

- Keep `buildToLingConverters(...)` as the concrete function export because the
  test suite already asserts it.
- Keep `LingId.forLanguage(...)` for namespace-style use, matching
  `LingOperation.forLanguage(...)`.
- Keep `LingId.Value`, `LingId.Input`, `LingId.Converters`, `LingId.SurfaceId`,
  `LingId.ResolvedId`, and `LingId.ShallowId` as namespace-exported types.
- `public.ts` should be a facade only. Parsing, serialization, guards, and
  header handling should live below `internal/`.

## Ownership Split

### Universal

Universal code should own:

- public API construction in `public.ts`
- all parsing and serialization of the current wire format
- token escaping/unescaping
- feature bag compaction and parsing
- header construction and parsing
- language mismatch guardrails
- structural narrowing of lemma vs full surface vs shallow surface inputs
- conversion from `Lemma` to resolved lemma surface for serialization
- parsing of wire payloads back into `Selection`, `ResolvedSurface`, and shallow
  DTOs
- the mapping between `TargetLanguage` and the short wire header code

### Language packs

For the current format: none.

Reason:

- lemma body serialization uses universal entity fields
- surface body serialization uses universal entity fields
- feature bags already serialize structurally as key/value pairs
- the parser already reconstructs entities from universal shapes
- no language currently needs special tokenization, feature aliases, or custom
  escaping

### Optional future language-pack hooks

Do not add these now, but if the format ever diverges by language, the only
pack-owned pieces should be narrow wire concerns such as:

- language-specific stable aliases for discriminator values
- language-specific stable aliases for feature keys or feature values
- language-specific normalization if a wire payload must differ from the
  canonical entity representation

If such hooks become necessary, they should live behind a tiny
`LanguageLingIdPack` registry and should not absorb the generic parser or
serializer.

## Folder Structure

Recommended structure:

```text
src/ling-id/
  public.ts
  types.ts
  internal/
    api-shapes.ts
    guards.ts
    language-registry.ts
    parse.ts
    serialize.ts
    wire/
      escape.ts
      feature-bag.ts
      header.ts
```

Responsibilities:

- `public.ts`
  Thin facade. Exports public types, builds the language-bound helpers, and
  exposes the `LingId` namespace object.
- `types.ts`
  Public aliases and DTO types currently defined in `old-ling-id/types.ts`.
- `internal/api-shapes.ts`
  Internal structural input/output helper types such as
  `SerializableSurface`, `SerializableSurfaceShell`, and any internal helper
  unions that should not leak publicly.
- `internal/guards.ts`
  Runtime type guards like `isSelectionValue`, `isResolvedSurfaceValue`,
  `isShallowSurfaceValue`, plus `assertLanguageMatch(...)`.
- `internal/language-registry.ts`
  Universal mapping between `TargetLanguage` and wire header codes like `EN`,
  `DE`, `HE`.
- `internal/parse.ts`
  Public-format parsing entry points and body-level parsers.
- `internal/serialize.ts`
  Public-format serializers and normalization helpers.
- `internal/wire/escape.ts`
  Token escaping/unescaping helpers.
- `internal/wire/feature-bag.ts`
  Feature bag compaction and parse/serialize helpers.
- `internal/wire/header.ts`
  `buildHeader(...)`, `parseHeader(...)`, and `joinLingId(...)`.

This keeps `src/ling-id/public.ts` small and mirrors the successful pattern
already used by `src/lu/public-operations.ts`.

## API Semantics

### `getSurfaceLingId`

Input:

- `Lemma<L>` returns a `ResolvedSurfaceLingId`
- `LingIdSelection<L>` returns a `SurfaceLingId | ResolvedSurfaceLingId`
- `LingIdResolvedSurface<L>` returns a `ResolvedSurfaceLingId`

Behavior:

- if input is a lemma, first materialize the resolved lemma surface
- if input is a selection, preserve the distinction between unresolved-target
  and resolved-target surfaces
- if input already carries a language, the bound builder must reject a mismatch

Implementation note:

- use `LingOperation.convert.lemma.toResolvedLemmaSurface(...)` or extract the
  same normalization logic into a shared universal helper so Ling ID and
  operations do not drift

### `getShallowSurfaceLingId`

Input:

- any full Ling ID surface input
- shallow parsed DTO

Behavior:

- require a surface-shaped input
- erase target information
- keep language, orthographic status, normalized surface, discriminators, and
  inflectional features

### `parseSurface`

Behavior:

- parse header
- reject unsupported kind
- return either:
  - `LingIdSelection<L>` for targeted/full surface IDs
  - `LingIdResolvedSurface<L>` for resolved lemma-surface IDs

### `parseShallowSurface`

Behavior:

- parse header
- reject unsupported kind
- return `ParsedShallowSurfaceDtoFor<L>`

## Implementation Plan

1. Extract public Ling ID types into `src/ling-id/types.ts`.

   Move the type aliases and DTO types from `src/old-ling-id/types.ts` with no
   semantic changes.

2. Extract universal helpers into `src/ling-id/internal/`.

   Move `escape.ts`, `features.ts`, `wire.ts`, `parse.ts`, and `serialize.ts`
   into the new structure, splitting `wire.ts` into `language-registry.ts` and
   `wire/header.ts`.

3. Replace duplicate resolved-surface normalization.

   `old-ling-id/serialize.ts` currently builds lemma surfaces directly and
   assumes `normalizedFullSurface = canonicalLemma`. The new code should call
   the same normalization path used by `LingOperation.convert.lemma` so both
   subsystems stay aligned.

4. Implement `src/ling-id/public.ts` as a thin facade.

   Keep the current overloads and namespace-style type exports. The file should
   mostly delegate to `internal/serialize.ts`, `internal/parse.ts`, and shared
   guards.

5. Switch root exports and imports.

   - change `src/index.ts` from `./old-ling-id/public` to `./ling-id/public`
   - update internal imports such as `src/relations/relation.ts` to consume the
     new Ling ID type location

6. Preserve test parity before cleanup.

   The following suites should pass unchanged:

   - `tests/external/ling-id-serialization.test.ts`
   - `tests/external/ling-id-parsing.test.ts`
   - `tests/external/ling-id-guardrails.test.ts`
   - `tests/external/ling-id-usage.test.ts`
   - `tests/external/public-api.test.ts`

7. Remove `src/old-ling-id/` after parity is confirmed.

## Migration Notes

- Keep all runtime behavior identical first; rename and restructure before any
  format cleanup.
- Do not rename `buildToLingConverters(...)` in the same change.
- Do not widen the root export surface. The public API tests explicitly guard
  against that.
- `RelationTargetLingIds` should continue to depend on the Ling ID public type,
  but the import path should move from `old-ling-id/types` to `ling-id/types`.

## Open Decisions

1. `LingId` string branding

   Recommendation: defer. It adds churn without helping the migration.

2. Parser result strictness

   Recommendation: keep the current DTO-returning behavior. Do not validate via
   Zod in this step.

3. Language packs for Ling ID

   Recommendation: do not introduce them now. Add a registry only if a real
   wire-format divergence appears.
