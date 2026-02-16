import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
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
	{
		input: {
			context: "She relies on her team.",
			word: "rely",
		},
		output: {
			conjugation: "Rregular",
			valency: {
				governedPreposition: "on",
				reflexivity: "NonReflexive",
				separability: "None",
			},
		},
	},
] satisfies {
	input: UserInput<"FeaturesVerb">;
	output: AgentOutput<"FeaturesVerb">;
}[];
