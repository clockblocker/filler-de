import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "She went to the store yesterday.",
			surface: "went",
		},
		output: {
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
			lemma: "house",
			linguisticUnit: "Lexem",
			pos: "Noun",
			surfaceKind: "Lemma",
		},
	},
] satisfies {
	input: UserInput<"Lemma">;
	output: AgentOutput<"Lemma">;
}[];
