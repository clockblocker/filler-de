import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Er ging gestern in den Park.",
			target: {
				lemma: "gehen",
				linguisticUnit: "Lexem",
				posLikeKind: "Verb",
				surfaceKind: "Inflected",
			},
		},
		output: {
			emojiDescription: ["🚶"],
			ipa: "ˈɡeːən",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			senseGloss: "to walk",
		},
	},
	{
		input: {
			context: "Die Deutsche Bank hat ihren Sitz in Frankfurt.",
			target: {
				lemma: "Deutsche Bank",
				linguisticUnit: "Lexem",
				posLikeKind: "Noun",
				surfaceKind: "Lemma",
			},
		},
		output: {
			emojiDescription: ["🏦"],
			genus: "Femininum",
			ipa: "ˈdɔʏ̯tʃə baŋk",
			linguisticUnit: "Lexem",
			nounClass: "Proper",
			posLikeKind: "Noun",
			senseGloss: "financial institution",
		},
	},
] satisfies {
	input: UserInput<"LexemEnrichment">;
	output: AgentOutput<"LexemEnrichment">;
}[];
