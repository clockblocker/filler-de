import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	{
		input: {
			context: "Der Himmel ist heute besonders blau.",
			pos: "Noun",
			word: "Himmel",
		},
		output: {
			tags: ["maskulin"],
		},
	},
	{
		input: {
			context: "Die Deutsche Bank hat ihren Sitz in Frankfurt.",
			pos: "Noun",
			word: "Deutsche Bank",
		},
		output: {
			tags: ["feminin", "proper"],
		},
	},
	{
		input: {
			context: "Er ist schnell gelaufen.",
			pos: "Verb",
			word: "laufen",
		},
		output: {
			tags: ["intransitiv", "stark"],
		},
	},
	{
		input: {
			context: "Kannst du bitte die Tür aufmachen?",
			pos: "Verb",
			word: "aufmachen",
		},
		output: {
			tags: ["transitiv", "trennbar"],
		},
	},
	{
		input: {
			context: "Das Auto ist sehr schnell.",
			pos: "Adjective",
			word: "schnell",
		},
		output: {
			tags: ["steigerbar"],
		},
	},
	{
		input: {
			context: "Ich gehe mit meinem Freund spazieren.",
			pos: "Preposition",
			word: "mit",
		},
		output: {
			tags: ["dativ"],
		},
	},
] satisfies {
	input: UserInput<"Features">;
	output: AgentOutput<"Features">;
}[];
