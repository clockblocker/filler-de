import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "I went to the bank to withdraw money.",
			lemma: "bank",
			senses: [{ index: 1, semantics: "riverbank" }],
		},
		output: {
			matchedIndex: null,
		},
	},
	{
		input: {
			context: "We sat on the bank of the river.",
			lemma: "bank",
			senses: [
				{ index: 1, semantics: "riverbank" },
				{ index: 2, semantics: "financial institution" },
			],
		},
		output: {
			matchedIndex: 1,
		},
	},
] satisfies {
	input: UserInput<"Disambiguate">;
	output: AgentOutput<"Disambiguate">;
}[];
