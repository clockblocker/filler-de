# Spec + Implementation Plan: `src/ling-id/public.ts`

## Status

Proposed

## Summary

`src/ling-id/public.ts` should define a new external Ling ID API.

`src/old-ling-id/` is reference-only and should not constrain:

- public API shape
- wire format
- internal folder layout
- naming

If the old wire format contains obvious baggage, change it.

The new public API should be entity-based, typed, and small:

- `LingId<LIK, L>` as the public Ling ID type
- `makeLingIdFor(...)` to encode real entities
- `tryToDecode(...)` to decode into real entities via `Result`
- `LingIdCodec.forLanguage(language)` plus optional per-language static entries

Legacy public concepts like `LingConverters` and `ShallowSurfaceDto` should not
survive into the new API.

## Design Rules

1. Public API should talk in terms of actual entities, not transport DTOs.
2. The codec should encode and decode `Lemma`, `Selection`, `ResolvedSurface`,
   and `UnresolvedSurface`.
3. `Surface` may exist as a convenience union type, but it should not force a
   separate wire kind.
4. Decoding should return `Result`, not throw, for malformed or mismatched IDs.
5. Language packs should not exist unless the wire format truly diverges by
   language.
6. Unknown selections are part of the general entity model, but they are not
   valid Ling ID inputs.
7. Concrete wire/entity kinds are preferred over union-level Ling ID brands.

## Public API

Recommended public surface:

```ts
import type { Result } from "neverthrow";

export type LingId<
  LIK extends LingEntity = LingEntity,
  L extends TargetLanguage = TargetLanguage,
> = string & {
  readonly __lingIdBrand: unique symbol;
  readonly __lingEntity?: LIK;
  readonly __language?: L;
};

export type LingIdValueFor<
  LIK extends LingEntity,
  L extends TargetLanguage,
> =
  LIK extends "Lemma" ? Lemma<L> :
  LIK extends "Selection" ? Selection<L> :
  LIK extends "ResolvedSurface" ? ResolvedSurface<L> :
  LIK extends "UnresolvedSurface" ? UnresolvedSurface<L> :
  LIK extends "Surface" ? Surface<L> :
  never;

export type LingIdDecodeErrorCode =
  | "MalformedLingId"
  | "UnsupportedVersion"
  | "UnsupportedLanguage"
  | "UnsupportedEntityKind"
  | "LanguageMismatch"
  | "EntityMismatch"
  | "PayloadDecodeFailed";

export type LingIdDecodeError = {
  code: LingIdDecodeErrorCode;
  message: string;
  input: string;
  cause?: unknown;
};

export type LingIdCodecFor<L extends TargetLanguage> = {
  makeLingIdFor: {
    (value: Lemma<L>): LingId<"Lemma", L>;
    (value: KnownSelection<L>): LingId<"Selection", L>;
    (value: ResolvedSurface<L>): LingId<"ResolvedSurface", L>;
    (value: UnresolvedSurface<L>): LingId<"UnresolvedSurface", L>;
  };
  tryToDecode: {
    (id: LingId<"Lemma", L>): Result<Lemma<L>, LingIdDecodeError>;
    (id: LingId<"Selection", L>): Result<Selection<L>, LingIdDecodeError>;
    (
      id: LingId<"ResolvedSurface", L>,
    ): Result<ResolvedSurface<L>, LingIdDecodeError>;
    (
      id: LingId<"UnresolvedSurface", L>,
    ): Result<UnresolvedSurface<L>, LingIdDecodeError>;
    (
      id: LingId<"ResolvedSurface" | "UnresolvedSurface", L>,
    ): Result<Surface<L>, LingIdDecodeError>;
    (
      id: string,
    ): Result<
      LingIdValueFor<
        "Lemma" | "Selection" | "ResolvedSurface" | "UnresolvedSurface",
        L
      >,
      LingIdDecodeError
    >;
  };
};

export const LingIdCodec = {
  forLanguage,
  English: forLanguage("English"),
  German: forLanguage("German"),
  Hebrew: forLanguage("Hebrew"),
} satisfies {
  forLanguage<L extends TargetLanguage>(language: L): LingIdCodecFor<L>;
} & {
  [L in TargetLanguage]: LingIdCodecFor<L>;
};
```

## What Dies

These are legacy artifacts and should not appear in the new external API:

- `LingConverters`
- `buildToLingConverters(...)`
- `getSurfaceLingId(...)`
- `getShallowSurfaceLingId(...)`
- `parseSurface(...)`
- `parseShallowSurface(...)`
- `ParsedShallowSurfaceDto`
- `SerializableSurfaceShell`

Reason:

- they describe transport mechanics instead of domain entities
- they expose old encoding accidents
- they force users to understand special cases like "shallow"

