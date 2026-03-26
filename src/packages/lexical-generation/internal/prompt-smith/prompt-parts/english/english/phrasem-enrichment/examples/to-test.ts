import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "By and large, the rollout was successful.",
			kind: "DiscourseFormula",
			word: "by and large",
		},
		output: {
			emojiDescription: ["📊", "👍"],
			ipa: "baɪ ən lɑːrdʒ",
			senseGloss: "generally speaking",
		},
	},
] satisfies {
	input: UserInput<"PhrasemEnrichment">;
	output: AgentOutput<"PhrasemEnrichment">;
}[];
