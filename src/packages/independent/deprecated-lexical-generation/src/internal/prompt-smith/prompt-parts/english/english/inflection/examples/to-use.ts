import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Das Kohlekraftwerk erzeugt viel Strom.",
			pos: "Noun",
			word: "Kohlekraftwerk",
		},
		output: {
			rows: [
				{
					forms: "das [[Kohlekraftwerk]], die [[Kohlekraftwerke]]",
					label: "N",
				},
				{
					forms: "das [[Kohlekraftwerk]], die [[Kohlekraftwerke]]",
					label: "A",
				},
				{
					forms: "des [[Kohlekraftwerkes]], der [[Kohlekraftwerke]]",
					label: "G",
				},
				{
					forms: "dem [[Kohlekraftwerk]], den [[Kohlekraftwerken]]",
					label: "D",
				},
			],
		},
	},
	{
		input: {
			context: "Er geht jeden Tag zur Arbeit.",
			pos: "Verb",
			word: "gehen",
		},
		output: {
			rows: [
				{ forms: "[[geht]]", label: "Präsens" },
				{ forms: "[[ging]]", label: "Präteritum" },
				{ forms: "ist [[gegangen]]", label: "Perfekt" },
				{ forms: "[[ginge]]", label: "Konjunktiv II" },
				{ forms: "[[geh]]!", label: "Imperativ" },
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
			rows: [
				{ forms: "[[groß]]", label: "Positiv" },
				{ forms: "[[größer]]", label: "Komparativ" },
				{ forms: "am [[größten]]", label: "Superlativ" },
			],
		},
	},
] satisfies {
	input: UserInput<"Inflection">;
	output: AgentOutput<"Inflection">;
}[];
