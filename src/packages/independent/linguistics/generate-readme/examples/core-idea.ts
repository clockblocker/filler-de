/** biome-ignore-all lint/correctness/noUnusedVariables: README example file */
import type { Lemma, Selection } from "../../src";

// README_BLOCK:core-simple-selection:start
const giveUpPartialSelection = {
	language: "English",
	normalizedSelectedSurface: "up",
	orthographicStatus: "Standard",
	selectionCoverage: "Partial",
	spelledSelection: "up",
	surface: {
		discriminators: {
			lemmaKind: "Lexeme",
			lemmaSubKind: "VERB",
		},
		inflectionalFeatures: {
			tense: "Past",
			verbForm: "Fin",
		},
		normalizedFullSurface: "gave up",
		surfaceKind: "Inflection",
		target: {
			canonicalLemma: "give up",
			inherentFeatures: {
				phrasal: "Yes",
			},
			language: "English",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🏳️",
			pos: "VERB",
		},
	},
} satisfies Selection<"English", "Standard", "Inflection", "Lexeme", "VERB">;
// README_BLOCK:core-simple-selection:end

// README_BLOCK:core-simple-lemma:start
const giveUpLemma = {
	canonicalLemma: "give up",
	inherentFeatures: {
		phrasal: "Yes",
	},
	language: "English",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🏳️",
	pos: "VERB",
} satisfies Lemma<"English", "Lexeme", "VERB">;
// README_BLOCK:core-simple-lemma:end

// README_BLOCK:core-idiom-selection:start
const idiomPartSelection = {
	language: "English",
	normalizedSelectedSurface: "walk",
	orthographicStatus: "Standard",
	selectionCoverage: "Partial",
	spelledSelection: "walk",
	surface: {
		discriminators: {
			lemmaKind: "Phraseme",
			lemmaSubKind: "Idiom",
		},
		normalizedFullSurface: "a walk in the park",
		surfaceKind: "Lemma",
		target: {
			canonicalLemma: "a walk in the park",
			language: "English",
			lemmaKind: "Phraseme",
			meaningInEmojis: "😌👌",
			phrasemeKind: "Idiom",
		},
	},
} satisfies Selection<"English", "Standard", "Lemma", "Phraseme", "Idiom">;
// README_BLOCK:core-idiom-selection:end

// README_BLOCK:core-lemma-surface-distinction:start
const gaveUpSelection = {
	language: "English",
	normalizedSelectedSurface: "up",
	orthographicStatus: "Standard",
	selectionCoverage: "Partial",
	spelledSelection: "up",
	surface: {
		discriminators: {
			lemmaKind: "Lexeme",
			lemmaSubKind: "VERB",
		},
		inflectionalFeatures: {
			tense: "Past",
			verbForm: "Fin",
		},
		normalizedFullSurface: "gave up",
		surfaceKind: "Inflection",
		target: {
			canonicalLemma: "give up",
		},
	},
} satisfies Selection<"English", "Standard", "Inflection", "Lexeme", "VERB">;

const passAufSelection = {
	language: "German",
	normalizedSelectedSurface: "auf",
	orthographicStatus: "Standard",
	selectionCoverage: "Partial",
	spelledSelection: "auf",
	surface: {
		discriminators: {
			lemmaKind: "Lexeme",
			lemmaSubKind: "VERB",
		},
		inflectionalFeatures: {
			mood: "Imp",
			verbForm: "Fin",
		},
		normalizedFullSurface: "pass auf",
		surfaceKind: "Inflection",
		target: {
			canonicalLemma: "aufpassen",
		},
	},
} satisfies Selection<"German", "Standard", "Inflection", "Lexeme", "VERB">;
// README_BLOCK:core-lemma-surface-distinction:end
