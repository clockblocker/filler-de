import type { ResolvedSurface, Surface, UnresolvedSurface } from "../../../src";
import { englishWalkLemma, germanHausLemma } from "./lemmas";

// Attestation: "They [walk] home together."
export const englishWalkResolvedInflectionSurface = {
	discriminators: {
		lemmaKind: "Lexeme",
		lemmaSubKind: "VERB",
	},
	inflectionalFeatures: {
		tense: "Pres",
		verbForm: "Fin",
	},
	language: "English",
	normalizedFullSurface: "walk",
	surfaceKind: "Inflection",
	target: englishWalkLemma,
} satisfies ResolvedSurface<
	"English",
	"Standard",
	"Inflection",
	"Lexeme",
	"VERB"
>;

// Attestation: "They [walk] home together."
export const englishWalkUnresolvedInflectionSurface = {
	discriminators: {
		lemmaKind: "Lexeme",
		lemmaSubKind: "VERB",
	},
	inflectionalFeatures: {
		tense: "Pres",
		verbForm: "Fin",
	},
	language: "English",
	normalizedFullSurface: "walk",
	surfaceKind: "Inflection",
	target: {
		canonicalLemma: "walk",
	},
} satisfies UnresolvedSurface<
	"English",
	"Standard",
	"Inflection",
	"Lexeme",
	"VERB"
>;

// Attestation: "They [walk] home together."
export const englishWalkResolvedLemmaSurface = {
	discriminators: {
		lemmaKind: "Lexeme",
		lemmaSubKind: "VERB",
	},
	language: "English",
	normalizedFullSurface: "walk",
	surfaceKind: "Lemma",
	target: englishWalkLemma,
} satisfies ResolvedSurface<"English", "Standard", "Lemma", "Lexeme", "VERB">;

// Attestation: "They [walk] home together."
export const englishWalkUnresolvedLemmaSurface = {
	discriminators: {
		lemmaKind: "Lexeme",
		lemmaSubKind: "VERB",
	},
	language: "English",
	normalizedFullSurface: "walk",
	surfaceKind: "Lemma",
	target: {
		canonicalLemma: "walk",
	},
} satisfies Surface<"English", "Standard", "Lemma", "Lexeme", "VERB">;

// Attestation: "Mark gvae [up] on it."
export const englishGiveUpTypoUnresolvedInflectionSurface = {
	discriminators: {
		lemmaKind: "Lexeme",
		lemmaSubKind: "VERB",
	},
	inflectionalFeatures: {
		tense: "Past",
		verbForm: "Fin",
	},
	language: "English",
	normalizedFullSurface: "gave up",
	surfaceKind: "Inflection",
	target: {
		canonicalLemma: "give up",
	},
} satisfies UnresolvedSurface<
	"English",
	"Typo",
	"Inflection",
	"Lexeme",
	"VERB"
>;

// Attestation: "Das [Haus] steht leer."
export const germanHausResolvedLemmaSurface = {
	discriminators: {
		lemmaKind: "Lexeme",
		lemmaSubKind: "NOUN",
	},
	language: "German",
	normalizedFullSurface: "Haus",
	surfaceKind: "Lemma",
	target: germanHausLemma,
} satisfies ResolvedSurface<"German", "Standard", "Lemma", "Lexeme", "NOUN">;
