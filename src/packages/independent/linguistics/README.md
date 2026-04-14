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
		surface: {
			inflectionalFeatures: {
				tense: "Pres",
				verbForm: "Fin",
			},
			lemma: {
				meaningInEmojis: "🚶",
				inherentFeatures: {},
				language: "English",
				lemmaKind: "Lexeme",
				pos: "VERB",
				spelledLemma: "walk",
			},
			spelledSurface: "walk",
			surfaceKind: "Lemma", // inflectionalFeatures match the base form for eng verbs
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
	spelledLemma: "walk",
});
```

Altough mainly based on the work of UD, this model has a human student of a new language in mind and hence differs from UD in compoumeded ling units.

For example, the model allows to classify the idiom in
```text
This game was a [walk] in the park
```

as a part of Idiom "a walk in the park":

```ts
const idiomPartSelection = SelectionSchema.English.Standard.Partial.Phraseme.Idiom.parse(
	{
		language: "English",
		orthographicStatus: "Standard",
		surface: {
			lemma: {
				meaningInEmojis: "😌👌",
				language: "English",
				lemmaKind: "Phraseme",
				phrasemeKind: "Idiom",
				spelledLemma: "a walk in the park",
			},
			spelledSurface: "walk",
			surfaceKind: "Partial",
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
