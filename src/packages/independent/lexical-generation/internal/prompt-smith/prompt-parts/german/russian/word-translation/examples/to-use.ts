import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Ich muss zur Bank, um Geld abzuheben.",
			pos: "Noun",
			word: "Bank",
		},
		output: "банк",
	},
	{
		input: {
			context: "Er setzte sich auf die Bank im Park.",
			pos: "Noun",
			word: "Bank",
		},
		output: "скамейка",
	},
	{
		input: {
			context: "Das Schloss an der Tür war kaputt.",
			pos: "Noun",
			word: "Schloss",
		},
		output: "замок",
	},
	{
		input: {
			context: "Sie hat den Brief aufgemacht.",
			pos: "Verb",
			word: "aufmachen",
		},
		output: "открыть",
	},
	{
		input: {
			context: "Er hat mir einen Korb gegeben.",
			pos: "Phrasem",
			word: "einen Korb geben",
		},
		output: "отказать",
	},
] satisfies {
	input: UserInput<"WordTranslation">;
	output: AgentOutput<"WordTranslation">;
}[];
