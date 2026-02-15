import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
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
	{
		input: {
			context: "Sie [fängt] morgen mit der Arbeit an",
			surface: "fängt",
		},
		output: {
			contextWithLinkedParts: "Sie [fängt] morgen mit der Arbeit [an]",
			lemma: "anfangen",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Inflected",
		},
	},
	{
		input: {
			context: "Er [rief] seine Mutter an",
			surface: "rief",
		},
		output: {
			contextWithLinkedParts: "Er [rief] seine Mutter [an]",
			lemma: "anrufen",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Inflected",
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
			context: "Mir ist [aufgefallen], dass er nicht da war.",
			surface: "aufgefallen",
		},
		output: {
			lemma: "auffallen",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Inflected",
		},
	},
	// ─── Novel example (NOT in training data) ───
	{
		input: {
			context: "Ich [drehe] den Wasserhahn zu",
			surface: "drehe",
		},
		output: {
			contextWithLinkedParts: "Ich [drehe] den Wasserhahn [zu]",
			lemma: "zudrehen",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Inflected",
		},
	},
] satisfies {
	input: UserInput<"Lemma">;
	output: AgentOutput<"Lemma">;
}[];
