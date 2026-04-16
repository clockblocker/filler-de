import type { Selection } from "../../../../src";
import {
	makeLexemeSurfaceReference,
	makePhrasemeSurfaceReference,
} from "../../functions/builders";
import { germanBVGLemma } from "./lemmas";

// Attestation: "Ich komme [auf jeden Fall] morgen."
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

// Attestation: "Ich komme auf [jeden Fall] morgen."
export const germanAufJedenFallPartialSelection = {
	language: "German",
	orthographicStatus: "Standard",
	selectionCoverage: "Partial",
	spelledSelection: "jeden Fall",
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
