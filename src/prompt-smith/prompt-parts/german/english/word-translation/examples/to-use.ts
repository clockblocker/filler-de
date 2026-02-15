import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Ich muss zur Bank, um Geld abzuheben.",
			pos: "Noun",
			word: "Bank",
		},
		output: "bank",
	},
	{
		input: {
			context: "Er setzte sich auf die Bank im Park.",
			pos: "Noun",
			word: "Bank",
		},
		output: "bench",
	},
	{
		input: {
			context: "Das Schloss an der Tür war kaputt.",
			pos: "Noun",
			word: "Schloss",
		},
		output: "lock",
	},
	{
		input: {
			context: "Sie hat den Brief aufgemacht.",
			pos: "Verb",
			word: "aufmachen",
		},
		output: "to open",
	},
	{
		input: {
			context: "Er hat mir einen Korb gegeben.",
			pos: "Phrasem",
			word: "einen Korb geben",
		},
		output: "to reject",
	},
] satisfies {
	input: UserInput<"WordTranslation">;
	output: AgentOutput<"WordTranslation">;
}[];
