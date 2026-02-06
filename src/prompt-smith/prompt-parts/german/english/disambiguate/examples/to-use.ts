import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Er setzte sich auf die Bank im Park.",
			lemma: "Bank",
			senses: [{ index: 1, semantics: "Geldinstitut" }],
		},
		output: {
			matchedIndex: null,
			semantics: "Sitzgelegenheit",
		},
	},
	{
		input: {
			context: "Ich muss zur Bank, um Geld abzuheben.",
			lemma: "Bank",
			senses: [
				{ index: 1, semantics: "Geldinstitut" },
				{ index: 2, semantics: "Sitzgelegenheit" },
			],
		},
		output: {
			matchedIndex: 1,
		},
	},
	{
		input: {
			context: "Das Schloss an der Tür war kaputt.",
			lemma: "Schloss",
			senses: [{ index: 1, semantics: "Gebäude" }],
		},
		output: {
			matchedIndex: null,
			semantics: "Schließvorrichtung",
		},
	},
	{
		input: {
			context: "Wir besichtigten das Schloss am Rhein.",
			lemma: "Schloss",
			senses: [
				{ index: 1, semantics: "Gebäude" },
				{ index: 2, semantics: "Schließvorrichtung" },
			],
		},
		output: {
			matchedIndex: 1,
		},
	},
	{
		input: {
			context: "Das Schloss am Fahrrad war aufgebrochen.",
			lemma: "Schloss",
			senses: [{ index: 1, semantics: "Gebäude" }],
		},
		output: {
			matchedIndex: null,
			semantics: "Schließvorrichtung",
		},
	},
] satisfies {
	input: UserInput<"Disambiguate">;
	output: AgentOutput<"Disambiguate">;
}[];
