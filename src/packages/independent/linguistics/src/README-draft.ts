import type { Selection } from "./index";

// # `@textfresser/linguistics`

// Typesafe schemas and types for classifying linguistic units in text.

// The package models two closely related things:

// - `Selection`: a concrete surface form selected in text
// - `Lemma`: the normalized dictionary form assigned to that selection

// It currently exposes curated registries for `German` and `English`, plus a small relations API for lexical and morphological links.

// ## Core idea

// User reads:

// ```text
// I walk in the park
// ```

// They select:

// ```text
// I [walk] in the park
// ```

// That selection can be represented as a typed surface form:

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
			lemma: {
				canonicalLemma: "walk",
				inherentFeatures: {},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🚶",
				pos: "VERB",
			},
		},
	},
} satisfies Selection<"English", "Standard", "Inflection", "Lexeme", "VERB">;
