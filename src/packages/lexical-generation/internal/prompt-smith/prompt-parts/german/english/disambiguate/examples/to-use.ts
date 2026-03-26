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
					senseGloss: "financial institution",
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
					senseGloss: "financial institution",
					unitKind: "Lexem",
				},
				{
					emojiDescription: ["🪑", "🌳"],
					genus: "Femininum",
					index: 2,
					pos: "Noun",
					senseGloss: "bench seat",
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
					senseGloss: "castle palace",
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
					senseGloss: "castle palace",
					unitKind: "Lexem",
				},
				{
					emojiDescription: ["🔒"],
					genus: "Neutrum",
					index: 2,
					pos: "Noun",
					senseGloss: "door lock",
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
					senseGloss: "castle palace",
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
			context: "Auf jeden Fall komme ich mit.",
			lemma: "auf jeden Fall",
			senses: [
				{
					emojiDescription: ["✅"],
					index: 1,
					phrasemeKind: "DiscourseFormula",
					senseGloss: "certainly definitely",
					unitKind: "Phrasem",
				},
				{
					emojiDescription: ["📚"],
					index: 2,
					phrasemeKind: "Collocation",
					senseGloss: "legal case",
					unitKind: "Phrasem",
				},
			],
		},
		output: {
			matchedIndex: 1,
		},
	},
] satisfies {
	input: UserInput<"Disambiguate">;
	output: AgentOutput<"Disambiguate">;
}[];
