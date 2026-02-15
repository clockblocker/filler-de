import { z } from "zod/v3";
import type { TargetLanguage } from "../../../../types";

// -- Number --

const NUMBER_VALUES = ["Singular", "Plural"] as const;

export const NumberValueSchema = z.enum(NUMBER_VALUES);
export type NumberValue = z.infer<typeof NumberValueSchema>;
export const NumberValue = NumberValueSchema.enum;
export const NUMBER_VALUE_OPTIONS = NumberValueSchema.options;

export const NUMBER_LABEL_FOR_TARGET_LANGUAGE = {
	English: {
		Plural: "Plural",
		Singular: "Singular",
	},
	German: {
		Plural: "Plural",
		Singular: "Singular",
	},
} satisfies Record<TargetLanguage, Record<NumberValue, string>>;

// -- Case --

const CASE_VALUES = ["Nominative", "Accusative", "Dative", "Genitive"] as const;

export const CaseValueSchema = z.enum(CASE_VALUES);
export type CaseValue = z.infer<typeof CaseValueSchema>;
export const CaseValue = CaseValueSchema.enum;
export const CASE_VALUE_OPTIONS = CaseValueSchema.options;

export const CASE_LABEL_FOR_TARGET_LANGUAGE = {
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
} satisfies Record<TargetLanguage, Record<CaseValue, string>>;

type LabelRecord<TValue extends string> = Record<TargetLanguage, Record<TValue, string>>;

function buildValueByLocalizedLabel<TValue extends string>(
	labelsByLanguage: LabelRecord<TValue>,
): Record<string, TValue> {
	const result: Record<string, TValue> = {};

	const targetLanguages = Object.keys(labelsByLanguage) as TargetLanguage[];
	for (const targetLanguage of targetLanguages) {
		const localizedByValue = labelsByLanguage[targetLanguage];
		const values = Object.keys(localizedByValue) as TValue[];
		for (const value of values) {
			const localized = localizedByValue[value];
			result[localized] = value;
		}
	}

	return result;
}

const CASE_VALUE_BY_LOCALIZED_LABEL = buildValueByLocalizedLabel(
	CASE_LABEL_FOR_TARGET_LANGUAGE,
);
const NUMBER_VALUE_BY_LOCALIZED_LABEL = buildValueByLocalizedLabel(
	NUMBER_LABEL_FOR_TARGET_LANGUAGE,
);

export function getCaseLabelForTargetLanguage(
	caseValue: CaseValue,
	targetLanguage: TargetLanguage,
): string {
	return CASE_LABEL_FOR_TARGET_LANGUAGE[targetLanguage][caseValue];
}

export function getNumberLabelForTargetLanguage(
	numberValue: NumberValue,
	targetLanguage: TargetLanguage,
): string {
	return NUMBER_LABEL_FOR_TARGET_LANGUAGE[targetLanguage][numberValue];
}

export function caseValueFromLocalizedLabel(
	localizedLabel: string,
): CaseValue | undefined {
	return CASE_VALUE_BY_LOCALIZED_LABEL[localizedLabel];
}

export function numberValueFromLocalizedLabel(
	localizedLabel: string,
): NumberValue | undefined {
	return NUMBER_VALUE_BY_LOCALIZED_LABEL[localizedLabel];
}
