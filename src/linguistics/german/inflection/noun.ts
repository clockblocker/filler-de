import type {
	CaseValue,
	NumberValue,
} from "../../common/enums/inflection/feature-values";

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
