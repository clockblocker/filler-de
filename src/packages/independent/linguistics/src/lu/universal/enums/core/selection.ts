import { z } from "zod/v3";

// -- OrthographicStatus --

const orthographicStatusValues = [
	"Standard", // Accepted spelling of a known surface
	"Typo", // Misspelling mapped to a known surface
	"Unknown", // No known surface match
] as const;

export const OrthographicStatus = z.enum(orthographicStatusValues);
export type OrthographicStatus = z.infer<typeof OrthographicStatus>;

const reprForOrthographicStatus = {
	Standard: "standard",
	Typo: "typo",
	Unknown: "unknown",
} as const satisfies Record<OrthographicStatus, string>;

function getReprForOrthographicStatus(
	orthographicStatus: OrthographicStatus,
) {
	return reprForOrthographicStatus[orthographicStatus];
}

// -- SpellingRelation --

// This is selection-level spelling metadata, not the UD Variant feature.
const spellingRelationValues = ["Canonical", "Variant"] as const;

export const SpellingRelation = z.enum(spellingRelationValues);
export type SpellingRelation = z.infer<typeof SpellingRelation>;

const reprForSpellingRelation = {
	Canonical: "canonical",
	Variant: "variant",
} as const satisfies Record<SpellingRelation, string>;

function getReprForSpellingRelation(spellingRelation: SpellingRelation) {
	return reprForSpellingRelation[spellingRelation];
}

// -- SelectionCoverage --

const selectionCoverageValues = ["Full", "Partial"] as const;

export const SelectionCoverage = z.enum(selectionCoverageValues);
export type SelectionCoverage = z.infer<typeof SelectionCoverage>;

const reprForSelectionCoverage = {
	Full: "full",
	Partial: "partial",
} as const satisfies Record<SelectionCoverage, string>;

function getReprForSelectionCoverage(
	selectionCoverage: SelectionCoverage,
) {
	return reprForSelectionCoverage[selectionCoverage];
}

// -- SurfaceKind --

const surfaceKinds = ["Inflection", "Lemma"] as const;

export const SurfaceKind = z.enum(surfaceKinds);
export type SurfaceKind = z.infer<typeof SurfaceKind>;

const reprForSurfaceKind = {
	Inflection: "inflection",
	Lemma: "lemma",
} as const satisfies Record<SurfaceKind, string>;

function getReprForSurfaceKind(morphologicalForm: SurfaceKind) {
	return reprForSurfaceKind[morphologicalForm];
}

// -- LemmaKind --

const lemmaKinds = ["Phraseme", "Lexeme", "Morpheme"] as const;

export const LemmaKind = z.enum(lemmaKinds);
export type LemmaKind = z.infer<typeof LemmaKind>;

const reprForLemmaKind = {
	Lexeme: "lexeme",
	Morpheme: "morpheme",
	Phraseme: "phraseme",
} as const satisfies Record<LemmaKind, string>;

function getReprForLemmaKind(lu: LemmaKind) {
	return reprForLemmaKind[lu];
}
