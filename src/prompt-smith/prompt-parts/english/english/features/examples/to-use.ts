import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "The house is on the hill.",
			pos: "Noun",
			word: "house",
		},
		output: {
			tags: ["countable"],
		},
	},
	{
		input: {
			context: "She runs every morning.",
			pos: "Verb",
			word: "run",
		},
		output: {
			tags: ["intransitive", "irregular"],
		},
	},
] satisfies {
	input: UserInput<"Features">;
	output: AgentOutput<"Features">;
}[];
