import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	// Simple compound: Kohle + Kraft + Werk
	{
		input: {
			context: "Das Kohlekraftwerk erzeugt Strom aus Kohle.",
			word: "Kohlekraftwerk",
		},
		output: {
			morphemes: [
				{ kind: "Root", morpheme: "kohle" },
				{ kind: "Root", morpheme: "kraft" },
				{ kind: "Root", morpheme: "werk" },
			],
		},
	},
	// Prefix + root: un- + möglich
	{
		input: {
			context: "Das ist unmöglich zu schaffen.",
			word: "unmöglich",
		},
		output: {
			morphemes: [
				{ kind: "Prefix", morpheme: "un" },
				{ kind: "Root", morpheme: "möglich" },
			],
		},
	},
	// Root + derivational suffix: Freund + -schaft
	{
		input: {
			context: "Ihre Freundschaft hält seit der Kindheit.",
			word: "Freundschaft",
		},
		output: {
			morphemes: [
				{ kind: "Root", morpheme: "freund" },
				{ kind: "Suffix", morpheme: "schaft" },
			],
		},
	},
	// Compound with interfix: Arbeit + -s- + Platz
	{
		input: {
			context: "Er hat seinen Arbeitsplatz verloren.",
			word: "Arbeitsplatz",
		},
		output: {
			morphemes: [
				{ kind: "Root", morpheme: "arbeit" },
				{ kind: "Interfix", morpheme: "s" },
				{ kind: "Root", morpheme: "platz" },
			],
		},
	},
	// Prefix + root + suffix: ver- + antwort + -ung
	{
		input: {
			context: "Er trägt die Verantwortung für das Projekt.",
			word: "Verantwortung",
		},
		output: {
			morphemes: [
				{ kind: "Prefix", morpheme: "ver" },
				{ kind: "Root", morpheme: "antwort" },
				{ kind: "Suffix", morpheme: "ung" },
			],
		},
	},
	// Simple root: Hand
	{
		input: {
			context: "Sie nahm ihn an der Hand.",
			word: "Hand",
		},
		output: {
			morphemes: [{ kind: "Root", morpheme: "hand" }],
		},
	},
] satisfies {
	input: UserInput<"Morphem">;
	output: AgentOutput<"Morphem">;
}[];
