import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
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
	{
		input: {
			context: "Er ist stolz auf seine Tochter.",
			word: "stolz",
		},
		output: {
			classification: "Qualitative",
			distribution: "AttributiveAndPredicative",
			gradability: "Gradable",
			valency: {
				governedPattern: "Prepositional",
				governedPreposition: "auf",
			},
		},
	},
] satisfies {
	input: UserInput<"FeaturesAdjective">;
	output: AgentOutput<"FeaturesAdjective">;
}[];
