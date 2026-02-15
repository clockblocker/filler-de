import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Das Kraftwerk erzeugt viel Strom.",
			word: "Kraftwerk",
		},
		output: {
			cells: [
				{
					article: "das",
					case: "Nominative",
					form: "Kraftwerk",
					number: "Singular",
				},
				{
					article: "die",
					case: "Nominative",
					form: "Kraftwerke",
					number: "Plural",
				},
				{
					article: "das",
					case: "Accusative",
					form: "Kraftwerk",
					number: "Singular",
				},
				{
					article: "die",
					case: "Accusative",
					form: "Kraftwerke",
					number: "Plural",
				},
				{
					article: "dem",
					case: "Dative",
					form: "Kraftwerk",
					number: "Singular",
				},
				{
					article: "den",
					case: "Dative",
					form: "Kraftwerken",
					number: "Plural",
				},
				{
					article: "des",
					case: "Genitive",
					form: "Kraftwerkes",
					number: "Singular",
				},
				{
					article: "der",
					case: "Genitive",
					form: "Kraftwerke",
					number: "Plural",
				},
			],
			genus: "Neutrum",
		},
	},
] satisfies {
	input: UserInput<"NounInflection">;
	output: AgentOutput<"NounInflection">;
}[];
