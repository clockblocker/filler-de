import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Please transfer the file before noon.",
			word: "transfer",
		},
		output: {
			tags: ["transitive", "dynamic"],
		},
	},
	{
		input: {
			context: "We carried on despite the heavy rain.",
			word: "carry on",
		},
		output: {
			tags: ["phrasal", "intransitive"],
		},
	},
] satisfies {
	input: UserInput<"FeaturesVerb">;
	output: AgentOutput<"FeaturesVerb">;
}[];
