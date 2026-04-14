import type { TargetLanguage } from "../lu/universal/enums/core/language";
import { escapeToken, serializeOptionalToken } from "./escape";
import { compactFeatureBag, serializeFeatureBag } from "./features";
import type {
	ObservedSurfaceLingId,
	ParsedLemmaDto,
	ParsedObservedSurfaceDto,
	ParsedShallowSurfaceDto,
	SerializableLemma,
	SerializableSurface,
	SerializableSurfaceShell,
	ShallowSurfaceLingId,
	SurfaceLingId,
} from "./types";
import { buildHeader, joinLingId } from "./wire";

type SerializableNestedLemma =
	| SerializableLemma
	| Exclude<SerializableSurface["target"], { canonicalLemma: string }>;

export function serializeObservedSurface(
	language: TargetLanguage,
	value: SerializableLemma | ParsedObservedSurfaceDto,
): ObservedSurfaceLingId {
	return serializeSurface(
		language,
		isObservedSurfaceDto(value)
			? normalizeObservedSurface(value.target)
			: normalizeObservedSurface(value),
	);
}

export function serializeSurface(
	language: TargetLanguage,
	value: SerializableSurface,
): SurfaceLingId | ObservedSurfaceLingId {
	const normalizedValue = isObservedSurfaceDto(value)
		? normalizeObservedSurface(value.target)
		: value;
	let targetMode: "canon" | "lemma" | "observed";
	let targetPayload: string;

	if (isObservedSurfaceDto(normalizedValue)) {
		targetMode = "observed";
		targetPayload = serializeLemmaBody(language, normalizedValue.target);
	} else if (isObservedSurfaceTarget(normalizedValue.target)) {
		targetMode = "lemma";
		targetPayload = serializeLemmaBody(language, normalizedValue.target);
	} else {
		targetMode = "canon";
		targetPayload = normalizedValue.target.canonicalLemma;
	}

	return joinLingId([
		buildHeader(language, "SURF"),
		...serializeSurfaceShell(normalizedValue),
		targetMode,
		targetPayload,
	]);
}

export function serializeShallowSurface(
	language: TargetLanguage,
	value: SerializableSurfaceShell,
): ShallowSurfaceLingId {
	return joinLingId([
		buildHeader(language, "SURF-SHALLOW"),
		...serializeSurfaceShell(value),
	]);
}

export function serializeLemmaBody(
	language: TargetLanguage,
	value: SerializableNestedLemma,
): string {
	const normalizedLemma = normalizeLemma(value);

	assertLemmaLanguageMatch(language, normalizedLemma.language);

	return joinLingId([
		escapeToken(normalizedLemma.canonicalLemma),
		normalizedLemma.lemmaKind,
		getLemmaSubKind(normalizedLemma),
		serializeFeatureBag(getLemmaFeatures(normalizedLemma)),
		serializeOptionalToken(normalizedLemma.meaningInEmojis),
	]);
}

export function normalizeObservedSurface(
	value: SerializableLemma,
): ParsedObservedSurfaceDto {
	const observedLemma = normalizeLemma(value);

	return {
		discriminators: {
			lemmaKind: observedLemma.lemmaKind,
			lemmaSubKind: getLemmaSubKind(observedLemma),
		},
		language: observedLemma.language,
		lingKind: "Surface",
		normalizedFullSurface: observedLemma.canonicalLemma,
		observationMode: "observed",
		orthographicStatus: "Standard",
		surfaceKind: "Lemma",
		target: observedLemma,
	};
}

function serializeSurfaceShell(
	value: SerializableSurfaceShell | ParsedShallowSurfaceDto,
): string[] {
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

function normalizeLemma(value: SerializableNestedLemma): ParsedLemmaDto {
	if ("lingKind" in value) {
		switch (value.lemmaKind) {
			case "Lexeme":
				return {
					canonicalLemma: value.canonicalLemma,
					inherentFeatures: compactFeatureBag(value.inherentFeatures),
					language: value.language,
					lemmaKind: value.lemmaKind,
					lingKind: "Lemma",
					meaningInEmojis: value.meaningInEmojis,
					pos: value.pos,
				};
			case "Morpheme":
				return {
					canonicalLemma: value.canonicalLemma,
					isClosedSet: value.isClosedSet,
					language: value.language,
					lemmaKind: value.lemmaKind,
					lingKind: "Lemma",
					meaningInEmojis: value.meaningInEmojis,
					morphemeKind: value.morphemeKind,
					separable: value.separable,
				};
			case "Phraseme":
				return {
					canonicalLemma: value.canonicalLemma,
					discourseFormulaRole:
						"discourseFormulaRole" in value
							? value.discourseFormulaRole
							: undefined,
					language: value.language,
					lemmaKind: value.lemmaKind,
					lingKind: "Lemma",
					meaningInEmojis: value.meaningInEmojis,
					phrasemeKind: value.phrasemeKind,
				};
		}
	}

	switch (value.lemmaKind) {
		case "Lexeme":
			return {
				canonicalLemma: value.canonicalLemma,
				inherentFeatures: compactFeatureBag(value.inherentFeatures),
				language: value.language,
				lemmaKind: value.lemmaKind,
				lingKind: "Lemma",
				meaningInEmojis: value.meaningInEmojis,
				pos: value.pos,
			};
		case "Morpheme":
			return {
				canonicalLemma: value.canonicalLemma,
				isClosedSet: value.isClosedSet,
				language: value.language,
				lemmaKind: value.lemmaKind,
				lingKind: "Lemma",
				meaningInEmojis: value.meaningInEmojis,
				morphemeKind: value.morphemeKind,
				separable: value.separable,
			};
		case "Phraseme":
			return {
				canonicalLemma: value.canonicalLemma,
				discourseFormulaRole:
					"discourseFormulaRole" in value
						? value.discourseFormulaRole
						: undefined,
				language: value.language,
				lemmaKind: value.lemmaKind,
				lingKind: "Lemma",
				meaningInEmojis: value.meaningInEmojis,
				phrasemeKind: value.phrasemeKind,
			};
	}
}

function getLemmaSubKind(value: ParsedLemmaDto): string {
	switch (value.lemmaKind) {
		case "Lexeme":
			return value.pos;
		case "Morpheme":
			return value.morphemeKind;
		case "Phraseme":
			return value.phrasemeKind;
	}
}

function getLemmaFeatures(value: ParsedLemmaDto) {
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

function isObservedSurfaceDto(
	value: SerializableLemma | SerializableSurface | ParsedObservedSurfaceDto,
): value is ParsedObservedSurfaceDto {
	return hasObservedIdentityMode(value);
}

function hasObservedIdentityMode(
	value: unknown,
): value is { observationMode: ParsedObservedSurfaceDto["observationMode"] } {
	return (
		typeof value === "object" &&
		value !== null &&
		"observationMode" in value &&
		(value as { observationMode: unknown }).observationMode === "observed"
	);
}

function isObservedSurfaceTarget(
	target: SerializableSurface["target"],
): target is Exclude<
	SerializableSurface["target"],
	{ canonicalLemma: string }
> {
	return (
		typeof target === "object" && target !== null && "lemmaKind" in target
	);
}

function assertLemmaLanguageMatch(
	expected: TargetLanguage,
	actual: TargetLanguage,
) {
	if (expected !== actual) {
		throw new Error(
			`Ling ID builder language mismatch: expected ${expected}, received ${actual}`,
		);
	}
}
