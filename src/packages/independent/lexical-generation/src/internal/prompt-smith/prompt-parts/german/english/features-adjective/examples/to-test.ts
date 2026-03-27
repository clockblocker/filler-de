import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "Das ist ein sehr altes Haus.",
			word: "alt",
		},
		output: {
			classification: "Qualitative",
			distribution: "AttributiveAndPredicative",
			gradability: "Gradable",
			valency: {
				governedPattern: "None",
			},
		},
	},
] satisfies {
	input: UserInput<"FeaturesAdjective">;
	output: AgentOutput<"FeaturesAdjective">;
}[];
