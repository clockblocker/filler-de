import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Kannst du bitte die Tür aufmachen?",
			word: "aufmachen",
		},
		output: {
			tags: ["transitiv", "trennbar"],
		},
	},
] satisfies {
	input: UserInput<"FeaturesVerb">;
	output: AgentOutput<"FeaturesVerb">;
}[];
