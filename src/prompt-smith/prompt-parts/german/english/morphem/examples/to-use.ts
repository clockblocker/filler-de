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
				{ kind: "Root", surf: "kohle" },
				{ kind: "Root", surf: "kraft" },
				{ kind: "Root", surf: "werk" },
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
				{ kind: "Prefix", surf: "un" },
				{ kind: "Root", surf: "möglich" },
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
				{ kind: "Root", surf: "freund" },
				{ kind: "Suffix", surf: "schaft" },
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
				{ kind: "Root", surf: "arbeit" },
				{ kind: "Interfix", surf: "s" },
				{ kind: "Root", surf: "platz" },
			],
		},
	},
	// Prefix (inseparable) + root + suffix: ver- + antwort + -ung
	{
		input: {
			context: "Er trägt die Verantwortung für das Projekt.",
			word: "Verantwortung",
		},
		output: {
			morphemes: [
				{ kind: "Prefix", surf: "ver", tags: ["Inseparable"] },
				{ kind: "Root", surf: "antwort" },
				{ kind: "Suffix", surf: "ung" },
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
			morphemes: [{ kind: "Root", surf: "hand" }],
		},
	},
	// Separable prefix: auf + passen
	{
		input: {
			context: "Du musst besser aufpassen.",
			word: "aufpassen",
		},
		output: {
			morphemes: [
				{ kind: "Prefix", surf: "auf", tags: ["Separable"] },
				{ kind: "Root", surf: "passen" },
			],
		},
	},
	// Inseparable prefix: ver + stehen
	{
		input: {
			context: "Ich kann das nicht verstehen.",
			word: "verstehen",
		},
		output: {
			morphemes: [
				{ kind: "Prefix", surf: "ver", tags: ["Inseparable"] },
				{ kind: "Root", surf: "stehen" },
			],
		},
	},
] satisfies {
	input: UserInput<"Morphem">;
	output: AgentOutput<"Morphem">;
}[];
