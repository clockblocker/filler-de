import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "She went to the store yesterday.",
			surface: "went",
		},
		output: {
			contextWithLinkedParts: undefined,
			lemma: "go",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Inflected",
		},
	},
	{
		input: {
			context: "The house was painted blue.",
			surface: "house",
		},
		output: {
			contextWithLinkedParts: undefined,
			lemma: "house",
			linguisticUnit: "Lexem",
			posLikeKind: "Noun",
			surfaceKind: "Lemma",
		},
	},
	{
		input: {
			context: "I will, [by and] [large], agree with that.",
			surface: "large",
		},
		output: {
			contextWithLinkedParts: undefined,
			lemma: "by and large",
			linguisticUnit: "Phrasem",
			posLikeKind: "DiscourseFormula",
			surfaceKind: "Lemma",
		},
	},
] satisfies {
	input: UserInput<"Lemma">;
	output: AgentOutput<"Lemma">;
}[];
