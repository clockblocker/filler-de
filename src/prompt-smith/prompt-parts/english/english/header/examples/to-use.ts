import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "The house was painted blue.",
			pos: "Noun",
			word: "house",
		},
		output: {
			emoji: "🏠",
			ipa: "haʊs",
		},
	},
	{
		input: {
			context: "She loves to run in the morning.",
			pos: "Verb",
			word: "run",
		},
		output: {
			emoji: "🏃",
			ipa: "ɹʌn",
		},
	},
] satisfies {
	input: UserInput<"Header">;
	output: AgentOutput<"Header">;
}[];
