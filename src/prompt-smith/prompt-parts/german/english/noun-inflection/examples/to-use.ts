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
	{
		input: {
			context: "Die Katze schläft auf dem Sofa.",
			word: "Katze",
		},
		output: {
			cells: [
				{
					article: "die",
					case: "Nominative",
					form: "Katze",
					number: "Singular",
				},
				{
					article: "die",
					case: "Nominative",
					form: "Katzen",
					number: "Plural",
				},
				{
					article: "die",
					case: "Accusative",
					form: "Katze",
					number: "Singular",
				},
				{
					article: "die",
					case: "Accusative",
					form: "Katzen",
					number: "Plural",
				},
				{
					article: "der",
					case: "Dative",
					form: "Katze",
					number: "Singular",
				},
				{
					article: "den",
					case: "Dative",
					form: "Katzen",
					number: "Plural",
				},
				{
					article: "der",
					case: "Genitive",
					form: "Katze",
					number: "Singular",
				},
				{
					article: "der",
					case: "Genitive",
					form: "Katzen",
					number: "Plural",
				},
			],
			genus: "Femininum",
		},
	},
	{
		input: {
			context: "Der Hund bellt laut im Garten.",
			word: "Hund",
		},
		output: {
			cells: [
				{
					article: "der",
					case: "Nominative",
					form: "Hund",
					number: "Singular",
				},
				{
					article: "die",
					case: "Nominative",
					form: "Hunde",
					number: "Plural",
				},
				{
					article: "den",
					case: "Accusative",
					form: "Hund",
					number: "Singular",
				},
				{
					article: "die",
					case: "Accusative",
					form: "Hunde",
					number: "Plural",
				},
				{
					article: "dem",
					case: "Dative",
					form: "Hund",
					number: "Singular",
				},
				{
					article: "den",
					case: "Dative",
					form: "Hunden",
					number: "Plural",
				},
				{
					article: "des",
					case: "Genitive",
					form: "Hundes",
					number: "Singular",
				},
				{
					article: "der",
					case: "Genitive",
					form: "Hunde",
					number: "Plural",
				},
			],
			genus: "Maskulinum",
		},
	},
] satisfies {
	input: UserInput<"NounInflection">;
	output: AgentOutput<"NounInflection">;
}[];
