import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Hallo, wie geht es dir?",
			word: "hallo",
		},
		output: {
			tags: ["grußformel"],
		},
	},
] satisfies {
	input: UserInput<"FeaturesInteractionalUnit">;
	output: AgentOutput<"FeaturesInteractionalUnit">;
}[];
