import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "I went to the bank to withdraw money.",
			pos: "Noun",
			word: "bank",
		},
		output: {
			semantics: "financial institution",
		},
	},
	{
		input: {
			context: "We sat on the bank of the river.",
			pos: "Noun",
			word: "bank",
		},
		output: {
			semantics: "riverbank",
		},
	},
	{
		input: {
			context: "She ran a successful company.",
			pos: "Verb",
			word: "run",
		},
		output: {
			semantics: "manage",
		},
	},
] satisfies {
	input: UserInput<"Semantics">;
	output: AgentOutput<"Semantics">;
}[];
