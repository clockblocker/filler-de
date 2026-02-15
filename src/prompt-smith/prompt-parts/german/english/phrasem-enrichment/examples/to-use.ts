import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Das machen wir auf jeden Fall morgen.",
			target: {
				lemma: "auf jeden Fall",
				linguisticUnit: "Phrasem",
				posLikeKind: "DiscourseFormula",
				surfaceKind: "Lemma",
			},
		},
		output: {
			emojiDescription: ["✅"],
			ipa: "aʊ̯f ˈjeːdn̩ fal",
			linguisticUnit: "Phrasem",
			posLikeKind: "DiscourseFormula",
		},
	},
	{
		input: {
			context: "Er hat den Löffel abgegeben.",
			target: {
				lemma: "den Löffel abgeben",
				linguisticUnit: "Phrasem",
				posLikeKind: "Idiom",
				surfaceKind: "Lemma",
			},
		},
		output: {
			emojiDescription: ["💀"],
			ipa: "deːn ˈlœfl̩ ˈapɡeːbn̩",
			linguisticUnit: "Phrasem",
			posLikeKind: "Idiom",
		},
	},
] satisfies {
	input: UserInput<"PhrasemEnrichment">;
	output: AgentOutput<"PhrasemEnrichment">;
}[];
