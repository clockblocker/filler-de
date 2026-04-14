import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "She finished the task quickly.",
			pos: "Adverb",
			word: "quickly",
		},
		output: {
			senseEmojis: ["⚡"],
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
			senseEmojis: ["🏃"],
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
			senseEmojis: ["🏛️"],
			ipa: "ˈeɪnʃənt",
		},
	},
] satisfies {
	input: UserInput<"LexemEnrichment">;
	output: AgentOutput<"LexemEnrichment">;
}[];
