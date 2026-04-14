import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
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
