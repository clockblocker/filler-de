import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	// Simple root
	{
		input: {
			context: "She held his hand tightly.",
			word: "hand",
		},
		output: {
			morphemes: [{ kind: "Root", surf: "hand" }],
		},
	},
	// Prefix + root: un- + happy
	{
		input: {
			context: "She was unhappy with the result.",
			word: "unhappy",
		},
		output: {
			morphemes: [
				{ kind: "Prefix", surf: "un" },
				{ kind: "Root", surf: "happy" },
			],
		},
	},
	// Root + suffix: friend + -ship
	{
		input: {
			context: "Their friendship lasted a lifetime.",
			word: "friendship",
		},
		output: {
			morphemes: [
				{ kind: "Root", surf: "friend" },
				{ kind: "Suffix", surf: "ship" },
			],
		},
	},
] satisfies {
	input: UserInput<"Morphem">;
	output: AgentOutput<"Morphem">;
}[];
