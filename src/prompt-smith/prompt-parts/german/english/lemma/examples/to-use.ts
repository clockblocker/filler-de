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
			pos: "Verb",
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
			pos: "Noun",
			surfaceKind: "Lemma",
		},
	},
	{
		input: {
			context: "Ein schönes Bild hing an der Wand.",
			surface: "schönes",
		},
		output: {
			lemma: "schön",
			linguisticUnit: "Lexem",
			pos: "Adjective",
			surfaceKind: "Inflected",
		},
	},
	{
		input: {
			context: "Mir ist aufgefallen, dass er nicht da war.",
			surface: "aufgefallen",
		},
		output: {
			lemma: "auffallen",
			linguisticUnit: "Lexem",
			pos: "Verb",
			surfaceKind: "Inflected",
		},
	},
	{
		input: {
			context: "Das machen wir auf jeden Fall morgen.",
			surface: "auf jeden Fall",
		},
		output: {
			lemma: "auf jeden Fall",
			linguisticUnit: "Phrasem",
			surfaceKind: "Lemma",
		},
	},
] satisfies {
	input: UserInput<"Lemma">;
	output: AgentOutput<"Lemma">;
}[];
