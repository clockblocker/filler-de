/** biome-ignore-all lint/correctness/noUnusedVariables: README example file */

import type { Lemma } from "../../src";
import { buildToLingConverters } from "../../src";

// README_BLOCK:ling-id-resolved-walk:start
const walkLemma = {
	canonicalLemma: "walk",
	inherentFeatures: {},
	language: "English",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🚶",
	pos: "VERB",
} satisfies Lemma<"English", "Lexeme", "VERB">;

const { getSurfaceLingId: toEnglishSurfaceLingId } =
	buildToLingConverters("English");

const walkLemmaId = toEnglishSurfaceLingId(walkLemma);
// README_BLOCK:ling-id-resolved-walk:end

// README_BLOCK:ling-id-resolved-see:start
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

toGermanSurfaceLingId(feminineSee);
toGermanSurfaceLingId(neuterSee);
// README_BLOCK:ling-id-resolved-see:end
