import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "I went to the bank to withdraw money.",
			pos: "Noun",
			word: "bank",
		},
		output: "financial institution",
	},
	{
		input: {
			context: "He sat on the bank of the river.",
			pos: "Noun",
			word: "bank",
		},
		output: "shore",
	},
	{
		input: {
			context: "She ran to catch the bus.",
			pos: "Verb",
			word: "run",
		},
		output: "to sprint",
	},
] satisfies {
	input: UserInput<"WordTranslation">;
	output: AgentOutput<"WordTranslation">;
}[];
