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

// Attestation: "[ארה״ב] הודיעה על צעד חדש."
// UD-style: multi-word abbreviations keep the abbreviated form as canonicalLemma and mark Abbr=Yes.
// See https://universaldependencies.org/u/overview/morphology.html
export const hebrewUsAbbreviationLemma = {
	canonicalLemma: "ארה״ב",
	inherentFeatures: {
		abbr: "Yes",
	},
	language: "Hebrew",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🇺🇸",
	pos: "PROPN",
} satisfies Lemma<"Hebrew", "Lexeme", "PROPN">;
