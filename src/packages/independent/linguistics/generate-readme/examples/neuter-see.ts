/** biome-ignore-all lint/correctness/noUnusedVariables: example file */
import type { Lemma } from "../../src";

// Block-start
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
// Block-end
