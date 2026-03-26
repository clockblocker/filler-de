import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Das Haus steht am Ende der Straße.",
			pos: "Noun",
			word: "Haus",
		},
		output: {
			relations: [
				{ kind: "Synonym", words: ["Gebäude", "Wohnhaus"] },
				{ kind: "Hypernym", words: ["Bauwerk"] },
				{
					kind: "Hyponym",
					words: ["Villa", "Reihenhaus", "Einfamilienhaus"],
				},
				{ kind: "Meronym", words: ["Dach", "Wand", "Tür", "Fenster"] },
			],
		},
	},
	{
		input: {
			context: "Wir gehen morgen ins Kino.",
			pos: "Verb",
			word: "gehen",
		},
		output: {
			relations: [
				{ kind: "Synonym", words: ["laufen"] },
				{
					kind: "NearSynonym",
					words: ["schreiten", "wandern", "spazieren"],
				},
				{ kind: "Antonym", words: ["stehen", "bleiben"] },
			],
		},
	},
	{
		input: {
			context: "Der große Baum stand im Garten.",
			pos: "Adjective",
			word: "groß",
		},
		output: {
			relations: [
				{ kind: "Synonym", words: ["riesig", "gewaltig"] },
				{ kind: "Antonym", words: ["klein", "winzig"] },
			],
		},
	},
] satisfies {
	input: UserInput<"Relation">;
	output: AgentOutput<"Relation">;
}[];
