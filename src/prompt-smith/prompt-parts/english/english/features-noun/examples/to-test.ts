import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "The committee approved the budget yesterday.",
			word: "committee",
		},
		output: {
			tags: ["countable", "collective"],
		},
	},
] satisfies {
	input: UserInput<"FeaturesNoun">;
	output: AgentOutput<"FeaturesNoun">;
}[];
