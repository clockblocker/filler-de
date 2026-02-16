import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "This fabric feels smooth after washing.",
			word: "smooth",
		},
		output: {
			tags: ["gradable", "descriptive"],
		},
	},
	{
		input: {
			context: "The final proposal sounds feasible.",
			word: "feasible",
		},
		output: {
			tags: ["non-gradable", "evaluative"],
		},
	},
] satisfies {
	input: UserInput<"FeaturesAdjective">;
	output: AgentOutput<"FeaturesAdjective">;
}[];
