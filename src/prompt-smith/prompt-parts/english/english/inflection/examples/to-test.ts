import type { AgentOutput, UserInput } from "../../../../../schemas";

export const testExamples = [
	{
		input: {
			context: "Sie fängt morgen mit der Arbeit an.",
			pos: "Verb",
			word: "anfangen",
		},
		output: {
			rows: [
				{ forms: "[[fängt]] an", label: "Präsens" },
				{ forms: "[[fing]] an", label: "Präteritum" },
				{ forms: "hat [[angefangen]]", label: "Perfekt" },
				{ forms: "[[finge]] an", label: "Konjunktiv II" },
				{ forms: "[[fang]] an!", label: "Imperativ" },
			],
		},
	},
] satisfies {
	input: UserInput<"Inflection">;
	output: AgentOutput<"Inflection">;
}[];
