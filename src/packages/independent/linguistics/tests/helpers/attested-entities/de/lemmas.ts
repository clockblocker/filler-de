import type { Lemma } from "../../../../src";

// Attestation: "Am Ufer des [Sees] war es still."
export const germanFeminineSeeLemma = {
	canonicalLemma: "See",
	inherentFeatures: {
		gender: "Fem",
	},
	language: "German",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🌊",
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

// Attestation: "[Ab]fahrt nur am Gleis 3."
export const germanAbPrefixLemma = {
	canonicalLemma: "ab",
	language: "German",
	lemmaKind: "Morpheme",
	meaningInEmojis: "🧩",
	morphemeKind: "Prefix",
} satisfies Lemma<"German", "Morpheme", "Prefix">;
