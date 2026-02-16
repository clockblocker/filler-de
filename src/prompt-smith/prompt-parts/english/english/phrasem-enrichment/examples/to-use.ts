import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
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
	{
		input: {
			context: "After three hours of meetings, we called it a day.",
			target: {
				lemma: "call it a day",
				linguisticUnit: "Phrasem",
				posLikeKind: "Idiom",
				surfaceKind: "Lemma",
			},
		},
		output: {
			emojiDescription: ["🛑", "📅"],
			ipa: "kɔːl ɪt ə deɪ",
			linguisticUnit: "Phrasem",
			posLikeKind: "Idiom",
		},
	},
] satisfies {
	input: UserInput<"PhrasemEnrichment">;
	output: AgentOutput<"PhrasemEnrichment">;
}[];
