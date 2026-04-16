import type { Lemma } from "../../../src";

export function buildGermanFeminineSeeLemma() {
	return {
		canonicalLemma: "See",
		inherentFeatures: {
			gender: "Fem",
		},
		language: "German",
		lemmaKind: "Lexeme",
		meaningInEmojis: "🌊",
		pos: "NOUN",
	} satisfies Lemma<"German", "Lexeme", "NOUN">;
}

export function buildEnglishWalkLemma() {
	return {
		canonicalLemma: "walk",
		inherentFeatures: {},
		language: "English",
		lemmaKind: "Lexeme",
		meaningInEmojis: "🚶",
		pos: "VERB",
	} satisfies Lemma<"English", "Lexeme", "VERB">;
}
