import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Ich muss zur Bank, um Geld abzuheben.",
			pos: "Noun",
			word: "Bank",
		},
		output: {
			semantics:
				"Einrichtung, die Geld verwaltet und Finanzdienstleistungen anbietet",
		},
	},
	{
		input: {
			context: "Er setzte sich auf die Bank im Park.",
			pos: "Noun",
			word: "Bank",
		},
		output: {
			semantics:
				"Längliche Sitzgelegenheit für mehrere Personen im Freien",
		},
	},
	{
		input: {
			context: "Wir besichtigten das Schloss am Rhein.",
			pos: "Noun",
			word: "Schloss",
		},
		output: {
			semantics:
				"Repräsentatives Wohngebäude des Adels, oft mit historischer Bedeutung",
		},
	},
	{
		input: {
			context: "Das Schloss an der Tür war kaputt.",
			pos: "Noun",
			word: "Schloss",
		},
		output: {
			semantics:
				"Mechanische Vorrichtung zum Verschließen einer Tür oder eines Behälters",
		},
	},
	{
		input: {
			context: "Der Hund lief über die Straße.",
			pos: "Noun",
			word: "Hund",
		},
		output: {
			semantics:
				"Domestiziertes Säugetier, das als Haustier oder Nutztier gehalten wird",
		},
	},
] satisfies {
	input: UserInput<"Semantics">;
	output: AgentOutput<"Semantics">;
}[];
