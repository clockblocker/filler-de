import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Ich habe es gestern gesehen.",
			word: "es",
		},
		output: {
			tags: ["personal"],
		},
	},
] satisfies {
	input: UserInput<"FeaturesPronoun">;
	output: AgentOutput<"FeaturesPronoun">;
}[];
