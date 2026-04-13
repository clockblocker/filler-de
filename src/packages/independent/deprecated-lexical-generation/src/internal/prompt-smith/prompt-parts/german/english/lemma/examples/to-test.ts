import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
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
			context: "Sie [kauft] im Supermarkt ein.",
			surface: "kauft",
		},
		output: {
			contextWithLinkedParts: "Sie [kauft] im Supermarkt [ein].",
			lemma: "einkaufen",
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
			context: "Mir ist [aufgefallen], dass er nicht da war.",
			surface: "aufgefallen",
		},
		output: {
			contextWithLinkedParts: "Mir ist [aufgefallen], dass er nicht da war.",
			lemma: "auffallen",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Inflected",
		},
	},
	{
		input: {
			context:
				"Die Dursleys [besaßen] alles, was sie wollten, doch sie hatten auch ein Geheimnis, und dass es jemand aufdecken könnte, war ihre größte Sorge.",
			surface: "besaßen",
		},
		output: {
			contextWithLinkedParts:
				"Die Dursleys [besaßen] alles, was sie wollten, doch sie hatten auch ein Geheimnis, und dass es jemand aufdecken könnte, war ihre größte Sorge.",
			lemma: "besitzen",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Inflected",
		},
	},
	{
		input: {
			context:
				"Die Dursleys besaßen alles, was sie wollten, doch sie hatten auch ein Geheimnis, und dass es jemand aufdecken könnte, war ihre größte [Sorge].",
			surface: "Sorge",
		},
		output: {
			contextWithLinkedParts:
				"Die Dursleys besaßen alles, was sie wollten, doch sie hatten auch ein Geheimnis, und dass es jemand aufdecken könnte, war ihre größte [Sorge].",
			lemma: "Sorge",
			linguisticUnit: "Lexem",
			posLikeKind: "Noun",
			surfaceKind: "Lemma",
		},
	},
	{
		input: {
			context:
				"„Du bekommst ja dein Budget. Und jetzt hör auf, mir Honig um den Bart zu [schmieren].",
			surface: "schmieren",
		},
		output: {
			contextWithLinkedParts:
				"„Du bekommst ja dein Budget. Und jetzt hör auf, mir [Honig] um den [Bart] zu [schmieren].",
			lemma: "Honig um den Bart schmieren",
			linguisticUnit: "Phrasem",
			posLikeKind: "Idiom",
			surfaceKind: "Partial",
		},
	},
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
