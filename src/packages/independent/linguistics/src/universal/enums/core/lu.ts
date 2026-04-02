import { z } from "zod/v3";

const luValues = [
	"Phoneme",
	"Phraseme",
	"Lexeme",
	"Morpheme",
	"Discourse",
] as const;

const morphologicalFormValues = ["Lemma", "Inflection"] as const;

const orthographicStatusValues = ["Standard", "Variant", "Typo"] as const;

export const Lu = z.enum(luValues);
export type Lu = z.infer<typeof Lu>;

export const MorphologicalForm = z.enum(morphologicalFormValues);
export type MorphologicalForm = z.infer<typeof MorphologicalForm>;

export const OrthographicStatus = z.enum(orthographicStatusValues);
export type OrthographicStatus = z.infer<typeof OrthographicStatus>;

const luRepr = {
	Discourse: "discourse",
	Lexeme: "lexeme",
	Morpheme: "morpheme",
	Phoneme: "phoneme",
	Phraseme: "phraseme",
} satisfies Record<Lu, string>;

const morphologicalFormRepr = {
	Inflection: "inflection",
	Lemma: "lemma",
} satisfies Record<MorphologicalForm, string>;

const orthographicStatusRepr = {
	Standard: "standard",
	Typo: "typo",
	Variant: "variant",
} satisfies Record<OrthographicStatus, string>;

export function reprForLu(lu: Lu) {
	return luRepr[lu];
}

export function reprForMorphologicalForm(morphologicalForm: MorphologicalForm) {
	return morphologicalFormRepr[morphologicalForm];
}

export function reprForOrthographicStatus(
	orthographicStatus: OrthographicStatus,
) {
	return orthographicStatusRepr[orthographicStatus];
}
