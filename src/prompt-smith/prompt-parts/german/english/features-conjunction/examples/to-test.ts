import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "Ich bleibe zu Hause, weil es regnet.",
			word: "weil",
		},
		output: {
			tags: ["subordinierend"],
		},
	},
] satisfies {
	input: UserInput<"FeaturesConjunction">;
	output: AgentOutput<"FeaturesConjunction">;
}[];
