# Ling ID Public API Simplification Spec

## Goal

Simplify the public Ling ID API so that the package exposes one full-identity
entry point for both real surfaces and lemma identity.

The simplification is based on one model decision:

- lemma identity is represented as an observed surface
- there is no separate top-level lemma ID API

## Decisions

- This is a green-field package change with no dependants.
- The wire header remains `ling:v1`.
- Backward compatibility with the previous unpublished Ling ID format does not
  matter.
- `ObservedSurface` is a real Ling ID DTO shape, but it is not added to the LU
  domain model or normal LU schemas yet.
- `ObservedSurface` support exists in the `ling-id` layer only.

## Public API Shape

### Remove

Remove the dedicated lemma serializer API:

```ts
buildToLemmaLingIdFor
```

Remove the dedicated lemma ID alias:

```ts
type LemmaLingId = string;
```

### Keep

Keep these exports:

```ts
type SurfaceLingId = string;
type ObservedSurfaceLingId = string;
type ShallowSurfaceLingId = string;
type LingId = SurfaceLingId | ObservedSurfaceLingId;

function buildToSurfaceLingIdFor<L extends TargetLanguage>(lang: L): ...
function buildToShallowSurfaceLingIdFor<L extends TargetLanguage>(lang: L): ...
function buildToLingIdFor<L extends TargetLanguage>(lang: L): ...
function parseLingId(id: LingId): ParsedSurfaceDto;
```

## Main Simplification

`buildToSurfaceLingIdFor()` becomes the single full-identity serializer.

It accepts:

- lemma input
- targeted surface input
- parsed observed-surface DTO input
- parsed targeted-surface DTO input

It returns:

- `ObservedSurfaceLingId` for lemma input
- `SurfaceLingId | ObservedSurfaceLingId` for surface-shaped input

### Required overloads

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
```

And at serializer level:

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

## `buildToLingIdFor` Simplification

`buildToLingIdFor()` stops being a dispatcher between lemma IDs and surface IDs.

It becomes a convenience alias for `buildToSurfaceLingIdFor()`.

```ts
export function buildToLingIdFor<L extends TargetLanguage>(lang: L) {
	return buildToSurfaceLingIdFor(lang);
}
```

This intentionally changes semantics:

- `buildToLingIdFor(lemma)` returns an observed-surface ID
- `buildToLingIdFor(surface)` returns a surface ID

There is no longer any path that returns a top-level lemma ID.

## Shallow Surface API

`buildToShallowSurfaceLingIdFor()` stays narrow.

It only accepts targeted surfaces:

```ts
export function buildToShallowSurfaceLingIdFor<L extends TargetLanguage>(
	lang: L,
): (
	value:
		| LingIdSurfaceInput<L>
		| ParsedTargetedSurfaceDtoFor<L>
		| ParsedTargetedSurfaceDto,
) => ShallowSurfaceLingId;
```

It must reject:

- lemma input
- observed-surface DTO input

It must not normalize lemma input into a shallow ID.

## DTO Model Exposed By The API

The public parsed DTO union becomes surface-only:

```ts
export type ParsedSurfaceDto =
	| ParsedTargetedSurfaceDto
	| ParsedObservedSurfaceDto;

export type ParsedLingDto = ParsedSurfaceDto;
```

### Targeted surface DTO

```ts
export type ParsedTargetedSurfaceDto = {
	lingKind: "Surface";
	language: TargetLanguage;
	orthographicStatus: Exclude<OrthographicStatus, "Unknown">;
	surfaceKind: SurfaceKind;
	normalizedFullSurface: string;
	discriminators: {
		lemmaKind: LemmaKind;
		lemmaSubKind: string;
	};
	target: { canonicalLemma: string } | { lemma: ParsedLemmaDto };
	inflectionalFeatures?: ParsedFeatureBag;
};
```

### Observed surface DTO

```ts
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
```

`ParsedLemmaDto` remains public, but only as nested DTO content:

- `target.lemma`
- `observedLemma`

It is no longer returned by `parseLingId()` as a top-level result.

## Observed Surface Normalization

When the caller passes a lemma into `buildToSurfaceLingIdFor()`, the value must
first be normalized into an observed surface DTO.

Normalization rules:

- `lingKind` is `"Surface"`
- `surfaceKind` is `"Lemma"`
- `orthographicStatus` is `"Standard"`
- `normalizedFullSurface === observedLemma.canonicalLemma`
- `discriminators.lemmaKind` is derived from the lemma
- `discriminators.lemmaSubKind` is derived from the lemma
- `target` is `"Lemma"`
- `observedLemma` is the normalized lemma DTO

The serializer must canonicalize observed-surface DTO input as well. A caller
must not be able to change the serialized ID by mutating the outer shell of an
observed-surface DTO while leaving `observedLemma` unchanged.

## Parsing Contract

`parseLingId()` parses only surface-family IDs and returns only surface DTOs.

```ts
function parseLingId(id: LingId): ParsedSurfaceDto;
```

Top-level parsing rules:

- parse targeted surface IDs into `ParsedTargetedSurfaceDto`
- parse observed-surface IDs into `ParsedObservedSurfaceDto`
- do not return top-level lemma DTOs

Internal lemma parsing still exists, but only as an implementation detail used
for nested lemma payloads and observed-surface payloads.

## Type Layer Boundaries

The simplification should not leak `ObservedSurface` into unrelated areas.

Do not add observed surfaces to:

- `AbstractSelectionFor`
- `SurfaceTargetFor`
- LU schema builders
- `SurfaceSchema`
- regular selection/domain types

For now, `ObservedSurface` is an identity-layer construct only.

## Examples

### Lemma input

```ts
const toGermanSurfaceLingId = buildToSurfaceLingIdFor("German");

toGermanSurfaceLingId(feminineSee);
// "ling:v1:DE:SURF;See;Standard;Lemma;Lexeme;NOUN;-;observed;See;Lexeme;NOUN;gender=Fem;-"
```

### Targeted surface input

```ts
const toEnglishSurfaceLingId = buildToSurfaceLingIdFor("English");

toEnglishSurfaceLingId({
	discriminators: {
		lemmaKind: "Lexeme",
		lemmaSubKind: "VERB",
	},
	inflectionalFeatures: {
		tense: "Pres",
		verbForm: "Fin",
	},
	normalizedFullSurface: "walk",
	orthographicStatus: "Standard",
	surfaceKind: "Inflection",
	target: {
		lemma: walkLemma,
	},
});
// "ling:v1:EN:SURF;walk;Standard;Inflection;Lexeme;VERB;tense=Pres,verbForm=Fin;lemma;walk;Lexeme;VERB;-;🚶"
```

### Convenience alias

```ts
const toGermanLingId = buildToLingIdFor("German");

toGermanLingId(feminineSee) === buildToSurfaceLingIdFor("German")(feminineSee);
// true
```
