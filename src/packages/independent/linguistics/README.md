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
import { SelectionSchema } from "@textfresser/linguistics";

const simpleWalkSelection = SelectionSchema.English.Standard.Inflection.Lexeme.VERB.parse(
	{
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
			target: {
				lemma: {
					meaningInEmojis: "🚶",
					inherentFeatures: {},
					language: "English",
					lemmaKind: "Lexeme",
					pos: "VERB",
					canonicalLemma: "walk",
				},
			},
			normalizedFullSurface: "walk",
			surfaceKind: "Inflection",
		},
	},
);
```

And the assigned lemma can be validated independently:

`meaningInEmojis` is part of lemma identity and should describe the sense itself, not the literal imagery of the written form.

```ts
import { LemmaSchema } from "@textfresser/linguistics";

const simpleWalkLemma = LemmaSchema.English.Lexeme.VERB.parse({
	meaningInEmojis: "🚶",
	inherentFeatures: {},
	language: "English",
	lemmaKind: "Lexeme",
	pos: "VERB",
	canonicalLemma: "walk",
});
```

Altough mainly based on the work of UD, this model has a human student of a new language in mind and hence differs from UD in compoumeded ling units.

For example, the model allows to classify the idiom in
```text
This game was a [walk] in the park
```

as a part of Idiom "a walk in the park":

```ts
const idiomPartSelection = SelectionSchema.English.Standard.Lemma.Phraseme.Idiom.parse(
	{
		language: "English",
		orthographicStatus: "Standard",
		spelledSelection: "walk",
		surface: {
			discriminators: {
				lemmaKind: "Phraseme",
				lemmaSubKind: "Idiom",
			},
			target: {
				lemma: {
					meaningInEmojis: "😌👌",
					language: "English",
					lemmaKind: "Phraseme",
					phrasemeKind: "Idiom",
					canonicalLemma: "a walk in the park",
				},
			},
			normalizedFullSurface: "a walk in the park",
			surfaceKind: "Lemma",
		},
	},
);
```

The DTO now separates the actual highlighted text from the full orthographically normalized surface:

```ts
const gaveUpSelection = SelectionSchema.English.Standard.Lemma.Lexeme.VERB.parse(
	{
		language: "English",
		orthographicStatus: "Standard",
		spelledSelection: "gave",
		surface: {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
			target: {
				canonicalLemma: "give up",
			},
			normalizedFullSurface: "gave up",
			surfaceKind: "Lemma",
		},
	},
);

const passAufSelection = SelectionSchema.German.Standard.Lemma.Lexeme.VERB.parse(
	{
		language: "German",
		orthographicStatus: "Standard",
		spelledSelection: "Pass",
		surface: {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
			target: {
				canonicalLemma: "aufpassen",
			},
			normalizedFullSurface: "pass auf",
			surfaceKind: "Lemma",
		},
	},
);
```

This allows for both: 
1) pointing the user to the most meaninful target in the actual sentenes:
```
(text reading mode on)
Hans, [Pass] auf dich auf! -> aufpassen (VERB)
Hans, Pass [auf] dich auf! -> aufpassen (VERB)
Hans, Pass auf [dich] auf! -> du (PRON)
Hans, Pass auf dich [auf]! -> aufpassen
```

2) drilling down for the actual linguistics:
``` 
(linguistic investigation mode on)
Hans, [Pass] auf dich auf! -> `root` (VERB)
Hans, Pass [auf] dich auf! -> `auf` (ADP)
Hans, Pass auf [dich] auf! -> `du` (PRON)
Hans, Pass auf dich [auf]! -> `auf` (PRT)
```

## Ling IDs

The package can also serialize lemmas and surfaces into stable Ling IDs.

### Lemma IDs

```ts
import {
	buildToLemmaLingIdFor,
	LemmaSchema,
} from "@textfresser/linguistics";

