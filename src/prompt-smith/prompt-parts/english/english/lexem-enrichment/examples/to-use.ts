import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "She runs every morning before work.",
			target: {
				lemma: "run",
				linguisticUnit: "Lexem",
				posLikeKind: "Verb",
				surfaceKind: "Lemma",
			},
		},
		output: {
			emojiDescription: ["🏃"],
			ipa: "rʌn",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
		},
	},
	{
		input: {
			context: "London remains a major financial center.",
			target: {
				lemma: "London",
				linguisticUnit: "Lexem",
				posLikeKind: "Noun",
				surfaceKind: "Lemma",
			},
		},
		output: {
			emojiDescription: ["🏙️"],
			ipa: "ˈlʌndən",
			linguisticUnit: "Lexem",
			nounClass: "Proper",
			posLikeKind: "Noun",
		},
	},
	{
		input: {
			context: "The ancient temple stands on the hill.",
			target: {
				lemma: "ancient",
				linguisticUnit: "Lexem",
				posLikeKind: "Adjective",
				surfaceKind: "Lemma",
			},
		},
		output: {
			emojiDescription: ["🏛️"],
			ipa: "ˈeɪnʃənt",
			linguisticUnit: "Lexem",
			posLikeKind: "Adjective",
		},
	},
] satisfies {
	input: UserInput<"LexemEnrichment">;
	output: AgentOutput<"LexemEnrichment">;
}[];
