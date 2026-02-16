import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
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
	{
		input: {
			context: "She is proud of her work.",
			word: "proud",
		},
		output: {
			classification: "Qualitative",
			distribution: "AttributiveAndPredicative",
			gradability: "Gradable",
			valency: {
				governedPattern: "Prepositional",
				governedPreposition: "of",
			},
		},
	},
] satisfies {
	input: UserInput<"FeaturesAdjective">;
	output: AgentOutput<"FeaturesAdjective">;
}[];
