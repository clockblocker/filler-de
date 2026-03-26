import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Ich gehe mit meinem Freund spazieren.",
			word: "mit",
		},
		output: {
			tags: ["dativ"],
		},
	},
] satisfies {
	input: UserInput<"FeaturesPreposition">;
	output: AgentOutput<"FeaturesPreposition">;
}[];
