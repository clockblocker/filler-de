import type { KnownSelection, Selection } from "../../../src";
import { makePhrasemeSurfaceReference } from "../functions/builders";
import {
	englishGiveUpTypoUnresolvedInflectionSurface,
	englishWalkResolvedLemmaSurface,
	englishWalkUnresolvedInflectionSurface,
} from "./surfaces";

// Attestation: "They [walk] home together."
export const englishWalkStandardFullSelection = {
	language: "English",
	orthographicStatus: "Standard",
	selectionCoverage: "Full",
	spelledSelection: "walk",
	surface: englishWalkUnresolvedInflectionSurface,
} satisfies KnownSelection<"English">;

// Attestation: "They [walk] home together."
export const englishWalkResolvedLemmaSelection = {
	language: "English",
	orthographicStatus: "Standard",
	selectionCoverage: "Full",
	spelledSelection: "walk",
	surface: englishWalkResolvedLemmaSurface,
} satisfies Selection<"English", "Standard", "Lemma", "Lexeme", "VERB">;

// Attestation: "Mark gvae [up] on it."
export const englishGiveUpTypoPartialUpSelection = {
	language: "English",
	orthographicStatus: "Typo",
	selectionCoverage: "Partial",
	spelledSelection: "up",
	surface: englishGiveUpTypoUnresolvedInflectionSurface,
} satisfies Selection<"English", "Typo", "Inflection", "Lexeme", "VERB">;

// Attestation: "Mark [gvae] up on it."
export const englishGiveUpTypoPartialGvaeSelection = {
	language: "English",
	orthographicStatus: "Typo",
	selectionCoverage: "Partial",
	spelledSelection: "gvae",
	surface: englishGiveUpTypoUnresolvedInflectionSurface,
} satisfies Selection<"English", "Typo", "Inflection", "Lexeme", "VERB">;

// Attestation: "[Auf jeden Fall] komme ich morgen."
export const germanAufJedenFallDiscourseFormulaSelection = {
	language: "German",
	orthographicStatus: "Standard",
	selectionCoverage: "Full",
	spelledSelection: "auf jeden Fall",
	surface: {
		...makePhrasemeSurfaceReference("DiscourseFormula", "auf jeden Fall"),
		language: "German",
		normalizedFullSurface: "auf jeden Fall",
		surfaceKind: "Lemma",
	},
} satisfies Selection<
	"German",
	"Standard",
	"Lemma",
	"Phraseme",
	"DiscourseFormula"
>;

// Attestation: "Das war ein [Spaziergang] im Park."
export const germanEinSpaziergangImParkClichePartialSelection = {
	language: "German",
	orthographicStatus: "Standard",
	selectionCoverage: "Partial",
	spelledSelection: "Spaziergang",
	surface: {
		...makePhrasemeSurfaceReference("Cliché", "ein Spaziergang im Park"),
		language: "German",
		normalizedFullSurface: "ein Spaziergang im Park",
		surfaceKind: "Lemma",
	},
} satisfies Selection<"German", "Standard", "Lemma", "Phraseme", "Cliché">;
