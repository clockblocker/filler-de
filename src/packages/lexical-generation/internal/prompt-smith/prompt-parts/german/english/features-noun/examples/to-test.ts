import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "Die Deutsche Bank hat ihren Sitz in Frankfurt.",
			word: "Deutsche Bank",
		},
		output: {
			tags: ["feminin", "proper"],
		},
	},
] satisfies {
	input: UserInput<"FeaturesNoun">;
	output: AgentOutput<"FeaturesNoun">;
}[];
