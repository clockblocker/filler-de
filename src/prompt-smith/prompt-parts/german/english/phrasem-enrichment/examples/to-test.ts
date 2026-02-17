import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
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
			senseGloss: "definitely / certainly",
		},
	},
] satisfies {
	input: UserInput<"PhrasemEnrichment">;
	output: AgentOutput<"PhrasemEnrichment">;
}[];
