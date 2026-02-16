import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "The committee approved the budget yesterday.",
			word: "committee",
		},
		output: {
			tags: ["countable", "collective"],
		},
	},
	{
		input: {
			context: "Oxford University announced a new scholarship.",
			word: "Oxford University",
		},
		output: {
			tags: ["proper", "institution"],
		},
	},
] satisfies {
	input: UserInput<"FeaturesNoun">;
	output: AgentOutput<"FeaturesNoun">;
}[];
