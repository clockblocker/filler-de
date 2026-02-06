import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Ich muss zur Bank, um Geld abzuheben.",
			pos: "Noun",
			word: "Bank",
		},
		output: {
			semantics: "Geldinstitut",
		},
	},
	{
		input: {
			context: "Er setzte sich auf die Bank im Park.",
			pos: "Noun",
			word: "Bank",
		},
		output: {
			semantics: "Sitzgelegenheit",
		},
	},
	{
		input: {
			context: "Wir besichtigten das Schloss am Rhein.",
			pos: "Noun",
			word: "Schloss",
		},
		output: {
			semantics: "Gebäude",
		},
	},
	{
		input: {
			context: "Das Schloss an der Tür war kaputt.",
			pos: "Noun",
			word: "Schloss",
		},
		output: {
			semantics: "Türschloss",
		},
	},
	{
		input: {
			context: "Der Hund lief über die Straße.",
			pos: "Noun",
			word: "Hund",
		},
		output: {
			semantics: "Haustier",
		},
	},
] satisfies {
	input: UserInput<"Semantics">;
	output: AgentOutput<"Semantics">;
}[];
