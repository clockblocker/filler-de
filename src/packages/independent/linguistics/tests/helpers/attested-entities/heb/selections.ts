import type { KnownSelection, Selection } from "../../../../src";
import {
	hebrewKatvuUnresolvedInflectionSurface,
	hebrewShanaResolvedLemmaSurface,
	hebrewUsAbbreviationResolvedLemmaSurface,
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

// Attestation: "[ארה״ב] הודיעה על צעד חדש."
export const hebrewUsAbbreviationSelection = {
	language: "Hebrew",
	orthographicStatus: "Standard",
	selectionCoverage: "Full",
	spelledSelection: "ארה״ב",
	spellingRelation: "Canonical",
	surface: hebrewUsAbbreviationResolvedLemmaSurface,
} satisfies Selection<"Hebrew", "Standard", "Lemma", "Lexeme", "PROPN">;

// Attestation: "הם [כָּתְבוּ] מכתב."
export const hebrewKatvuPointedVariantSelection = {
	language: "Hebrew",
	orthographicStatus: "Standard",
	selectionCoverage: "Full",
	spelledSelection: "כָּתְבוּ",
	spellingRelation: "Variant",
	surface: {
		...hebrewKatvuUnresolvedInflectionSurface,
		normalizedFullSurface: "כָּתְבוּ",
	},
} satisfies KnownSelection<"Hebrew">;
