# Linguistic Identity Spec

Status: Draft
Owner: Textfresser
Last updated: 2026-02-21

## Why this spec exists

Textfresser needs one canonical semantic identity for linguistic DTOs that is:

1. owned by `@textfresser/linguistics`
2. reusable by generation, matching, and note codecs
3. opaque to callers

The public surface should let callers compute and compare linguistic identity without learning or depending on its internal structure.

## Goals

1. Define one canonical semantic identity boundary for `AnyLemma` and `AnySelection`.
2. Keep the public API minimal and opaque.
3. Make emoji description part of linguistic identity semantics.
4. Replace ad hoc codec-level identity fields such as `discriminator2` with linguistics-owned feature projection.
5. Let language packs decide which feature subset participates in identity.

## Non-goals

1. No note block anchors or note-local durable ids.
2. No filesystem, vault, or Obsidian concerns.
3. No public API for parsing or inspecting identity internals.
4. No sense-slot allocation or note-level collision handling.

## Public API

The public interface is intentionally small.

```ts
export type LingId = string & { readonly __brand: "LingId" };

export function toLingId(input: AnyLemma | AnySelection): LingId;
```

Rules:

1. `LingId` is opaque.
2. Callers compare `LingId` values with plain string equality.
3. Callers must not parse, split, or interpret the returned string.
4. The exact serialized string format is package-owned and may change behind the opaque contract.
5. `toLingId` preserves the actual `surfaceKind`; it does not normalize everything to lemma identity.
6. `toLingId` must fail loudly if the input is unknown or lacks identity-critical data.

No public companion APIs such as `parseLingId`, `compareLingId`, or `getLinguisticIdentity` are exposed in v1.

## Internal normalized primitive

`@textfresser/linguistics` may use an internal normalized identity primitive to implement `toLingId`.

Illustrative shape:

```ts
type NormalizedLinguisticIdentity = {
	language: TargetLanguage;
	surface: string;
	surfaceKind: SurfaceKind;
	unitKind: LemmaKind;
	discriminator: Pos | PhrasemeKind | MorphemeKind;
	emojiDescription: string[];
	identityFeatures: Partial<AbstractFeatures>;
};
```

This shape is not public API.

## Identity inputs

The normalized primitive is derived from existing DTO fields, not from note rendering.

Source fields:

1. `language`
2. spelled surface
3. `surfaceKind`
4. lemma kind
5. native discriminator:
   - lexeme -> `pos`
   - phraseme -> `phrasemeKind`
   - morpheme -> `morphemeKind`
6. `emojiDescription`
7. a pack-declared subset of features

For `AnySelection`, identity is derived from the selection surface plus its embedded lemma identity fields.

## Emoji semantics

`emojiDescription` is part of linguistic identity.

Normalization rules:

1. `emojiDescription` is treated as a semantic set, not an ordered list.
2. Duplicate emojis are removed.
3. Canonical serialization uses deterministic ordering.
4. `["🏰", "👑"]` and `["👑", "🏰", "🏰"]` produce the same `LingId`.
5. Missing emoji description is normalized as an empty set.

## Identity feature subset

There is no public `discriminator2` field.

Instead, identity may include a language-specific and discriminator-specific subset of features under the internal `identityFeatures` projection.

Rules:

1. The subset is owned by `@textfresser/linguistics`.
2. The subset is declared by language packs, not by downstream packages.
3. The subset may vary by target language, lemma kind, and discriminator.
4. Only declared identity features participate in `LingId`.
5. All other features remain linguistically valid but non-identifying.

Illustrative internal policy shape:

```ts
type IdentityFeaturePolicy = {
	keys: readonly (keyof AbstractFeatures)[];
};
```

Examples:

1. German lexeme noun may include `gender`.
2. German lexeme verb may include `separable`.
3. English packs may declare no extra identity features for many discriminators.
4. Future language packs may introduce different identity feature subsets without changing the public API.

## Normalization pipeline

`toLingId` is implemented as a pure normalization and serialization pipeline:

1. Validate that the input has enough identity information.
2. Extract the internal normalized identity primitive.
3. Normalize `emojiDescription` as a set.
4. Pick only the pack-declared identity feature subset.
5. Canonicalize identity-feature key ordering.
6. Serialize the normalized primitive into an opaque `LingId`.

The public function is the only supported normalization boundary in v1.

## Equality semantics

Two inputs have the same `LingId` if and only if all canonical identity semantics match after normalization.

That includes:

1. language
2. surface
3. surface kind
4. unit kind
5. native discriminator
6. normalized emoji set
7. normalized declared identity-feature subset

That excludes:

1. note path
2. note-local block id
3. header rendering
4. section rendering
5. raw metadata carrier format
6. non-declared linguistic features

## Failure behavior

`toLingId` must fail loudly rather than inventing partial identity.

V1 failure cases include:

1. unknown selections
2. missing discriminator data
3. missing surface data
4. malformed identity-feature values after normalization

## Design constraints for downstream packages

Downstream packages such as the note codec may:

1. store `LingId`
2. compare `LingId`
3. roundtrip `LingId`

Downstream packages may not:

1. define their own semantic identity model in parallel
2. reconstruct identity from rendered headers
3. introduce public parsing contracts for `LingId`
4. treat note-local ids as semantic linguistic identity
