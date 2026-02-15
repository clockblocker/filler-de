import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "She went to the store yesterday.",
			surface: "went",
		},
		output: {
			emojiDescription: ["🚶"],
			ipa: "ɡoʊ",
			lemma: "go",
			linguisticUnit: "Lexem",
			pos: "Verb",
			surfaceKind: "Inflected",
		},
	},
	{
		input: {
			context: "The house was painted blue.",
			surface: "house",
		},
		output: {
			emojiDescription: ["🏠"],
			ipa: "haʊs",
			lemma: "house",
			linguisticUnit: "Lexem",
			pos: "Noun",
			surfaceKind: "Lemma",
		},
	},
	{
		input: {
			context: "I will, [by and] [large], agree with that.",
			surface: "large",
		},
		output: {
			emojiDescription: ["📊"],
			ipa: "baɪ ən lɑrdʒ",
			lemma: "by and large",
			linguisticUnit: "Phrasem",
			phrasemeKind: "DiscourseFormula",
			surfaceKind: "Lemma",
		},
	},
] satisfies {
	input: UserInput<"Lemma">;
	output: AgentOutput<"Lemma">;
}[];
