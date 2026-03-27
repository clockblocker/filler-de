import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Der Hund schläft.",
			word: "der",
		},
		output: {
			tags: ["definit"],
		},
	},
] satisfies {
	input: UserInput<"FeaturesArticle">;
	output: AgentOutput<"FeaturesArticle">;
}[];
