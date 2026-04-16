/** biome-ignore-all lint/correctness/noUnusedVariables: README example file */
import type { Lemma, Selection } from "../../src";

// README_BLOCK:core-simple-selection:start
const giveUpPartialSelection = {
	language: "English",
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
		language: "English",
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
	orthographicStatus: "Standard",
	selectionCoverage: "Partial",
	spelledSelection: "walk",
	surface: {
		discriminators: {
			lemmaKind: "Phraseme",
			lemmaSubKind: "Idiom",
		},
		language: "English",
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
		language: "English",
		normalizedFullSurface: "gave up",
		surfaceKind: "Inflection",
		target: {
			canonicalLemma: "give up",
		},
	},
} satisfies Selection<"English", "Standard", "Inflection", "Lexeme", "VERB">;

const passAufSelection = {
	language: "German",
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
		language: "German",
		normalizedFullSurface: "pass auf",
		surfaceKind: "Inflection",
		target: {
			canonicalLemma: "aufpassen",
		},
	},
} satisfies Selection<"German", "Standard", "Inflection", "Lexeme", "VERB">;
// README_BLOCK:core-lemma-surface-distinction:end
