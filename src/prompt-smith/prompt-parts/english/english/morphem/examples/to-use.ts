import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	// Simple root
	{
		input: {
			context: "She held his hand tightly.",
			word: "hand",
		},
		output: {
			morphemes: [{ kind: "Root", morpheme: "hand" }],
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
				{ kind: "Prefix", morpheme: "un" },
				{ kind: "Root", morpheme: "happy" },
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
				{ kind: "Root", morpheme: "friend" },
				{ kind: "Suffix", morpheme: "ship" },
			],
		},
	},
] satisfies {
	input: UserInput<"Morphem">;
	output: AgentOutput<"Morphem">;
}[];
