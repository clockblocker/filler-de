import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Das Haus steht am Ende der Straße.",
			pos: "Noun",
			word: "Haus",
		},
		output: {
			article: "das",
			emoji: "🏠",
			ipa: "haʊ̯s",
		},
	},
	{
		input: {
			context: "Wir gehen morgen ins Kino.",
			pos: "Verb",
			word: "gehen",
		},
		output: {
			emoji: "🚶",
			ipa: "ˈɡeːən",
		},
	},
	{
		input: {
			context: "Ein Schmetterling flog über die Wiese.",
			pos: "Noun",
			word: "Schmetterling",
		},
		output: {
			article: "der",
			emoji: "🦋",
			ipa: "ˈʃmɛtɐlɪŋ",
		},
	},
	{
		input: {
			context: "Der schnelle Zug kam pünktlich an.",
			pos: "Adjective",
			word: "schnell",
		},
		output: {
			emoji: "⚡",
			ipa: "ʃnɛl",
		},
	},
] satisfies {
	input: UserInput<"Header">;
	output: AgentOutput<"Header">;
}[];