## What Replaces "Shallow"

Nothing public.

The old "shallow surface" concept is an implementation artifact. The real
domain distinction is:

- `ResolvedSurface<L>`
- `UnresolvedSurface<L>`

An unresolved surface is one whose target is not hydrated as a full lemma. In
the current model that means a partial target like `{ canonicalLemma: "See" }`,
not target absence. That should be encoded as `LingId<"UnresolvedSurface", L>`,
not via a DTO-only API.

If we still want an internal helper that strips targets before serializing some
payload, keep it internal and do not expose it from `public.ts`.

## Wire Format Direction

The wire format may change.

Recommended direction:

- versioned prefix, for example `ling:v2`
- explicit language code
- explicit concrete entity kind
- payload encoding per concrete entity kind

Avoid these old-format ideas:

- one overloaded `SURF` kind with extra target-mode flags
- a separate `SURF-SHALLOW` kind
- public semantics that depend on DTO-only transport shapes

Recommended concrete entity kinds:

- `LEM`
- `SEL`
- `SURF-RES`
- `SURF-UNRES`

`Surface` should remain a type-level union convenience. It does not need its
own distinct wire kind.

## Universal vs Language-Pack Ownership

### Universal

Universal code should own all of this:

- the public API in `public.ts`
- Ling ID branding types
- mapping from `LingEntity` to entity value types
- encode/decode dispatch
- wire headers and versioning
- language-code registry
- payload tokenization
- feature bag encoding/decoding
- decode error construction
- runtime language/entity validation
- entity-kind inference for `makeLingIdFor(...)`
- canonical serialization ordering

### Language packs

For now: none.

The current entity model is already sufficiently structural:

- lemma kind names are universal
- surface kind names are universal
- orthographic status values are universal
- feature keys are already modeled structurally
- discriminator axes are already modeled structurally

There is no good reason to make each language own its own Ling ID encoder or
decoder.

### If language packs ever become necessary

Keep them tiny. Only allow pack hooks for genuine wire divergences, such as:

- stable language-specific aliases for payload atoms
- stable language-specific compression tables
- stable language-specific normalization needed only for wire output

Even then:

- the parser and serializer stay universal
- header parsing stays universal
- error types stay universal
- public API stays universal

## Folder Structure

Recommended layout:

```text
src/ling-id/
  public.ts
  types.ts
  internal/
    entity-value-map.ts
    errors.ts
    guards.ts
    codec/
      encode.ts
      decode.ts
      infer-kind.ts
    wire/
      header.ts
      language-codes.ts
      tokens.ts
      feature-bag.ts
```

### File roles

- `public.ts`
  Exports the branded `LingId` type, decode-error types, `LingIdCodec`, and the
  minimal namespace-level public surface.
- `types.ts`
  Public helper types only, such as `LingIdValueFor` and maybe
  `ConcreteLingEntity` if needed.
- `internal/entity-value-map.ts`
  Maps `LingEntity` to `Lemma`, `Selection`, `ResolvedSurface`,
  `UnresolvedSurface`, or `Surface`.
- `internal/errors.ts`
  Defines `LingIdDecodeError` builders and internal error normalization.
- `internal/guards.ts`
  Runtime guards for entity-shape detection and language checks.
- `internal/codec/infer-kind.ts`
  Infers which concrete entity kind is being encoded from the runtime value.
- `internal/codec/encode.ts`
  Encodes actual entities into Ling IDs.
- `internal/codec/decode.ts`
  Decodes Ling IDs into actual entities, returning `Result`.
- `internal/wire/header.ts`
  Builds and parses `ling:vN:<lang>:<entity-kind>` headers.
- `internal/wire/language-codes.ts`
  Universal language-code mapping.
- `internal/wire/tokens.ts`
  Escaping and token join/split helpers.
- `internal/wire/feature-bag.ts`
  Feature serialization and parse helpers.

There should be no `language-packs/` subtree under `src/ling-id/` unless a real
need appears.

## API Semantics

### `makeLingIdFor(...)`

Behavior:

- accepts actual entities only
- infers the concrete Ling entity kind
- returns a branded `LingId<LIK, L>`
- never exposes DTO-only intermediate shapes
- rejects `Selection<L>` values whose `orthographicStatus` is `"Unknown"`

Encoding rules:

- `Lemma<L>` -> `LingId<"Lemma", L>`
- `KnownSelection<L>` -> `LingId<"Selection", L>`
- `ResolvedSurface<L>` -> `LingId<"ResolvedSurface", L>`
- `UnresolvedSurface<L>` -> `LingId<"UnresolvedSurface", L>`

### `tryToDecode(...)`

Behavior:

