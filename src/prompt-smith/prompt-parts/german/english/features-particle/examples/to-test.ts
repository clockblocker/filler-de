import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "Das ist ja interessant.",
			word: "ja",
		},
		output: {
			tags: ["modal"],
		},
	},
] satisfies {
	input: UserInput<"FeaturesParticle">;
	output: AgentOutput<"FeaturesParticle">;
}[];
