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
