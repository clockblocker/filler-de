import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "The house was painted blue.",
			pos: "Noun",
			word: "house",
		},
		output: {
			relations: [
				{ kind: "Synonym", words: ["home", "dwelling"] },
				{ kind: "Hypernym", words: ["building"] },
				{ kind: "Hyponym", words: ["cottage", "mansion"] },
			],
		},
	},
	{
		input: {
			context: "The big tree stood in the garden.",
			pos: "Adjective",
			word: "big",
		},
		output: {
			relations: [
				{ kind: "Synonym", words: ["large", "huge"] },
				{ kind: "Antonym", words: ["small", "tiny"] },
			],
		},
	},
] satisfies {
	input: UserInput<"Relation">;
	output: AgentOutput<"Relation">;
}[];
