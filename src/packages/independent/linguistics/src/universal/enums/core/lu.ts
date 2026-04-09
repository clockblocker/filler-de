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

const luRepr = {
	Discourse: "discourse",
	Lexeme: "lexeme",
	Morpheme: "morpheme",
	Phraseme: "phraseme",
} satisfies Record<Lu, string>;

const morphologicalFormRepr = {
	Inflection: "inflection",
	Lemma: "lemma",
	Partial: "partial",
	Variant: "variant",
} satisfies Record<SurfaceKind, string>;

const orthographicStatusRepr = {
	Standard: "standard",
	Typo: "typo",
	Variant: "variant",
} satisfies Record<OrthographicStatus, string>;

export function reprForLu(lu: Lu) {
	return luRepr[lu];
}

export function reprForSurfaceKind(morphologicalForm: SurfaceKind) {
	return morphologicalFormRepr[morphologicalForm];
}

export function reprForOrthographicStatus(
	orthographicStatus: OrthographicStatus,
) {
	return orthographicStatusRepr[orthographicStatus];
}
