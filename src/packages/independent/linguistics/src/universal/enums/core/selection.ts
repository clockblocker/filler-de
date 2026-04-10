import { z } from "zod/v3";

// -- OrthographicStatus --

const orthographicStatusValues = [
	"Standard", // Accepted spelling of a known surface
	"Typo",     // Misspelling mapped to a known surface
	"Unknown",  // No known surface match
] as const;

export const OrthographicStatus = z.enum(orthographicStatusValues);
export type OrthographicStatus = z.infer<typeof OrthographicStatus>;

const reprForOrthographicStatus = {
	Standard: "standard",
	Typo: "typo",
	Unknown: "unknown",
} as const satisfies Record<OrthographicStatus, string>;

export function getReprForOrthographicStatus(
	orthographicStatus: OrthographicStatus,
) {
	return reprForOrthographicStatus[orthographicStatus];
}

// -- SurfaceKind --

// Variant is like color vs colour, email vs e-mail.
// Partial means the selected surface covers only part of a multi-word lemma.
const surfaceKinds = ["Inflection", "Lemma", "Variant", "Partial"] as const;

export const SurfaceKind = z.enum(surfaceKinds);
export type SurfaceKind = z.infer<typeof SurfaceKind>;

const reprForSurfaceKind = {
	Inflection: "inflection",
	Lemma: "lemma",
	Partial: "partial",
	Variant: "variant",
} as const satisfies Record<SurfaceKind, string>;

export function getReprForSurfaceKind(morphologicalForm: SurfaceKind) {
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

export function getReprForLemmaKind(lu: LemmaKind) {
	return reprForLemmaKind[lu];
}
