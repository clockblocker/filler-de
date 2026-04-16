import type { Selection } from "../../../../src";
import { makePhrasemeSurfaceReference } from "../../functions/builders";

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
