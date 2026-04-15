/** biome-ignore-all lint/correctness/noUnusedVariables: README draft */
import { buildToLingConverters } from "./index";
import type {
	Lemma,
	ObservedSurface,
	ParsedShallowSurfaceDto,
	Selection,
} from "./index";

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
			canonicalLemma: "walk",
			inherentFeatures: {},
			language: "English",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🚶",
			pos: "VERB",
		},
	},
} satisfies Selection<"English", "Standard", "Inflection", "Lexeme", "VERB">;

// And the assigned lemma can be validated independently:

// `meaningInEmojis` is part of lemma identity and should describe the sense itself, not the literal imagery of the written form.

const simpleWalkLemma = {
	canonicalLemma: "walk",
	inherentFeatures: {},
	language: "English",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🚶",
	pos: "VERB",
} satisfies Lemma<"English", "Lexeme", "VERB">;

// Although mainly based on the work of UD, this model has a human student of a new language in mind and hence differs from UD in compounded linguistic units.

// For example, the model allows classifying the idiom in
//
// ```text
// This game was a [walk] in the park
// ```
//
// as part of the idiom "a walk in the park":

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

// The DTO separates three distinct things:

// - the actual highlighted text in the note: `spelledSelection`
// - the full orthographically normalized surface that the highlighted text belongs to: `normalizedFullSurface`
// - the lexical target that the surface resolves to: `target.canonicalLemma`

// In the examples below, the selections target the lemmas `give up` and `aufpassen`, while the realized normalized surfaces are `gave up` and `pass auf`.

// `surfaceKind: "Lemma"` means that the selection resolves directly to a lemma target. It does not mean that `normalizedFullSurface` itself is a lemma string.

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

// This allows for both:
//
// 1. pointing the user to the most meaningful target in the actual sentences
// 2. drilling down for the actual linguistics

// ## Ling IDs

// The package serializes stable surface-shaped Ling IDs. Lemma input is normalized into an observed-surface identity, so there is no separate top-level lemma ID format.

const walkLemma = {
	canonicalLemma: "walk",
	inherentFeatures: {},
	language: "English",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🚶",
	pos: "VERB",
} satisfies Lemma<"English", "Lexeme", "VERB">;

const {
	getSurfaceLingId: toEnglishSurfaceLingId,
	parseSurface,
} = buildToLingConverters("English");

const walkLemmaId = toEnglishSurfaceLingId(walkLemma);

const { getSurfaceLingId: toGermanSurfaceLingId } =
	buildToLingConverters("German");

const feminineSee = {
	canonicalLemma: "See",
	inherentFeatures: {
		gender: "Fem",
	},
	language: "German",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🌊",
	pos: "NOUN",
} satisfies Lemma<"German", "Lexeme", "NOUN">;

const neuterSee = {
	canonicalLemma: "See",
	inherentFeatures: {
		gender: "Neut",
	},
	language: "German",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🌊",
	pos: "NOUN",
} satisfies Lemma<"German", "Lexeme", "NOUN">;

const feminineSeeId = toGermanSurfaceLingId(feminineSee);
const neuterSeeId = toGermanSurfaceLingId(neuterSee);

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

const walkSurfaceId = toEnglishSurfaceLingId(walkSurfaceSelection);

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

const walkSurfaceWithCanonicalTargetId = toEnglishSurfaceLingId(
	walkSurfaceWithCanonicalTargetSelection,
);

const { getShallowSurfaceLingId: toGermanShallowSurfaceLingId } =
	buildToLingConverters("German");

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

const seeShallowIdsMatch =
	toGermanShallowSurfaceLingId(seeSurface) ===
	toGermanShallowSurfaceLingId(seeSurfaceWithFullTarget);

const parsedWalkSurface = parseSurface(walkSurfaceId);

if ("surface" in parsedWalkSurface) {
	const parsedWalkSurfaceRoundTrips =
		toEnglishSurfaceLingId(parsedWalkSurface) === walkSurfaceId;
}

const parsedWalkLemmaIdentity = parseSurface(walkLemmaId);

if (!("surface" in parsedWalkLemmaIdentity)) {
	const parsedWalkLemmaIdentityRoundTrips =
		toEnglishSurfaceLingId(parsedWalkLemmaIdentity) === walkLemmaId;
}
