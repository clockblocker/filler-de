# Implementation Plan: `src/ling-id/public.ts`

## Status

Proposed

## Summary

Implement `src/ling-id/public.ts` as a fresh Ling ID public API and codec
layer. `src/old-ling-id/` is reference material only while designing the new
system; it is not the source of truth, not a compatibility target, and not a
module to "move out of".

Unlike `lu/public-operations.ts`, the Ling ID layer should stay almost entirely
universal. For the current ID format, language packs should not own parsing or
serialization logic. The wire format is structural and derived from the entity
model; the only language-specific datum in the wire format is the language code
in the header, which belongs in a tiny universal registry, not in per-language
packs.

## Goals

- Define the new Ling ID public API in `src/ling-id/public.ts`.
- Use `src/old-ling-id/` only as reference while designing the new layer.
- Centralize universal codec mechanics under `src/ling-id/internal/`.
- Avoid introducing language packs unless a real wire-format divergence appears.
- Reduce duplication with `lu/public-operations.ts` where normalization and
  resolved lemma-surface construction are already defined.

## Non-Goals

- Preserving the old public API just because it exists today.
- Guaranteeing wire-format compatibility with `src/old-ling-id/` during design.
- Rebranding IDs from `string` to opaque/branded strings in this step.
- Adding new Ling ID kinds.
- Making Ling ID parsing schema-driven.
- Introducing per-language customization without a concrete need.

## Proposed Public API

`src/ling-id/public.ts` should expose a small curated surface. The old module is
useful as a reference point for ergonomics, but it should not constrain the new
API if a cleaner shape is better.

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

- `LingId.forLanguage(...)` is still a good fit because it matches
  `LingOperation.forLanguage(...)`.
- `buildToLingConverters(...)` is optional. Keep it only if it still improves
  ergonomics after the redesign.
- Namespace-exported types on `LingId` are optional. Keep them only if they make
  consumption materially clearer.
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

1. Define public Ling ID types in `src/ling-id/types.ts`.

   Start from the old shapes only where they are still useful. This is a new
   design pass, so type aliases and DTOs may be renamed, narrowed, or dropped.

2. Build universal helpers under `src/ling-id/internal/`.

   Use the old helpers as reference, but recompose them around the new folder
   structure instead of doing a mechanical move. Split `wire.ts` into
   `language-registry.ts` and `wire/header.ts`.

3. Avoid duplicate resolved-surface normalization.

   `old-ling-id/serialize.ts` currently builds lemma surfaces directly and
   assumes `normalizedFullSurface = canonicalLemma`. The new code should call
   the same normalization path used by `LingOperation.convert.lemma` so both
   subsystems stay aligned.

4. Implement `src/ling-id/public.ts` as a thin facade.

   The file should mostly delegate to `internal/serialize.ts`,
   `internal/parse.ts`, and shared guards. Reuse old overloads only where they
   still fit the new API.

5. Switch root exports and imports once the new API is acceptable.

   - point `src/index.ts` at `./ling-id/public`
   - update internal imports such as `src/relations/relation.ts` to consume the
     new Ling ID type location

6. Rewrite tests around the new API shape.

   Existing Ling ID tests are reference coverage, not a compatibility contract.
   Keep the behavior worth preserving, but update the suites to reflect the new
   public surface.

   At minimum, cover:

   - serialization semantics
   - parsing semantics
   - language guardrails
   - public API exposure

7. Remove `src/old-ling-id/` once the new implementation is accepted.

## Migration Notes

- `src/old-ling-id/` should be treated as disposable reference code.
- Compatibility with the old public API should be an explicit decision, not a
  default assumption.
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
