import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Kannst du bitte die Tür aufmachen?",
			word: "aufmachen",
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
			context: "Ich kümmere mich um die Kinder.",
			word: "sich kümmern",
		},
		output: {
			conjugation: "Rregular",
			valency: {
				governedPreposition: "um",
				reflexivity: "ReflexiveOnly",
				separability: "None",
			},
		},
	},
] satisfies {
	input: UserInput<"FeaturesVerb">;
	output: AgentOutput<"FeaturesVerb">;
}[];
