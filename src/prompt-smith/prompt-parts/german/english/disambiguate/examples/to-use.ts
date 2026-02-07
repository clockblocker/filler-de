import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Er setzte sich auf die Bank im Park.",
			lemma: "Bank",
			senses: [
				{
					emojiDescription: ["🏦"],
					genus: "Femininum",
					index: 1,
					pos: "Noun",
					unitKind: "Lexem",
				},
			],
		},
		output: {
			emojiDescription: ["🪑", "🌳"],
			matchedIndex: null,
		},
	},
	{
		input: {
			context: "Ich muss zur Bank, um Geld abzuheben.",
			lemma: "Bank",
			senses: [
				{
					emojiDescription: ["🏦"],
					genus: "Femininum",
					index: 1,
					pos: "Noun",
					unitKind: "Lexem",
				},
				{
					emojiDescription: ["🪑", "🌳"],
					genus: "Femininum",
					index: 2,
					pos: "Noun",
					unitKind: "Lexem",
				},
			],
		},
		output: {
			matchedIndex: 1,
		},
	},
	{
		input: {
			context: "Das Schloss an der Tür war kaputt.",
			lemma: "Schloss",
			senses: [
				{
					emojiDescription: ["🏰"],
					genus: "Neutrum",
					index: 1,
					pos: "Noun",
					unitKind: "Lexem",
				},
			],
		},
		output: {
			emojiDescription: ["🔒"],
			matchedIndex: null,
		},
	},
	{
		input: {
			context: "Wir besichtigten das Schloss am Rhein.",
			lemma: "Schloss",
			senses: [
				{
					emojiDescription: ["🏰"],
					genus: "Neutrum",
					index: 1,
					pos: "Noun",
					unitKind: "Lexem",
				},
				{
					emojiDescription: ["🔒"],
					genus: "Neutrum",
					index: 2,
					pos: "Noun",
					unitKind: "Lexem",
				},
			],
		},
		output: {
			matchedIndex: 1,
		},
	},
	{
		input: {
			context: "Das Schloss am Fahrrad war aufgebrochen.",
			lemma: "Schloss",
			senses: [
				{
					emojiDescription: ["🏰"],
					genus: "Neutrum",
					index: 1,
					pos: "Noun",
					unitKind: "Lexem",
				},
			],
		},
		output: {
			emojiDescription: ["🔒"],
			matchedIndex: null,
		},
	},
] satisfies {
	input: UserInput<"Disambiguate">;
	output: AgentOutput<"Disambiguate">;
}[];
