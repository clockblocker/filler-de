import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "[Pass] auf dich auf",
			surface: "Pass",
		},
		output: {
			contextWithLinkedParts: "[Pass] auf dich [auf]",
			emojiDescription: ["👀"],
			ipa: "ˈaʊ̯fˌpasn̩",
			lemma: "aufpassen",
			linguisticUnit: "Lexem",
			pos: "Verb",
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
			emojiDescription: ["▶️"],
			ipa: "ˈanˌfaŋən",
			lemma: "anfangen",
			linguisticUnit: "Lexem",
			pos: "Verb",
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
			emojiDescription: ["📞"],
			ipa: "ˈanˌʁuːfn̩",
			lemma: "anrufen",
			linguisticUnit: "Lexem",
			pos: "Verb",
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
			emojiDescription: ["✅"],
			ipa: "aʊ̯f ˈjeːdn̩ fal",
			lemma: "auf jeden Fall",
			linguisticUnit: "Phrasem",
			phrasemeKind: "DiscourseFormula",
			surfaceKind: "Lemma",
		},
	},
	{
		input: {
			context: "Mir ist [aufgefallen], dass er nicht da war.",
			surface: "aufgefallen",
		},
		output: {
			emojiDescription: ["💡"],
			ipa: "ˈaʊ̯fˌfalən",
			lemma: "auffallen",
			linguisticUnit: "Lexem",
			pos: "Verb",
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
			emojiDescription: ["🔧"],
			ipa: "ˈtsuːˌdʁeːən",
			lemma: "zudrehen",
			linguisticUnit: "Lexem",
			pos: "Verb",
			surfaceKind: "Inflected",
		},
	},
] satisfies {
	input: UserInput<"Lemma">;
	output: AgentOutput<"Lemma">;
}[];
