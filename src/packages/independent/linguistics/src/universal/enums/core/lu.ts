import { z } from "zod/v3";

const luValues = ["Phraseme", "Lexeme", "Morpheme", "Discourse"] as const;

// Variant is like color vs colour, email vs e-mail.
// Partial means the selected surface covers only part of a multi-word lemma.
const surfaceKinds = ["Lemma", "Inflection", "Variant", "Partial"] as const;

const orthographicStatusValues = ["Standard", "Variant", "Typo"] as const;

export const Lu = z.enum(luValues);
export type Lu = z.infer<typeof Lu>;

export const SurfaceKind = z.enum(surfaceKinds);
export type SurfaceKind = z.infer<typeof SurfaceKind>;

export const OrthographicStatus = z.enum(orthographicStatusValues);
export type OrthographicStatus = z.infer<typeof OrthographicStatus>;

const reprForLu = {
	Discourse: "discourse",
	Lexeme: "lexeme",
	Morpheme: "morpheme",
	Phraseme: "phraseme",
} satisfies Record<Lu, string>;

export function getReprForLu(lu: Lu) {
	return reprForLu[lu];
}

const reprForSurfaceKind = {
	Inflection: "inflection",
	Lemma: "lemma",
	Partial: "partial",
	Variant: "variant",
} satisfies Record<SurfaceKind, string>;

export function getReprForSurfaceKind(morphologicalForm: SurfaceKind) {
	return reprForSurfaceKind[morphologicalForm];
}

const reprForOrthographicStatus = {
	Standard: "standard",
	Typo: "typo",
	Variant: "variant",
} satisfies Record<OrthographicStatus, string>;

export function getReprForOrthographicStatus(
	orthographicStatus: OrthographicStatus,
) {
	return reprForOrthographicStatus[orthographicStatus];
}
