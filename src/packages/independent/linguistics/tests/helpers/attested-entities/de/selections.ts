import type { Selection } from "../../../../src";
import {
	makeLexemeSurfaceReference,
	makePhrasemeSurfaceReference,
} from "../../functions/builders";

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

// Attestation: "In Berlin sowie im Umland (Agglomeration Berlin) betreibt die [BVG] die U-Bahn Berlin, die Straßenbahn Berlin, den Busverkehr in Berlin und den Fährverkehr in Berlin, nicht jedoch die S-Bahn."
export const germanBVGAbbreviationVariantSelection = {
	language: "German",
	orthographicStatus: "Standard",
	selectionCoverage: "Full",
	spelledSelection: "BVG",
	surface: {
		...makeLexemeSurfaceReference("PROPN", "Berliner Verkehrsbetriebe"),
		language: "German",
		normalizedFullSurface: "BVG",
		surfaceKind: "Variant",
	},
} satisfies Selection<"German", "Standard", "Variant", "Lexeme", "PROPN">;
