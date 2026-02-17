import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "Das Haus steht am Ende der Straße.",
			target: {
				lemma: "Haus",
				linguisticUnit: "Lexem",
				posLikeKind: "Noun",
				surfaceKind: "Lemma",
			},
		},
		output: {
			emojiDescription: ["🏠"],
			genus: "Neutrum",
			ipa: "haʊ̯s",
			linguisticUnit: "Lexem",
			nounClass: "Common",
			posLikeKind: "Noun",
			senseGloss: "dwelling building",
		},
	},
] satisfies {
	input: UserInput<"LexemEnrichment">;
	output: AgentOutput<"LexemEnrichment">;
}[];
