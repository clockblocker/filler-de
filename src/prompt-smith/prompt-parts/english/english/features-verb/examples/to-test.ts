import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "Please transfer the file before noon.",
			word: "transfer",
		},
		output: {
			tags: ["transitive", "dynamic"],
		},
	},
] satisfies {
	input: UserInput<"FeaturesVerb">;
	output: AgentOutput<"FeaturesVerb">;
}[];
