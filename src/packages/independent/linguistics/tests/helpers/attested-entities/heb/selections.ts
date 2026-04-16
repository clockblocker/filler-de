import type { KnownSelection, Selection } from "../../../../src";
import {
	hebrewKatvuUnresolvedInflectionSurface,
	hebrewShanaResolvedLemmaSurface,
} from "./surfaces";

// Attestation: "הם [כתבו] מכתב."
export const hebrewKatvuStandardFullSelection = {
	language: "Hebrew",
	orthographicStatus: "Standard",
	selectionCoverage: "Full",
	spelledSelection: "כתבו",
	spellingRelation: "Canonical",
	surface: hebrewKatvuUnresolvedInflectionSurface,
} satisfies KnownSelection<"Hebrew">;

// Attestation: "עוד [שנה] עברה."
export const hebrewShanaResolvedLemmaSelection = {
	language: "Hebrew",
	orthographicStatus: "Standard",
	selectionCoverage: "Full",
	spelledSelection: "שנה",
	spellingRelation: "Canonical",
	surface: hebrewShanaResolvedLemmaSurface,
} satisfies Selection<"Hebrew", "Standard", "Lemma", "Lexeme", "NOUN">;
