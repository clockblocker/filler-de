import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Er ging gestern in den Park.",
			surface: "ging",
		},
		output: {
			lemma: "gehen",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Inflected",
		},
	},
	{
		input: {
			context: "Das Haus steht am Ende der Straße.",
			surface: "Haus",
		},
		output: {
			lemma: "Haus",
			linguisticUnit: "Lexem",
			posLikeKind: "Noun",
			surfaceKind: "Lemma",
		},
	},
	{
		input: {
			context: "Das machen wir auf jeden [Fall] morgen.",
			surface: "Fall",
		},
		output: {
			contextWithLinkedParts:
				"Das machen wir [auf] [jeden] [Fall] morgen.",
			lemma: "auf jeden Fall",
			linguisticUnit: "Phrasem",
			posLikeKind: "DiscourseFormula",
			surfaceKind: "Lemma",
		},
	},
	{
		input: {
			context: "[Pass] auf dich auf",
			surface: "Pass",
		},
		output: {
			contextWithLinkedParts: "[Pass] auf dich [auf]",
			lemma: "aufpassen",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Inflected",
		},
	},
] satisfies {
	input: UserInput<"Lemma">;
	output: AgentOutput<"Lemma">;
}[];
