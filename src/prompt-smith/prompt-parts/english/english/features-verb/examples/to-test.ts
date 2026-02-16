import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "Can you open the door, please?",
			word: "open up",
		},
		output: {
			conjugation: "Rregular",
			valency: {
				reflexivity: "NonReflexive",
				separability: "Separable",
			},
		},
	},
] satisfies {
	input: UserInput<"FeaturesVerb">;
	output: AgentOutput<"FeaturesVerb">;
}[];
