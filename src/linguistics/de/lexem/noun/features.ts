import { z } from "zod/v3";
import type {
	CaseValue,
	NumberValue,
} from "../../../common/enums/inflection/feature-values";
import type { POS } from "../../../common/enums/linguistic-units/lexem/pos";

// -- Genus --

const germanGenusValues = ["Maskulinum", "Femininum", "Neutrum"] as const;

export const GermanGenusSchema = z.enum(germanGenusValues);
export type GermanGenus = z.infer<typeof GermanGenusSchema>;
export const GermanGenus = GermanGenusSchema.enum;
export const GERMAN_GENUS_VALUES = GermanGenusSchema.options;

export const articleFromGenus: Record<GermanGenus, "der" | "die" | "das"> = {
	Femininum: "die",
	Maskulinum: "der",
	Neutrum: "das",
};

// -- Noun class --

const nounClassValues = ["Common", "Proper"] as const;
export const NounClassSchema = z.enum(nounClassValues);
export type NounClass = z.infer<typeof NounClassSchema>;

// -- Noun features --

/** Full features for a Noun Lemma surface — genus + nounClass. */
export const GermanNounFullFeaturesSchema = z.object({
	genus: GermanGenusSchema,
	nounClass: NounClassSchema,
	pos: z.literal("Noun" satisfies POS),
});

/** Ref features for Noun Inflected/Variant — genus lives on the Lemma entry. */
export const GermanNounRefFeaturesSchema = z.object({
	pos: z.literal("Noun" satisfies POS),
});

// -- Inflection --

export type NounInflectionCell = {
	case: CaseValue;
	number: NumberValue;
	article: string;
	form: string;
};

export const GERMAN_CASE_TAG: Record<CaseValue, string> = {
	Accusative: "Akkusativ",
	Dative: "Dativ",
	Genitive: "Genitiv",
	Nominative: "Nominativ",
};

export const GERMAN_NUMBER_TAG: Record<NumberValue, string> = {
	Plural: "Plural",
	Singular: "Singular",
};

export const CASE_SHORT_LABEL: Record<CaseValue, string> = {
	Accusative: "A",
	Dative: "D",
	Genitive: "G",
	Nominative: "N",
};

/** Display order for cases in the inflection section. */
export const CASE_ORDER: readonly CaseValue[] = [
	"Nominative",
	"Accusative",
	"Genitive",
	"Dative",
];
