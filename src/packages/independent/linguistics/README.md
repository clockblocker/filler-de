# `@textfresser/linguistics`

Typesafe schemas and types for classifying linguistic units in text.

The package models two closely related things:

- `Selection`: a concrete surface form selected in text
- `Lemma`: the normalized dictionary form assigned to that selection

It currently exposes curated registries for `German` and `English`, plus a small relations API for lexical and morphological links.

## Core idea

User reads:

```text
I walk in the park
```

They select:

```text
I [walk] in the park
```

That selection can be represented as a typed surface form:

```ts
const simpleWalkSelection = {
	language: "English",
	orthographicStatus: "Standard",
	spelledSelection: "walk",
	surface: {
		discriminators: {
			lemmaKind: "Lexeme",
			lemmaSubKind: "VERB",
		},
		inflectionalFeatures: {
			tense: "Pres",
			verbForm: "Fin",
		},
		normalizedFullSurface: "walk",
		surfaceKind: "Inflection",
		target: {
			canonicalLemma: "walk",
			inherentFeatures: {},
			language: "English",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🚶",
			pos: "VERB",
		},
	},
} satisfies Selection<"English", "Standard", "Inflection", "Lexeme", "VERB">;
```

And the assigned lemma can be validated independently:

`meaningInEmojis` is part of lemma identity and should describe the sense itself, not the literal imagery of the written form.

```ts
const simpleWalkLemma = {
	canonicalLemma: "walk",
	inherentFeatures: {},
	language: "English",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🚶",
	pos: "VERB",
} satisfies Lemma<"English", "Lexeme", "VERB">;
```

Although mainly based on the work of UD, this model has a human student of a new language in mind and hence differs from UD in compounded linguistic units.

For example, the model allows classifying the idiom in

```text
This game was a [walk] in the park
```

as part of the idiom "a walk in the park":

```ts
const idiomPartSelection = {
	language: "English",
	orthographicStatus: "Standard",
	spelledSelection: "walk",
	surface: {
		discriminators: {
			lemmaKind: "Phraseme",
			lemmaSubKind: "Idiom",
		},
		normalizedFullSurface: "a walk in the park",
		surfaceKind: "Lemma",
		target: {
			canonicalLemma: "a walk in the park",
			language: "English",
			lemmaKind: "Phraseme",
			meaningInEmojis: "😌👌",
			phrasemeKind: "Idiom",
		},
	},
} satisfies Selection<"English", "Standard", "Lemma", "Phraseme", "Idiom">;
```

The DTO separates three distinct things:

- the actual highlighted text in the note: `spelledSelection`
- the full orthographically normalized surface that the highlighted text belongs to: `normalizedFullSurface`
- the lexical target that the surface resolves to: `target.canonicalLemma`

In the examples below, the selections target the lemmas `give up` and `aufpassen`, while the realized normalized surfaces are `gave up` and `pass auf`.

`surfaceKind: "Lemma"` means that the selection resolves directly to a lemma target. It does not mean that `normalizedFullSurface` itself is a lemma string.

```ts
const gaveUpSelection = {
	language: "English",
	orthographicStatus: "Standard",
	spelledSelection: "gave",
	surface: {
		discriminators: {
			lemmaKind: "Lexeme",
			lemmaSubKind: "VERB",
		},
		normalizedFullSurface: "gave up",
		surfaceKind: "Lemma",
		target: {
			canonicalLemma: "give up",
		},
	},
} satisfies Selection<"English", "Standard", "Lemma", "Lexeme", "VERB">;

const passAufSelection = {
	language: "German",
	orthographicStatus: "Standard",
	spelledSelection: "Pass",
	surface: {
		discriminators: {
			lemmaKind: "Lexeme",
			lemmaSubKind: "VERB",
		},
		normalizedFullSurface: "pass auf",
		surfaceKind: "Lemma",
		target: {
			canonicalLemma: "aufpassen",
		},
	},
} satisfies Selection<"German", "Standard", "Lemma", "Lexeme", "VERB">;
```

This allows for both:

1. pointing the user to the most meaningful target in the actual sentences:

```text
(text reading mode on)
Hans, [Pass] auf dich auf! -> aufpassen (VERB)
Hans, Pass [auf] dich auf! -> aufpassen (VERB)
Hans, Pass auf [dich] auf! -> du (PRON)
Hans, Pass auf dich [auf]! -> aufpassen
```

2. drilling down for the actual linguistics:

```text
(linguistic investigation mode on)
Hans, [Pass] auf dich auf! -> `passen` (VERB)
Hans, Pass [auf] dich auf! -> `auf` (ADP)
Hans, Pass auf [dich] auf! -> `du` (PRON)
Hans, Pass auf dich [auf]! -> `auf` (PRT)
```

## Ling IDs

The package serializes stable surface-shaped Ling IDs. Lemma input is normalized into an observed-surface identity, so there is no separate top-level lemma ID format.

### Observed Surface IDs

```ts
const walkLemma = {
	canonicalLemma: "walk",
	inherentFeatures: {},
	language: "English",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🚶",
	pos: "VERB",
} satisfies Lemma<"English", "Lexeme", "VERB">;

const { getSurfaceLingId: toEnglishSurfaceLingId } =
	buildToLingConverters("English");

const walkLemmaId = toEnglishSurfaceLingId(walkLemma);
// "ling:v1:EN:SURF;walk;Standard;Lemma;Lexeme;VERB;-;observed;walk;Lexeme;VERB;-;🚶"
```

Observed-surface identity still includes inherent lemma features:

