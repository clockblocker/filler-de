import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "She went to the store yesterday.",
			surface: "went",
		},
		output: {
			contextWithLinkedParts: "She went to the store yesterday.",
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
			contextWithLinkedParts: "The house was painted blue.",
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
			contextWithLinkedParts: "I will, [by and] [large], agree with that.",
			lemma: "by and large",
			linguisticUnit: "Phrasem",
			posLikeKind: "DiscourseFormula",
			surfaceKind: "Partial",
		},
	},
] satisfies {
	input: UserInput<"Lemma">;
	output: AgentOutput<"Lemma">;
}[];
