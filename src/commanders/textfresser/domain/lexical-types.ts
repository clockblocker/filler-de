import type {
	Case,
	Gender,
	GrammaticalNumber,
	InherentFeatures,
	LexemeInflections,
	LexicalRelationKind,
} from "@textfresser/lexical-generation";
import type { TargetLanguage } from "../../../types";
import type { POS } from "./note-linguistic-policy";

export type LexicalCase = Extract<Case, "Acc" | "Dat" | "Gen" | "Nom">;
export type LexicalGenus = Extract<Gender, "Fem" | "Masc" | "Neut">;
export type LexicalNumber = Extract<GrammaticalNumber, "Plur" | "Sing">;
export type TextfresserLexemePos = POS;
export type TextfresserRelationKind = LexicalRelationKind;
export type TextfresserNounInflectionCell = {
	article: string;
	case: LexicalCase;
	form: string;
	number: LexicalNumber;
};

const CASE_VALUE_ORDER: readonly LexicalCase[] = ["Nom", "Acc", "Gen", "Dat"];
const NUMBER_VALUE_ORDER: readonly LexicalNumber[] = ["Sing", "Plur"];
const GENUS_LABELS = {
	English: {
		Fem: "Feminine",
		Masc: "Masculine",
		Neut: "Neuter",
	},
	German: {
		Fem: "Feminin",
		Masc: "Maskulin",
		Neut: "Neutrum",
	},
} satisfies Record<TargetLanguage, Record<LexicalGenus, string>>;
const CASE_LABELS = {
	English: {
		Acc: "Accusative",
		Dat: "Dative",
		Gen: "Genitive",
		Nom: "Nominative",
	},
	German: {
		Acc: "Akkusativ",
		Dat: "Dativ",
		Gen: "Genitiv",
		Nom: "Nominativ",
	},
} satisfies Record<TargetLanguage, Record<LexicalCase, string>>;
const NUMBER_LABELS = {
	English: {
		Plur: "Plural",
		Sing: "Singular",
	},
	German: {
		Plur: "Plural",
		Sing: "Singular",
	},
} satisfies Record<TargetLanguage, Record<LexicalNumber, string>>;

export const CASE_ORDER = CASE_VALUE_ORDER;
export const NUMBER_ORDER = NUMBER_VALUE_ORDER;
export const CASE_SHORT_LABEL: Record<LexicalCase, string> = {
	Acc: "A",
	Dat: "D",
	Gen: "G",
	Nom: "N",
};
export const ARTICLE_BY_GENUS: Record<LexicalGenus, "der" | "die" | "das"> = {
	Fem: "die",
	Masc: "der",
	Neut: "das",
};

export function isLexicalCase(value: Case): value is LexicalCase {
	return value === "Nom" || value === "Acc" || value === "Gen" || value === "Dat";
}

export function isLexicalGenus(value: Gender): value is LexicalGenus {
	return value === "Fem" || value === "Masc" || value === "Neut";
}

export function isLexicalNumber(
	value: GrammaticalNumber,
): value is LexicalNumber {
	return value === "Sing" || value === "Plur";
}

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
	inherentFeatures: Pick<InherentFeatures, "reflex" | "separable">;
}): string {
	return [
		`reflex:${profile.inherentFeatures.reflex === true ? "yes" : "no"}`,
		`separable:${
			profile.inherentFeatures.separable === undefined
				? "unknown"
				: profile.inherentFeatures.separable
					? "yes"
					: "no"
		}`,
	].join("|");
}
