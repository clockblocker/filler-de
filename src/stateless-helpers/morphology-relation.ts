import type { TargetLanguage } from "../types";

export type MorphologyRelationType =
	| "derived_from"
	| "compounded_from"
	| "used_in";

type LocalisedMorphologyRelationLabel =
	| "derived_from"
	| "consists_of"
	| "used_in";

const localisedLabelByRelationType: Record<
	MorphologyRelationType,
	LocalisedMorphologyRelationLabel
> = {
	compounded_from: "consists_of",
	derived_from: "derived_from",
	used_in: "used_in",
};

const localizedLabelsByTargetLanguage: Record<
	TargetLanguage,
	Record<LocalisedMorphologyRelationLabel, string>
> = {
	English: {
		consists_of: "Consists of",
		derived_from: "Derived from",
		used_in: "Used in",
	},
	German: {
		consists_of: "Besteht aus",
		derived_from: "Abgeleitet von",
		used_in: "Verwendet in",
	},
};

function normalizeMarker(raw: string): string {
	return raw.trim().toLowerCase();
}

const relationTypeByNormalizedMarker = new Map<
	string,
	MorphologyRelationType
>();

for (const relationType of [
	"derived_from",
	"compounded_from",
	"used_in",
] as const) {
	for (const targetLanguage of ["English", "German"] as const) {
		const marker = markerForRelationType(relationType, targetLanguage);
		relationTypeByNormalizedMarker.set(
			normalizeMarker(marker),
			relationType,
		);
	}
}

function localisedLabel(
	relationType: MorphologyRelationType,
	targetLanguage: TargetLanguage,
): string {
	const label = localisedLabelByRelationType[relationType];
	return localizedLabelsByTargetLanguage[targetLanguage][label];
}

function markerForRelationType(
	relationType: MorphologyRelationType,
	targetLanguage: TargetLanguage,
): string {
	return `${localisedLabel(relationType, targetLanguage)}:`;
}

function markerAliasesForRelationType(
	relationType: MorphologyRelationType,
): string[] {
	const aliases: string[] = [];
	for (const targetLanguage of ["English", "German"] as const) {
		aliases.push(markerForRelationType(relationType, targetLanguage));
	}
	return [...new Set(aliases)];
}

function parseMarker(rawLine: string): MorphologyRelationType | null {
	return relationTypeByNormalizedMarker.get(normalizeMarker(rawLine)) ?? null;
}

export const morphologyRelationHelper = {
	localisedLabel,
	markerAliasesForRelationType,
	markerForRelationType,
	parseMarker,
};
