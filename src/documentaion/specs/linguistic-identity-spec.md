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
5. No cross-version persistence guarantee for `LingId` during the clean-break phase.

## Public API

The public interface is intentionally small.

```ts
export type LingId = string & { readonly __brand: "LingId" };

export function toLingId(input: AnyLemma | AnySelection): LingId | null;
```

Rules:

1. `LingId` is opaque.
2. Callers compare `LingId` values with plain string equality.
3. Callers must not parse, split, or interpret the returned string.
4. The exact serialized string format is package-owned and may change during the clean-break phase.
5. `toLingId` preserves the actual `surfaceKind`; it does not normalize everything to lemma identity.
6. `toLingId` returns `null` if the input is unknown or lacks identity-critical data.

Clean-break rule:

1. `LingId` is a current-generation semantic id, not a long-term persistence format.
2. Stored `LingId` values are only expected to match ids produced by the same current identity policy.
3. Changing serialization, normalization, or language-pack identity policy is allowed without migration support in this phase.

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

## Runtime DTO prerequisites

V1 requires identity-critical fields to exist in runtime DTO data.

Rules:

1. `toLingId` must not attempt to infer language from TypeScript generics.
2. `toLingId` must not infer language from schema shape heuristics.
3. `AnyLemma` must carry runtime `language` and `spelledLemma` in v1.
4. `AnySelection` must carry runtime `language` in v1.
5. If those runtime fields are absent, `toLingId` returns `null`.

## Surface normalization

Surface normalization is intentionally minimal in v1.

Rules:

1. Surface is normalized with Unicode NFC.
2. Leading and trailing whitespace is trimmed.
3. Internal whitespace runs are collapsed to a single ASCII space.
4. No case folding is applied.
5. No punctuation stripping is applied.
6. No language-specific folding is applied.
7. The normalized spelled surface is used for identity.
8. If normalization produces the empty string, `toLingId` returns `null`.

Typo-selection rule:

1. Typo selections use the typo surface exactly as carried in `selection.surface.spelledSurface`.
2. Typo selections do not normalize to a corrected standard form.
3. A typo selection and a standard selection therefore produce different `LingId` values when their normalized surfaces differ.

## Emoji semantics

`emojiDescription` is part of linguistic identity.

Normalization rules:

1. `emojiDescription` is treated as a semantic set, not an ordered list.
2. Each emoji string is normalized with Unicode NFC.
3. Duplicate normalized emoji strings are removed.
4. Canonical serialization sorts normalized emoji strings by plain code-unit order.
5. `["🏰", "👑"]` and `["👑", "🏰", "🏰"]` produce the same `LingId`.
6. Missing emoji description is normalized as an empty set.

V1 interpretation:

1. `emojiDescription` is a list of literal emoji strings already carried by DTOs.
2. It is not a list of semantic labels.
3. ZWJ sequences, skin tones, and variation selectors are preserved as part of the normalized string.

## Identity feature subset

There is no public `discriminator2` field.

Instead, identity may include a language-specific and discriminator-specific subset of features under the internal `identityFeatures` projection.

Rules:

1. The subset is owned by `@textfresser/linguistics`.
2. The subset is declared by language packs, not by downstream packages.
3. The subset may vary by target language, lemma kind, and discriminator.
4. Only declared identity features participate in `LingId`.
5. All other features remain linguistically valid but non-identifying.

V1 value-shape restriction:

1. Identity features must be flat scalar values already represented by feature schemas.
2. Arrays do not participate in identity.
3. Nested objects do not participate in identity.
4. `undefined` values are omitted rather than serialized.
5. Missing and omitted mean the same thing for identity.
6. Implicit defaults are not added during identity normalization.

Illustrative internal policy shape:

```ts
type IdentityFeaturePolicy = {
	keys: readonly (keyof AbstractFeatures)[];
};
```

Declaration rule:

1. Each language/discriminator bundle should declare `identityFeatureKeys` next to its feature schema definition.
2. `@textfresser/linguistics` assembles an internal registry from those bundle exports.
3. There is no separate public policy API in v1.

Initial v1 policy:

1. German `Lexeme` + `NOUN` => `gender`
2. German `Lexeme` + `VERB` => `separable`
3. German `Morpheme` + `Prefix` => `separable`
4. Everything else => no identity features
5. `discourseFormulaRole` does not participate in identity in v1

## Normalization pipeline

`toLingId` is implemented as a pure normalization and serialization pipeline:

1. Validate that the input has enough identity information.
2. Normalize the spelled surface.
3. Extract the internal normalized identity primitive.
4. For `AnySelection`, use selection `surface` and `surfaceKind`, and use embedded lemma data for `unitKind`, discriminator, `emojiDescription`, and identity-feature source.
5. If `orthographicStatus === "Standard"` and `surfaceKind === "Lemma"` and normalized `selection.surface.spelledSurface !== selection.surface.lemma.spelledLemma`, return `null`.
6. Differences between surface and lemma are otherwise allowed and expected for inflections, variants, partials, and typo selections.
7. Normalize `emojiDescription` as a set.
8. Pick only the pack-declared identity feature subset.
9. Canonicalize identity-feature key ordering.
10. Serialize the normalized primitive into an opaque `LingId`.

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

## Null-return behavior

`toLingId` returns `null` rather than inventing partial identity.

V1 null-return cases include:

1. unknown selections
2. missing discriminator data
3. missing surface data
4. malformed identity-feature values after normalization
5. inconsistent selection identity

Unknown-selection rule:

1. An unknown selection is any `AnySelection` with `orthographicStatus === "Unknown"`.

## Design constraints for downstream packages

Downstream packages such as the note codec may:

1. store `LingId`
2. compare `LingId`
3. roundtrip `LingId`

Storage rule:

1. Storing `LingId` is allowed as a convenience within the clean-break phase.
2. Such storage does not create a compatibility guarantee across identity-policy changes.

Downstream packages may not:

1. define their own semantic identity model in parallel
2. reconstruct identity from rendered headers
3. introduce public parsing contracts for `LingId`
4. treat note-local ids as semantic linguistic identity
