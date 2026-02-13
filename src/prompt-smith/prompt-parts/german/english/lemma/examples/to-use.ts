import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Er ging gestern in den Park.",
			surface: "ging",
		},
		output: {
			emojiDescription: ["🚶"],
			ipa: "ˈɡeːən",
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
			emojiDescription: ["🏠"],
			ipa: "haʊ̯s",
			lemma: "Haus",
			linguisticUnit: "Lexem",
			nounClass: "Common",
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
			emojiDescription: ["✨"],
			ipa: "ʃøːn",
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
			emojiDescription: ["💡"],
			ipa: "ˈaʊ̯fˌfalən",
			lemma: "auffallen",
			linguisticUnit: "Lexem",
			pos: "Verb",
			surfaceKind: "Inflected",
		},
	},
	{
		input: {
			context: "Das machen wir auf jeden Fall morgen.",
			surface: "Fall",
		},
		output: {
			emojiDescription: ["✅"],
			ipa: "aʊ̯f ˈjeːdn̩ fal",
			lemma: "auf jeden Fall",
			linguisticUnit: "Phrasem",
			surfaceKind: "Lemma",
		},
	},
	{
		input: {
			context: "Die Deutsche Bank hat ihren Sitz in Frankfurt.",
			surface: "Bank",
		},
		output: {
			emojiDescription: ["🏦"],
			fullSurface: "Deutsche Bank",
			ipa: "ˈdɔʏ̯tʃə baŋk",
			lemma: "Deutsche Bank",
			linguisticUnit: "Lexem",
			nounClass: "Proper",
			pos: "Noun",
			surfaceKind: "Lemma",
		},
	},
	{
		input: {
			context: "Ich habe bei einer deutschen Bank ein Konto eröffnet.",
			surface: "Bank",
		},
		output: {
			emojiDescription: ["🏦", "💰"],
			ipa: "baŋk",
			lemma: "Bank",
			linguisticUnit: "Lexem",
			nounClass: "Common",
			pos: "Noun",
			surfaceKind: "Lemma",
		},
	},
	{
		input: {
			context: "Ich wohne in Berlin.",
			surface: "Berlin",
		},
		output: {
			emojiDescription: ["🐻", "🏙️"],
			ipa: "bɛʁˈliːn",
			lemma: "Berlin",
			linguisticUnit: "Lexem",
			nounClass: "Proper",
			pos: "Noun",
			surfaceKind: "Lemma",
		},
	},
] satisfies {
	input: UserInput<"Lemma">;
	output: AgentOutput<"Lemma">;
}[];
