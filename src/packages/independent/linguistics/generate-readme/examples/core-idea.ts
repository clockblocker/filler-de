/** biome-ignore-all lint/correctness/noUnusedVariables: README example file */
import type { Lemma, Selection } from "../../src";

// README_BLOCK:core-simple-selection:start
const simpleWalkSelection = {
	language: "English",
	orthographicStatus: "Standard",
	selectionCoverage: "Full",
	spelledSelection: "walk",
	surface: {
		discriminators: {
			lemmaKind: "Lexeme",
			lemmaSubKind: "VERB",
		},
		inflectionalFeatures: {
			tense: "Pres",
			verbForm: "Fin",
		},
		normalizedFullSurface: "walk",
		surfaceKind: "Inflection",
		target: {
			canonicalLemma: "walk",
			inherentFeatures: {},
			language: "English",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🚶",
			pos: "VERB",
		},
	},
} satisfies Selection<"English", "Standard", "Inflection", "Lexeme", "VERB">;
// README_BLOCK:core-simple-selection:end

// README_BLOCK:core-simple-lemma:start
const simpleWalkLemma = {
	canonicalLemma: "walk",
	inherentFeatures: {},
	language: "English",
	lemmaKind: "Lexeme",
	meaningInEmojis: "🚶",
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
	normalizedSelectedSurface: "gave",
	orthographicStatus: "Standard",
	selectionCoverage: "Partial",
	spelledSelection: "gave",
	surface: {
		discriminators: {
			lemmaKind: "Lexeme",
			lemmaSubKind: "VERB",
		},
		normalizedFullSurface: "gave up",
		surfaceKind: "Lemma",
		target: {
			canonicalLemma: "give up",
		},
	},
} satisfies Selection<"English", "Standard", "Lemma", "Lexeme", "VERB">;

const passAufSelection = {
	language: "German",
	normalizedSelectedSurface: "pass",
	orthographicStatus: "Standard",
	selectionCoverage: "Partial",
	spelledSelection: "Pass",
	surface: {
		discriminators: {
			lemmaKind: "Lexeme",
			lemmaSubKind: "VERB",
		},
		normalizedFullSurface: "pass auf",
		surfaceKind: "Lemma",
		target: {
			canonicalLemma: "aufpassen",
		},
	},
} satisfies Selection<"German", "Standard", "Lemma", "Lexeme", "VERB">;
// README_BLOCK:core-lemma-surface-distinction:end
