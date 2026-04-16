import type { Selection } from "../../../../src";
import {
	makeLexemeSurfaceReference,
	makePhrasemeSurfaceReference,
} from "../../functions/builders";
import { germanBVGLemma } from "./lemmas";

// Attestation: "[Auf jeden Fall] komme ich morgen."
export const germanAufJedenFallDiscourseFormulaSelection = {
	language: "German",
	orthographicStatus: "Standard",
	selectionCoverage: "Full",
	spelledSelection: "auf jeden Fall",
	spellingRelation: "Canonical",
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
	spellingRelation: "Canonical",
	surface: {
		...makePhrasemeSurfaceReference("Cliché", "ein Spaziergang im Park"),
		language: "German",
		normalizedFullSurface: "ein Spaziergang im Park",
		surfaceKind: "Lemma",
	},
} satisfies Selection<"German", "Standard", "Lemma", "Phraseme", "Cliché">;

// Attestation: "In Berlin sowie im Umland (Agglomeration Berlin) betreibt die [BVG] die U-Bahn Berlin, die Straßenbahn Berlin, den Busverkehr in Berlin und den Fährverkehr in Berlin, nicht jedoch die S-Bahn."
export const germanBVGAbbreviationSelection = {
	language: "German",
	orthographicStatus: "Standard",
	selectionCoverage: "Full",
	spelledSelection: "BVG",
	spellingRelation: "Canonical",
	surface: {
		...makeLexemeSurfaceReference("PROPN", germanBVGLemma.canonicalLemma),
		language: "German",
		normalizedFullSurface: "BVG",
		surfaceKind: "Lemma",
	},
} satisfies Selection<"German", "Standard", "Lemma", "Lexeme", "PROPN">;
