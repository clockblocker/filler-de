import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "Kannst du bitte die Tür aufmachen?",
			word: "aufmachen",
		},
		output: {
			conjugation: "Regular",
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
