import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "Das ist ein sehr altes Haus.",
			word: "alt",
		},
		output: {
			tags: ["steigerbar"],
		},
	},
] satisfies {
	input: UserInput<"FeaturesAdjective">;
	output: AgentOutput<"FeaturesAdjective">;
}[];
