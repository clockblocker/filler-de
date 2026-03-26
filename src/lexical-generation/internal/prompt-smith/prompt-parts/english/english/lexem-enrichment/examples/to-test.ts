import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "She finished the task quickly.",
			pos: "Adverb",
			word: "quickly",
		},
		output: {
			emojiDescription: ["⚡"],
			ipa: "ˈkwɪkli",
		},
	},
	{
		input: {
			context: "She runs every morning before work.",
			pos: "Verb",
			word: "run",
		},
		output: {
			emojiDescription: ["🏃"],
			ipa: "rʌn",
		},
	},
	{
		input: {
			context: "The ancient temple stands on the hill.",
			pos: "Adjective",
			word: "ancient",
		},
		output: {
			emojiDescription: ["🏛️"],
			ipa: "ˈeɪnʃənt",
		},
	},
] satisfies {
	input: UserInput<"LexemEnrichment">;
	output: AgentOutput<"LexemEnrichment">;
}[];
