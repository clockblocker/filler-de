# Ling ID Refactor Spec

## Decisions

- This is a hard cutover to `ling:v2`.
- Backward compatibility for existing `ling:v1` top-level `LEM` IDs does not
  matter for this refactor.
- `parseLingId()` does not need to keep accepting `ling:v1` `LEM` IDs.
- `buildToLingIdFor()` intentionally changes semantics: lemma input now returns
  an observed-surface ID.
- `buildToLemmaLingIdFor()` is removed entirely from the public API.
- `ObservedSurface` stays out of `SurfaceSchema`, LU schemas, and the normal LU
  model for now.
- `ObservedSurface` support exists only in the `ling-id` layer and Ling ID DTO
  types for now.
- `buildToShallowSurfaceLingIdFor()` remains targeted-surface-only for now.
- `buildToShallowSurfaceLingIdFor()` should reject lemma input and observed
  surfaces instead of trying to normalize them.

## Step 0: Split `Surface` and `ObservedSurface`

Keep real `Surface` separate from `ObservedSurface`.

`SurfaceTargetFor` should continue to mean "a real surface points to a lemma".
An observed lemma identity is not that. It is a synthetic surface-shaped
identity object.

```ts
type SurfaceTargetFor<
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> =
	| Pick<AbstractLemma<LK, D>, "canonicalLemma">
	| { lemma: AbstractLemma<LK, D> };

type ObservedSurfaceFor<
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = {
	surfaceKind: "Lemma";
	normalizedFullSurface: string;
	discriminators: {
		lemmaKind: LK;
		lemmaSubKind: D;
	};
	target: "Lemma";
	observedLemma: AbstractLemma<LK, D>;
};
```

`ObservedSurfaceFor` should stay out of `AbstractSelectionFor` and normal LU
schemas for now. It belongs in the identity layer first.

## Ling ID Types

```ts
export type ObservedSurfaceLingId = string;
export type SurfaceLingId = string;
export type LingId = SurfaceLingId | ObservedSurfaceLingId;

export type SerializableLemma = AnyLemma | ParsedLemmaDto;

export type ParsedObservedSurfaceDto = {
	lingKind: "Surface";
	language: TargetLanguage;
	orthographicStatus: "Standard";
	surfaceKind: "Lemma";
	normalizedFullSurface: string;
	discriminators: {
		lemmaKind: LemmaKind;
		lemmaSubKind: string;
	};
	target: "Lemma";
	observedLemma: ParsedLemmaDto;
};

export type ParsedTargetedSurfaceDto = {
	lingKind: "Surface";
	language: TargetLanguage;
	orthographicStatus: Exclude<OrthographicStatus, "Unknown">;
	surfaceKind: Exclude<SurfaceKind, never>;
	normalizedFullSurface: string;
	discriminators: {
		lemmaKind: LemmaKind;
		lemmaSubKind: string;
	};
	target: { canonicalLemma: string } | { lemma: ParsedLemmaDto };
	inflectionalFeatures?: ParsedFeatureBag;
};

export type ParsedSurfaceDto =
	| ParsedTargetedSurfaceDto
	| ParsedObservedSurfaceDto;

export type ParsedLingDto = ParsedSurfaceDto;
```

## Normalization Rules

`toSurfaceLingId(lemma)` must first normalize lemma input into an observed
surface.

Normalization rules:

- `surfaceKind` is always `"Lemma"`
- `orthographicStatus` is always `"Standard"`
- `normalizedFullSurface` is always `canonicalLemma`
- `discriminators` are derived from lemma kind and subkind
- `target` is always `"Lemma"`
- `observedLemma` is a normalized parsed lemma DTO

This gives one canonical representation for lemma identity in the surface-only
API.

## Public API

`buildToLemmaLingIdFor` is removed.

`buildToSurfaceLingIdFor` becomes overloaded:

```ts
type LanguageSerializer = {
	toSurfaceLingId: {
		(value: SerializableLemma): ObservedSurfaceLingId;
		(value: SerializableSurface): SurfaceLingId | ObservedSurfaceLingId;
	};
	toShallowSurfaceLingId: (
		value: SerializableTargetedSurface,
	) => ShallowSurfaceLingId;
};
```

```ts
export function buildToSurfaceLingIdFor<L extends TargetLanguage>(lang: L): {
	(
		value: AnyLemma<L> | ParsedLemmaDtoFor<L> | ParsedLemmaDto,
	): ObservedSurfaceLingId;
	(
		value:
			| LingIdSurfaceInput<L>
			| ParsedSurfaceDtoFor<L>
			| ParsedSurfaceDto,
	): SurfaceLingId | ObservedSurfaceLingId;
};

export function buildToLingIdFor<L extends TargetLanguage>(lang: L) {
	return buildToSurfaceLingIdFor(lang);
}
```

`buildToLingIdFor()` therefore inherits the new semantics:

- lemma input returns `ObservedSurfaceLingId`
- real surface input returns `SurfaceLingId | ObservedSurfaceLingId`

## Serializer and Parser Direction

Serializer changes:

- replace top-level `serializeLemma()` with internal `serializeLemmaBody()`
- add `serializeObservedSurface()`
- make `serializeSurface()` handle `canon`, `lemma`, and `observed`

Parser changes:

- top-level `parseLingId()` returns only `ParsedSurfaceDto`
- keep lemma parsing as internal `parseLemmaBody()`
- support `targetMode` values `canon`, `lemma`, and `observed`

Because top-level `LEM` disappears, the wire format should move to `ling:v2`.

This is a hard `v2` cutover. Preserving support for old top-level lemma IDs is
not a goal.

## Implementation Order

1. Add `ObservedSurface` types and split parsed DTOs into targeted vs observed.
2. Add lemma-to-observed-surface normalization helpers.
3. Refactor serializer and parser around lemma-body payloads.
4. Overload `buildToSurfaceLingIdFor` and remove `buildToLemmaLingIdFor`.
5. Update tests and README.
