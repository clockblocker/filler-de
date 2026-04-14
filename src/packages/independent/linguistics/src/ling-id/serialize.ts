import type { TargetLanguage } from "../lu/universal/enums/core/language";
import { escapeToken, serializeOptionalToken } from "./escape";
import { compactFeatureBag, serializeFeatureBag } from "./features";
import type {
	LemmaLingId,
	SerializableLemma,
	SerializableSurface,
	ShallowSurfaceLingId,
	SurfaceLingId,
} from "./types";
import { buildHeader, joinLingId } from "./wire";

export function serializeLemma(
	language: TargetLanguage,
	value: SerializableLemma,
): LemmaLingId {
	const subKind = getLemmaSubKind(value);
	const lemmaFeatures = serializeFeatureBag(getLemmaFeatures(value));

	return joinLingId([
		buildHeader(language, "LEM"),
		escapeToken(value.canonicalLemma),
		value.lemmaKind,
		subKind,
		lemmaFeatures,
		serializeOptionalToken(value.meaningInEmojis),
	]);
}

export function serializeSurface(
	language: TargetLanguage,
	value: SerializableSurface,
	serializeNestedLemma: (value: SerializableLemma) => LemmaLingId,
): SurfaceLingId {
	let targetMode: "canon" | "lemma";
	let targetPayload: string;

	if ("lemma" in value.target) {
		targetMode = "lemma";
		targetPayload = escapeToken(serializeNestedLemma(value.target.lemma));
	} else {
		targetMode = "canon";
		targetPayload = escapeToken(value.target.canonicalLemma);
	}

	return joinLingId([
		buildHeader(language, "SURF"),
		...serializeSurfaceShell(value),
		targetMode,
		targetPayload,
	]);
}

export function serializeShallowSurface(
	language: TargetLanguage,
	value: SerializableSurface,
): ShallowSurfaceLingId {
	return joinLingId([
		buildHeader(language, "SURF-SHALLOW"),
		...serializeSurfaceShell(value),
	]);
}

function serializeSurfaceShell(value: SerializableSurface): string[] {
	return [
		escapeToken(value.normalizedFullSurface),
		value.orthographicStatus,
		value.surfaceKind,
		value.discriminators.lemmaKind,
		value.discriminators.lemmaSubKind,
		value.surfaceKind === "Inflection"
			? serializeFeatureBag(value.inflectionalFeatures ?? {})
			: "-",
	];
}

function getLemmaSubKind(value: SerializableLemma): string {
	switch (value.lemmaKind) {
		case "Lexeme":
			return value.pos;
		case "Morpheme":
			return value.morphemeKind;
		case "Phraseme":
			return value.phrasemeKind;
	}
}

function getLemmaFeatures(value: SerializableLemma) {
	switch (value.lemmaKind) {
		case "Lexeme":
			return value.inherentFeatures;
		case "Morpheme":
			return compactFeatureBag({
				isClosedSet: value.isClosedSet,
				separable: value.separable,
			});
		case "Phraseme":
			return compactFeatureBag({
				discourseFormulaRole:
					"discourseFormulaRole" in value
						? value.discourseFormulaRole
						: undefined,
			});
	}
}
