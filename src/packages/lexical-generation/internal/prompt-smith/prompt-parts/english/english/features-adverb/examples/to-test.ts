import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "Er arbeitet heute draußen.",
			word: "draußen",
		},
		output: {
			tags: ["lokal"],
		},
	},
] satisfies {
	input: UserInput<"FeaturesAdverb">;
	output: AgentOutput<"FeaturesAdverb">;
}[];
