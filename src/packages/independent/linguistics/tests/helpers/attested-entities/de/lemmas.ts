import type { Lemma } from "../../../../src";

// Attestation: "Am Ufer des [Sees] war es still."
export const germanMasculineSeeLemma = {
	canonicalLemma: "See",
	inherentFeatures: {
		gender: "Masc",
	},
	language: "German",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🏞️",
	pos: "NOUN",
} satisfies Lemma<"German", "Lexeme", "NOUN">;

// Attestation: "Das [Kind] schlief schon."
export const germanKindLemma = {
	canonicalLemma: "Kind",
	inherentFeatures: {
		gender: "Neut",
	},
	language: "German",
	lemmaKind: "Lexeme",
	meaningInEmojis: "👶",
	pos: "NOUN",
} satisfies Lemma<"German", "Lexeme", "NOUN">;

// Attestation: "Das [Haus] steht leer."
export const germanHausLemma = {
	canonicalLemma: "Haus",
	inherentFeatures: {
		gender: "Neut",
	},
	language: "German",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🏠",
	pos: "NOUN",
} satisfies Lemma<"German", "Lexeme", "NOUN">;

// Attestation: "Wir [gehen] nach Hause."
export const germanGehenLemma = {
	canonicalLemma: "gehen",
	inherentFeatures: {},
	language: "German",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🚶",
	pos: "VERB",
} satisfies Lemma<"German", "Lexeme", "VERB">;

// Attestation: "In Berlin sowie im Umland (Agglomeration Berlin) betreibt die [BVG] die U-Bahn Berlin, die Straßenbahn Berlin, den Busverkehr in Berlin und den Fährverkehr in Berlin, nicht jedoch die S-Bahn."
// UD-style: multi-word abbreviations keep the abbreviated form as canonicalLemma and mark Abbr=Yes.
// See https://universaldependencies.org/u/overview/morphology.html
// We intentionally do not model a built-in link from "BVG" to "Berliner Verkehrsbetriebe" here.
export const germanBVGLemma = {
	canonicalLemma: "BVG",
	inherentFeatures: {
		abbr: "Yes",
	},
	language: "German",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🚇",
	pos: "PROPN",
} satisfies Lemma<"German", "Lexeme", "PROPN">;

// Attestation: "[Ab]fahrt nur am Gleis 3."
export const germanAbPrefixLemma = {
	canonicalLemma: "ab",
	language: "German",
	lemmaKind: "Morpheme",
	meaningInEmojis: "🧩",
	morphemeKind: "Prefix",
} satisfies Lemma<"German", "Morpheme", "Prefix">;
