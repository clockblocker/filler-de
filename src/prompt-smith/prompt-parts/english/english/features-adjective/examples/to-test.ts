import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "This fabric feels smooth after washing.",
			word: "smooth",
		},
		output: {
			tags: ["gradable", "descriptive"],
		},
	},
] satisfies {
	input: UserInput<"FeaturesAdjective">;
	output: AgentOutput<"FeaturesAdjective">;
}[];
