import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "By and large, the rollout was successful.",
			target: {
				lemma: "by and large",
				linguisticUnit: "Phrasem",
				posLikeKind: "DiscourseFormula",
				surfaceKind: "Lemma",
			},
		},
		output: {
			emojiDescription: ["📊", "👍"],
			ipa: "baɪ ən lɑːrdʒ",
			linguisticUnit: "Phrasem",
			posLikeKind: "DiscourseFormula",
		},
	},
] satisfies {
	input: UserInput<"PhrasemEnrichment">;
	output: AgentOutput<"PhrasemEnrichment">;
}[];