```ts
import { buildToLingConverters, type Lemma } from "@textfresser/linguistics";

const { getSurfaceLingId: toGermanSurfaceLingId } =
	buildToLingConverters("German");

const feminineSee = {
	canonicalLemma: "See",
	inherentFeatures: { gender: "Fem" },
	language: "German",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🌊",
	pos: "NOUN",
} satisfies Lemma<"German", "Lexeme", "NOUN">;

const neuterSee = {
	canonicalLemma: "See",
	inherentFeatures: { gender: "Neut" },
	language: "German",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🌊",
	pos: "NOUN",
} satisfies Lemma<"German", "Lexeme", "NOUN">;

toGermanSurfaceLingId(feminineSee);
// "ling:v1:DE:SURF;See;Standard;Lemma;Lexeme;NOUN;-;observed;See;Lexeme;NOUN;gender=Fem;🌊"

toGermanSurfaceLingId(neuterSee);
// "ling:v1:DE:SURF;See;Standard;Lemma;Lexeme;NOUN;-;observed;See;Lexeme;NOUN;gender=Neut;🌊"
```

### Full Surface IDs

Full surface IDs preserve target richness.

```ts
import { buildToLingConverters, type Lemma, type Selection } from "@textfresser/linguistics";

const walkLemma = {
	canonicalLemma: "walk",
	inherentFeatures: {},
	language: "English",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🚶",
	pos: "VERB",
} satisfies Lemma<"English", "Lexeme", "VERB">;

const walkSurfaceSelection = {
	language: "English",
	orthographicStatus: "Standard",
	spelledSelection: "walk",
	surface: {
		discriminators: {
			lemmaKind: "Lexeme",
			lemmaSubKind: "VERB",
		},
		inflectionalFeatures: {
			tense: "Pres",
			verbForm: "Fin",
		},
		normalizedFullSurface: "walk",
		surfaceKind: "Inflection",
		target: walkLemma,
	},
} satisfies Selection<"English", "Standard", "Inflection", "Lexeme", "VERB">;

const { getSurfaceLingId: toEnglishSurfaceLingId } =
	buildToLingConverters("English");

const walkSurfaceId = toEnglishSurfaceLingId(walkSurfaceSelection);
// "ling:v1:EN:SURF;walk;Standard;Inflection;Lexeme;VERB;tense=Pres,verbForm=Fin;lemma;walk;Lexeme;VERB;-;🚶"
```

If the target is shallow, the full surface ID changes:

```ts
const walkSurfaceWithCanonicalTargetSelection = {
	language: "English",
	orthographicStatus: "Standard",
	spelledSelection: "walk",
	surface: {
		discriminators: {
			lemmaKind: "Lexeme",
			lemmaSubKind: "VERB",
		},
		inflectionalFeatures: {
			tense: "Pres",
			verbForm: "Fin",
		},
		normalizedFullSurface: "walk",
		surfaceKind: "Inflection",
		target: {
			canonicalLemma: "walk",
		},
	},
} satisfies Selection<"English", "Standard", "Inflection", "Lexeme", "VERB">;

const { getSurfaceLingId: toEnglishSurfaceLingId } =
	buildToLingConverters("English");

const walkSurfaceWithCanonicalTargetId = toEnglishSurfaceLingId(
	walkSurfaceWithCanonicalTargetSelection,
);
// "ling:v1:EN:SURF;walk;Standard;Inflection;Lexeme;VERB;tense=Pres,verbForm=Fin;canon;walk"
```

### Shallow Surface IDs

Use shallow surface IDs when you want to compare form identity while ignoring target richness. Shallow IDs accept surface inputs such as selections, observed surfaces, and shallow shells, but not bare lemmas.

```ts
const feminineSee = {
	canonicalLemma: "See",
	inherentFeatures: { gender: "Fem" },
	language: "German",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🌊",
	pos: "NOUN",
} satisfies Lemma<"German", "Lexeme", "NOUN">;

const seeSurface = {
	language: "German",
	orthographicStatus: "Standard",
	surface: {
		discriminators: {
			lemmaKind: "Lexeme",
			lemmaSubKind: "NOUN",
		},
		normalizedFullSurface: "See",
		surfaceKind: "Lemma",
	},
} satisfies ParsedShallowSurfaceDto;

const seeSurfaceWithFullTarget = {
	language: "German",
	orthographicStatus: "Standard",
	spelledSelection: "See",
	surface: {
		discriminators: {
			lemmaKind: "Lexeme",
			lemmaSubKind: "NOUN",
		},
		normalizedFullSurface: "See",
		surfaceKind: "Lemma",
		target: feminineSee,
	},
} satisfies Selection<"German", "Standard", "Lemma", "Lexeme", "NOUN">;

const { getShallowSurfaceLingId: toGermanShallowSurfaceLingId } =
	buildToLingConverters("German");

toGermanShallowSurfaceLingId(seeSurface) ===
	toGermanShallowSurfaceLingId(seeSurfaceWithFullTarget);
// true
```

### Parsing IDs

`buildToLingConverters()` also exposes language-bound parsers. `parseSurface()` returns either a `Selection` for full surface IDs or an `ObservedSurface` for observed lemma IDs. `parseShallowSurface()` returns the shallow shell payload.

```ts
const { getSurfaceLingId, parseSurface } = buildToLingConverters("English");

const parsedWalkSurface = parseSurface(walkSurfaceId);

if ("surface" in parsedWalkSurface) {
	getSurfaceLingId(parsedWalkSurface) === walkSurfaceId;
	// true
}

const parsedWalkLemmaIdentity = parseSurface(walkLemmaId);

if (!("surface" in parsedWalkLemmaIdentity)) {
	getSurfaceLingId(parsedWalkLemmaIdentity) === walkLemmaId;
	// true
}
```
