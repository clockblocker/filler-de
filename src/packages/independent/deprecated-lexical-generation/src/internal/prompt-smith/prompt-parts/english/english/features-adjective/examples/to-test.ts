import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "This fabric feels smooth after washing.",
			word: "smooth",
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
