import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Er ging gestern in den Park.",
			surface: "ging",
		},
		output: {
			contextWithLinkedParts: undefined,
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
			contextWithLinkedParts: undefined,
			lemma: "Haus",
			linguisticUnit: "Lexem",
			posLikeKind: "Noun",
			surfaceKind: "Lemma",
		},
	},
	{
		input: {
			context:
				"Sie unterschreibt das Formular, und ihre Unterschrift steht schon unten.",
			surface: "Unterschrift",
		},
		output: {
			contextWithLinkedParts: undefined,
			lemma: "Unterschrift",
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
	{
		input: {
			context: "Er [macht] die Tür auf.",
			surface: "macht",
		},
		output: {
			contextWithLinkedParts: "Er [macht] die Tür [auf].",
			lemma: "aufmachen",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Inflected",
		},
	},
	{
		input: {
			context: "Wann [fängst] du damit an?",
			surface: "fängst",
		},
		output: {
			contextWithLinkedParts: "Wann [fängst] du damit [an]?",
			lemma: "anfangen",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Inflected",
		},
	},
	{
		input: {
			context: "Morgen wird es noch [schöner].",
			surface: "schöner",
		},
		output: {
			contextWithLinkedParts: undefined,
			lemma: "schön",
			linguisticUnit: "Lexem",
			posLikeKind: "Adjective",
			surfaceKind: "Inflected",
		},
	},
	{
		input: {
			context: "Sie ist [klüger] als ihr Bruder.",
			surface: "klüger",
		},
		output: {
			contextWithLinkedParts: undefined,
			lemma: "klug",
			linguisticUnit: "Lexem",
			posLikeKind: "Adjective",
			surfaceKind: "Inflected",
		},
	},
] satisfies {
	input: UserInput<"Lemma">;
	output: AgentOutput<"Lemma">;
}[];