- never throws for malformed input
- returns `Result`
- validates header version, language, entity kind, and payload shape
- returns a real entity, not a parser DTO

Mismatch behavior:

- decoding an ID with the wrong bound language returns `err`
- decoding an ID whose concrete kind conflicts with the requested generic kind
  returns `err`

### `Surface<L>`

`Surface<L>` remains a useful decode result union, meaning either:

- `ResolvedSurface<L>`
- `UnresolvedSurface<L>`

But the actual wire payload should still use a concrete kind, and the public
encode API should not expose a separate `LingId<"Surface", L>` brand.

### Kind inference

Runtime kind inference should be specified before implementation.

Encode-time guards should work like this:

- lemma: has `lemmaKind` and does not have `surface`
- selection: has `orthographicStatus` and `surface`
- resolved surface: has `surfaceKind` and a hydrated lemma target
- unresolved surface: has `surfaceKind` and a non-hydrated target
- unknown selection: reject

Hydration rule:

- resolved target: `target` has `lemmaKind`
- unresolved target: `target` does not have `lemmaKind`

### Canonical serialization ordering

Deterministic serialization must be locked in the spec before coding.

Canonical rules:

- entity payload fields serialize in a fixed order per entity kind
- feature bag keys serialize in sorted lexicographic order
- multi-valued feature arrays serialize with sorted values
- absent optional values are omitted or encoded with one fixed sentinel,
  consistently per field
- escaping and unescaping rules are centralized in one wire helper
- equivalent entities must always serialize to byte-identical Ling IDs

## Implementation Plan

1. Lock the external shape first.

   Finalize:

   - whether the public entry point is only `LingIdCodec` or also named helpers
   - whether we want static `LingIdCodec.English` entries in addition to
     `forLanguage(...)`
   - the exact error object shape
   - whether `KnownSelection<L>` should be publicly exported or kept internal

2. Define the new public types in `src/ling-id/types.ts`.

   Add:

   - `LingId<LIK, L>`
   - `LingIdValueFor<LIK, L>`
   - `LingIdDecodeErrorCode`
   - `LingIdDecodeError`
   - `LingIdCodecFor<L>`

3. Implement universal wire primitives.

   Add:

   - language-code registry
   - header builder/parser
   - token escaping and splitting
   - feature-bag encoding/decoding

4. Implement encode kind inference.

   Build runtime guards that distinguish:

   - lemma
   - known selection
   - resolved surface
   - unresolved surface

   Explicitly reject unknown selections. Do not use DTO-shape names in the
   public layer.

5. Implement `internal/codec/encode.ts`.

   Encode actual entities by concrete kind. If helpful, reuse existing
   normalization helpers from `lu/public-operations.ts`, but do not inherit the
   old Ling ID API surface.
   Lock deterministic ordering at the same time instead of discovering it in
   tests later.

6. Implement `internal/codec/decode.ts`.

   Parse the new header and concrete entity kind, decode the payload, and return
   `ok(value)` / `err(error)`.

7. Implement `src/ling-id/public.ts`.

   It should be thin:

   - create language-bound codecs
   - export `LingIdCodec`
   - export public types

8. Switch root exports.

   Point `src/index.ts` at `./ling-id/public`. This is an intentional package
   root breaking change, so exports, tests, and migration should land in the
   same PR.

9. Update dependents.

   `relations/` and any external tests should depend on the new `LingId` public
   type instead of `old-ling-id`.

10. Rewrite tests around the new API.

   Cover:

   - typed encode results by entity kind
   - rejection of unknown selections
   - successful decode by entity kind
   - malformed header handling
   - language mismatch handling
   - entity mismatch handling
   - deterministic serialization ordering
   - public API exposure

11. Delete `src/old-ling-id/`.

## Recommendations

### Keep

- `Result`-based decode
- branded `LingId<LIK, L>`
- entity-based API
- universal codec internals
- explicit deterministic ordering rules

### Do not keep

- shallow public concepts
- converter-style public naming
- old API compatibility as a goal
- per-language codec implementations
- union-level surface Ling ID brands in the public encode API

## Open Questions

1. Do we want `makeLingIdFor(...)` only on bound codecs, or also as a top-level
   generic helper?

   Recommendation: bound codecs only.

2. Do we want `LingIdCodec.English` style statics?

   Recommendation: yes, if you want discoverability; otherwise `forLanguage(...)`
   is enough.

3. Should lemma IDs exist in v1 of the new API?

   Recommendation: yes. If the public type is `LingId<LIK, L>`, it should cover
   actual entities symmetrically instead of starting with a surface-only bias.

4. Should `KnownSelection<L>` be public?

   Recommendation: probably yes, if callers are expected to encode selections
   directly; otherwise keep it internal and let overload errors do the work.
