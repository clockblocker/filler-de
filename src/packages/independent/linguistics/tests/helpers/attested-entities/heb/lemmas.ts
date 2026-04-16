import type { Lemma } from "../../../../src";

// Attestation: "הוא [כתב] מכתב."
export const hebrewKatavLemma = {
	canonicalLemma: "כתב",
	inherentFeatures: {
		hebBinyan: "PAAL",
	},
	language: "Hebrew",
	lemmaKind: "Lexeme",
	meaningInEmojis: "✍️",
	pos: "VERB",
} satisfies Lemma<"Hebrew", "Lexeme", "VERB">;

// Attestation: "עוד [שנה] עברה."
export const hebrewShanaLemma = {
	canonicalLemma: "שנה",
	inherentFeatures: {
		gender: "Fem",
	},
	language: "Hebrew",
	lemmaKind: "Lexeme",
	meaningInEmojis: "📅",
	pos: "NOUN",
} satisfies Lemma<"Hebrew", "Lexeme", "NOUN">;
