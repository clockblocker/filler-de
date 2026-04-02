import type {
	LexicalCase,
	LexicalGenus,
	LexicalNumber,
	LexicalPos,
	LexicalVerbConjugation,
	LexicalVerbReflexivity,
	LexicalVerbSeparability,
} from "@textfresser/linguistics";
import type {
	LexemInflections,
	LexicalRelationKind,
} from "@textfresser/lexical-generation";
import type { TargetLanguage } from "../../../types";

export type TextfresserLexemPos = LexicalPos;
export type TextfresserRelationKind = LexicalRelationKind;
export type TextfresserNounInflectionCell = Extract<
	LexemInflections,
	{ kind: "noun" }
>["cells"][number];

const CASE_VALUE_ORDER: readonly LexicalCase[] = [
	"Nominative",
	"Accusative",
	"Genitive",
	"Dative",
];
const NUMBER_VALUE_ORDER: readonly LexicalNumber[] = ["Singular", "Plural"];
const GENUS_LABELS = {
	English: {
		Femininum: "Feminine",
		Maskulinum: "Masculine",
		Neutrum: "Neuter",
	},
	German: {
		Femininum: "Feminin",
		Maskulinum: "Maskulin",
		Neutrum: "Neutrum",
	},
} satisfies Record<TargetLanguage, Record<LexicalGenus, string>>;
const CASE_LABELS = {
	English: {
		Accusative: "Accusative",
		Dative: "Dative",
		Genitive: "Genitive",
		Nominative: "Nominative",
	},
	German: {
		Accusative: "Akkusativ",
		Dative: "Dativ",
		Genitive: "Genitiv",
		Nominative: "Nominativ",
	},
} satisfies Record<TargetLanguage, Record<LexicalCase, string>>;
const NUMBER_LABELS = {
	English: {
		Plural: "Plural",
		Singular: "Singular",
	},
	German: {
		Plural: "Plural",
		Singular: "Singular",
	},
} satisfies Record<TargetLanguage, Record<LexicalNumber, string>>;

export const CASE_ORDER = CASE_VALUE_ORDER;
export const NUMBER_ORDER = NUMBER_VALUE_ORDER;
export const CASE_SHORT_LABEL: Record<LexicalCase, string> = {
	Accusative: "A",
	Dative: "D",
	Genitive: "G",
	Nominative: "N",
};
export const ARTICLE_BY_GENUS: Record<LexicalGenus, "der" | "die" | "das"> = {
	Femininum: "die",
	Maskulinum: "der",
	Neutrum: "das",
};

function buildReverseLookup<TValue extends string>(
	labels: Record<TargetLanguage, Record<TValue, string>>,
): Record<string, TValue> {
	const lookup: Record<string, TValue> = {};

	for (const targetLanguage of Object.keys(labels) as TargetLanguage[]) {
		const labelsForLanguage = labels[targetLanguage];
		for (const value of Object.keys(labelsForLanguage) as TValue[]) {
			lookup[labelsForLanguage[value]] = value;
		}
	}

	return lookup;
}

const CASE_BY_LABEL = buildReverseLookup(CASE_LABELS);
const NUMBER_BY_LABEL = buildReverseLookup(NUMBER_LABELS);

export function getGenusLabelForTargetLanguage(
	genus: LexicalGenus,
	targetLanguage: TargetLanguage,
): string {
	return GENUS_LABELS[targetLanguage][genus];
}

export function getCaseLabelForTargetLanguage(
	caseValue: LexicalCase,
	targetLanguage: TargetLanguage,
): string {
	return CASE_LABELS[targetLanguage][caseValue];
}

export function getNumberLabelForTargetLanguage(
	numberValue: LexicalNumber,
	targetLanguage: TargetLanguage,
): string {
	return NUMBER_LABELS[targetLanguage][numberValue];
}

export function caseValueFromLocalizedLabel(
	localizedLabel: string,
): LexicalCase | undefined {
	return CASE_BY_LABEL[localizedLabel];
}

export function numberValueFromLocalizedLabel(
	localizedLabel: string,
): LexicalNumber | undefined {
	return NUMBER_BY_LABEL[localizedLabel];
}

export function buildVerbEntryIdentity(profile: {
	conjugation: LexicalVerbConjugation;
	valency: {
		governedPreposition?: string;
		reflexivity: LexicalVerbReflexivity;
		separability: LexicalVerbSeparability;
	};
}): string {
	const normalizedPreposition = profile.valency.governedPreposition
		? profile.valency.governedPreposition.trim().toLowerCase()
		: "none";

	return [
		`conjugation:${profile.conjugation}`,
		`separability:${profile.valency.separability}`,
		`reflexivity:${profile.valency.reflexivity}`,
		`preposition:${normalizedPreposition}`,
	].join("|");
}
