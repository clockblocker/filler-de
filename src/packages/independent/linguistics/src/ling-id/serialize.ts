import type { Lemma } from "../lu/public";
import type { TargetLanguage } from "../lu/universal/enums/core/language";
import type { OrthographicStatus } from "../lu/universal/enums/core/selection";
import { escapeToken, serializeOptionalToken } from "./escape";
import { compactFeatureBag, serializeFeatureBag } from "./features";
import type {
	LingIdResolvedSurface,
	LingIdSelection,
	ParsedShallowSurfaceDto,
	ResolvedSurfaceLingId,
	SerializableLemma,
	SerializableSurface,
	SerializableSurfaceShell,
	ShallowSurfaceLingId,
	SurfaceLingId,
} from "./types";
import { buildHeader, joinLingId } from "./wire";

type KnownOrthographicStatus = Exclude<OrthographicStatus, "Unknown">;

type SerializableNestedLemma = Lemma;

type NormalizedResolvedSurface = {
	discriminators: {
		lemmaKind: Lemma["lemmaKind"];
		lemmaSubKind: string;
	};
	normalizedFullSurface: string;
	surfaceKind: "Lemma";
	target: Lemma;
};

type SerializedSurfaceShell = {
	orthographicStatus: KnownOrthographicStatus;
	surface:
		| LingIdSelection["surface"]
		| ParsedShallowSurfaceDto["surface"]
		| NormalizedResolvedSurface;
};

export function serializeResolvedSurface(
	language: TargetLanguage,
	value: SerializableLemma | LingIdResolvedSurface,
): ResolvedSurfaceLingId {
	const normalizedValue = normalizeResolvedSurface(value);

	return joinLingId([
		buildHeader(language, "SURF"),
		...serializeSurfaceShell({
			orthographicStatus: "Standard",
			surface: normalizedValue,
		}),
		"observed",
		serializeLemmaBody(language, normalizedValue.target),
	]);
}

export function serializeSurface(
	language: TargetLanguage,
	value: SerializableSurface,
): SurfaceLingId | ResolvedSurfaceLingId {
	if (!isSelectionValue(value)) {
		return serializeResolvedSurface(language, value);
	}

	let targetMode: "canon" | "lemma";
	let targetPayload: string;

	if (isResolvedSurfaceTarget(value.surface.target)) {
		targetMode = "lemma";
		targetPayload = serializeLemmaBody(language, value.surface.target);
	} else {
		targetMode = "canon";
		targetPayload = value.surface.target.canonicalLemma;
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
	value: SerializableSurfaceShell,
): ShallowSurfaceLingId {
	return joinLingId([
		buildHeader(language, "SURF-SHALLOW"),
		...serializeSurfaceShell(getSurfaceShell(value)),
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

export function normalizeResolvedSurface(
	value: SerializableLemma | LingIdResolvedSurface,
): NormalizedResolvedSurface {
	const resolvedLemma = normalizeLemma(
		typeof value === "object" && value !== null && "target" in value
			? (value as { target: Lemma }).target
			: value,
	);

	return {
		discriminators: {
			lemmaKind: resolvedLemma.lemmaKind,
			lemmaSubKind: getLemmaSubKind(resolvedLemma),
		},
		normalizedFullSurface: resolvedLemma.canonicalLemma,
		surfaceKind: "Lemma",
		target: resolvedLemma,
	};
}

function serializeSurfaceShell(value: SerializedSurfaceShell): string[] {
	return [
		escapeToken(value.surface.normalizedFullSurface),
		value.orthographicStatus,
		value.surface.surfaceKind,
		value.surface.discriminators.lemmaKind,
		value.surface.discriminators.lemmaSubKind,
		value.surface.surfaceKind === "Inflection"
			? serializeFeatureBag(value.surface.inflectionalFeatures ?? {})
			: "-",
	];
}

function normalizeLemma(value: SerializableNestedLemma): Lemma {
	switch (value.lemmaKind) {
		case "Lexeme":
			return {
				canonicalLemma: value.canonicalLemma,
				inherentFeatures: compactFeatureBag(value.inherentFeatures),
				language: value.language,
				lemmaKind: value.lemmaKind,
				...(value.meaningInEmojis === undefined
					? {}
					: { meaningInEmojis: value.meaningInEmojis }),
				pos: value.pos,
			} as Lemma;
		case "Morpheme":
			return {
				canonicalLemma: value.canonicalLemma,
				isClosedSet: value.isClosedSet,
				language: value.language,
				lemmaKind: value.lemmaKind,
				...(value.meaningInEmojis === undefined
					? {}
					: { meaningInEmojis: value.meaningInEmojis }),
				morphemeKind: value.morphemeKind,
				...(!("separable" in value) || value.separable === undefined
					? {}
					: { separable: value.separable }),
			} as Lemma;
		case "Phraseme":
			return {
				canonicalLemma: value.canonicalLemma,
				...("discourseFormulaRole" in value &&
				value.discourseFormulaRole !== undefined
					? { discourseFormulaRole: value.discourseFormulaRole }
					: {}),
				language: value.language,
				lemmaKind: value.lemmaKind,
				...(value.meaningInEmojis === undefined
					? {}
					: { meaningInEmojis: value.meaningInEmojis }),
				phrasemeKind: value.phrasemeKind,
			} as Lemma;
	}
}

function getLemmaSubKind(value: Lemma): string {
	switch (value.lemmaKind) {
		case "Lexeme":
			return value.pos;
		case "Morpheme":
			return value.morphemeKind;
		case "Phraseme":
			return value.phrasemeKind;
	}
}

function getLemmaFeatures(value: Lemma) {
	switch (value.lemmaKind) {
		case "Lexeme":
			return value.inherentFeatures;
		case "Morpheme":
			return compactFeatureBag({
				isClosedSet: value.isClosedSet,
				separable: "separable" in value ? value.separable : undefined,
			});
		case "Phraseme":
			return compactFeatureBag({
				discourseFormulaRole:
					"discourseFormulaRole" in value
						? (value.discourseFormulaRole as string | undefined)
						: undefined,
			});
	}
}

function isSelectionValue(value: unknown): value is LingIdSelection {
	return typeof value === "object" && value !== null && "surface" in value;
}

function isResolvedSurfaceValue(
	value: unknown,
): value is LingIdResolvedSurface {
	return (
		typeof value === "object" &&
		value !== null &&
		"target" in value &&
		"surfaceKind" in value &&
		!("surface" in value)
	);
}

function getSurfaceShell(
	value: SerializableSurfaceShell,
): SerializedSurfaceShell {
	if (isSelectionValue(value)) {
		return value;
	}

	if (isResolvedSurfaceValue(value)) {
		return {
			orthographicStatus: "Standard",
			surface: value,
		};
	}

	return value;
}

function isResolvedSurfaceTarget(
	target: LingIdSelection["surface"]["target"],
): target is Exclude<
	LingIdSelection["surface"]["target"],
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