const walkLemma = LemmaSchema.English.Lexeme.VERB.parse({
	meaningInEmojis: "🚶",
	inherentFeatures: {},
	language: "English",
	lemmaKind: "Lexeme",
	pos: "VERB",
	canonicalLemma: "walk",
});

const toEnglishLemmaLingId = buildToLemmaLingIdFor("English");

const walkLemmaId = toEnglishLemmaLingId(walkLemma);
// "ling:v1:EN:LEM;walk;Lexeme;VERB;-;🚶"
```

German lemma identity includes inherent features:

```ts
import {
	buildToLemmaLingIdFor,
	LemmaSchema,
} from "@textfresser/linguistics";

const toGermanLemmaLingId = buildToLemmaLingIdFor("German");

const feminineSee = LemmaSchema.German.Lexeme.NOUN.parse({
	canonicalLemma: "See",
	inherentFeatures: { gender: "Fem" },
	language: "German",
	lemmaKind: "Lexeme",
	pos: "NOUN",
});

const neuterSee = LemmaSchema.German.Lexeme.NOUN.parse({
	canonicalLemma: "See",
	inherentFeatures: { gender: "Neut" },
	language: "German",
	lemmaKind: "Lexeme",
	pos: "NOUN",
});

toGermanLemmaLingId(feminineSee);
// "ling:v1:DE:LEM;See;Lexeme;NOUN;gender=Fem;-"

toGermanLemmaLingId(neuterSee);
// "ling:v1:DE:LEM;See;Lexeme;NOUN;gender=Neut;-"
```

### Full Surface IDs

Full surface IDs preserve target richness.

```ts
import {
	buildToSurfaceLingIdFor,
} from "@textfresser/linguistics";

const toEnglishSurfaceLingId = buildToSurfaceLingIdFor("English");

const walkSurfaceId = toEnglishSurfaceLingId({
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
// "ling:v1:EN:SURF;walk;Standard;Inflection;Lexeme;VERB;tense=Pres,verbForm=Fin;lemma;ling%3Av1%3AEN%3ALEM%3Bwalk%3BLexeme%3BVERB%3B%2D%3B%F0%9F%9A%B6"
```

If the target is shallow, the full surface ID changes:

```ts
const walkSurfaceWithCanonicalTargetId = toEnglishSurfaceLingId({
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
		canonicalLemma: "walk",
	},
});
// "ling:v1:EN:SURF;walk;Standard;Inflection;Lexeme;VERB;tense=Pres,verbForm=Fin;canon;walk"
```

### Shallow Surface IDs

Use shallow surface IDs when you want to compare form identity while ignoring
target richness.

```ts
import {
	buildToShallowSurfaceLingIdFor,
} from "@textfresser/linguistics";

const toGermanShallowSurfaceLingId = buildToShallowSurfaceLingIdFor("German");

const seeSurface = {
	discriminators: {
		lemmaKind: "Lexeme",
		lemmaSubKind: "NOUN",
	},
	normalizedFullSurface: "See",
	orthographicStatus: "Standard",
	surfaceKind: "Lemma",
	target: {
		canonicalLemma: "See",
	},
};

const seeSurfaceWithFullTarget = {
	...seeSurface,
	target: {
		lemma: feminineSee,
	},
};

toGermanShallowSurfaceLingId(seeSurface) ===
	toGermanShallowSurfaceLingId(seeSurfaceWithFullTarget);
// true
```

### Parsing IDs

`parseLingId()` returns a plain distilled DTO. You can serialize it again
directly, or feed it into the exported schemas.

```ts
import {
	buildToLemmaLingIdFor,
	LemmaSchema,
	parseLingId,
} from "@textfresser/linguistics";

const parsedWalkLemma = parseLingId(walkLemmaId);

const reparsedWalkLemma = LemmaSchema.English.Lexeme.VERB.parse(parsedWalkLemma);

buildToLemmaLingIdFor("English")(reparsedWalkLemma) === walkLemmaId;
// true
```
