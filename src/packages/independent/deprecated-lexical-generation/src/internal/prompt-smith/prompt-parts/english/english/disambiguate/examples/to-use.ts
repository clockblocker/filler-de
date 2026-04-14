import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "I went to the bank to withdraw money.",
			lemma: "bank",
			senses: [
				{
					senseEmojis: ["🏞️", "🌊"],
					index: 1,
					pos: "Noun",
					unitKind: "Lexem",
				},
			],
		},
		output: {
			senseEmojis: ["🏦"],
			matchedIndex: null,
		},
	},
	{
		input: {
			context: "We sat on the bank of the river.",
			lemma: "bank",
			senses: [
				{
					senseEmojis: ["🏞️", "🌊"],
					index: 1,
					pos: "Noun",
					unitKind: "Lexem",
				},
				{
					senseEmojis: ["🏦"],
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
			context: "To be honest, I did not expect that.",
			lemma: "to be honest",
			senses: [
				{
					senseEmojis: ["🗣️"],
					index: 1,
					phrasemeKind: "DiscourseFormula",
					unitKind: "Phrasem",
				},
				{
					senseEmojis: ["🤝"],
					index: 2,
					phrasemeKind: "Collocation",
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
