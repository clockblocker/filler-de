import type { AgentOutput, UserInput } from "../../../../../schemas";

export const examples = [
	// Prefix derivation: auf + passen
	{
		input: {
			context: "Du musst besser aufpassen.",
			word: "aufpassen",
		},
		output: {
			derived_from: {
				derivation_type: "prefix_derivation",
				lemma: "passen",
			},
			morphemes: [
				{ kind: "Prefix", separability: "Separable", surf: "auf" },
				{ kind: "Root", lemma: "passen", surf: "passen" },
			],
		},
	},
	// Inseparable prefix derivation: ver + stehen
	{
		input: {
			context: "Ich kann das nicht verstehen.",
			word: "verstehen",
		},
		output: {
			derived_from: {
				derivation_type: "prefix_derivation",
				lemma: "stehen",
			},
			morphemes: [
				{ kind: "Prefix", separability: "Inseparable", surf: "ver" },
				{ kind: "Root", lemma: "stehen", surf: "stehen" },
			],
		},
	},
	// Suffix derivation: frei + heit
	{
		input: {
			context: "Freiheit ist ein zentrales Thema.",
			word: "Freiheit",
		},
		output: {
			derived_from: {
				derivation_type: "suffix_derivation",
				lemma: "frei",
			},
			morphemes: [
				{ kind: "Root", lemma: "frei", surf: "frei" },
				{ kind: "Suffix", surf: "heit" },
			],
		},
	},
	// Conversion: trinken (verb) -> Trinken (noun)
	{
		input: {
			context: "Das Trinken von Wasser ist wichtig.",
			word: "Trinken",
		},
		output: {
			derived_from: { derivation_type: "conversion", lemma: "trinken" },
			morphemes: [{ kind: "Root", lemma: "trinken", surf: "trinken" }],
		},
	},
	// Diminutive: Hund + chen
	{
		input: {
			context: "Das Hündchen schläft auf dem Sofa.",
			word: "Hündchen",
		},
		output: {
			derived_from: { derivation_type: "diminutive", lemma: "Hund" },
			morphemes: [
				{ kind: "Root", lemma: "Hund", surf: "hünd" },
				{ kind: "Suffix", surf: "chen" },
			],
		},
	},
	// Gendered person noun: Lehrer + in
	{
		input: {
			context: "Die Lehrerin erklärt die Aufgabe.",
			word: "Lehrerin",
		},
		output: {
			derived_from: {
				derivation_type: "gendered_person_noun",
				lemma: "Lehrer",
			},
			morphemes: [
				{ kind: "Root", lemma: "Lehrer", surf: "lehrer" },
				{ kind: "Suffix", surf: "in" },
			],
		},
	},
	// Nominal compound with interfix: Küche + n + Fenster
	{
		input: {
			context: "Das Küchenfenster war offen.",
			word: "Küchenfenster",
		},
		output: {
			compounded_from: ["Küche", "Fenster"],
			morphemes: [
				{ kind: "Root", lemma: "Küche", surf: "küche" },
				{ kind: "Interfix", surf: "n" },
				{ kind: "Root", lemma: "Fenster", surf: "fenster" },
			],
		},
	},
	// Nominal compound without interfix: Hand + Werk
	{
		input: {
			context: "Handwerk hat in der Region Tradition.",
			word: "Handwerk",
		},
		output: {
			compounded_from: ["Hand", "Werk"],
			morphemes: [
				{ kind: "Root", lemma: "Hand", surf: "hand" },
				{ kind: "Root", lemma: "Werk", surf: "werk" },
			],
		},
	},
	// Simple root, no morphology fields
	{
		input: {
			context: "Sie hob die Hand.",
			word: "Hand",
		},
		output: {
			morphemes: [{ kind: "Root", lemma: "Hand", surf: "hand" }],
		},
	},
	// No morphology fields when uncertain/non-obvious
	{
		input: {
			context: "Das Wort Xenon steht im Periodensystem.",
			word: "Xenon",
		},
		output: {
			morphemes: [{ kind: "Root", lemma: "Xenon", surf: "xenon" }],
		},
	},
] satisfies {
	input: UserInput<"Morphem">;
	output: AgentOutput<"Morphem">;
}[];
