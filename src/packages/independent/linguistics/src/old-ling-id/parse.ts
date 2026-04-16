import type { Lemma } from "../lu/public-entities";
import type { TargetLanguage } from "../lu/universal/enums/core/language";
import type {
	LemmaKind,
	OrthographicStatus,
	SurfaceKind,
} from "../lu/universal/enums/core/selection";
import type { MorphemeKind } from "../lu/universal/enums/kind/morpheme-kind";
import type { PhrasemeKind } from "../lu/universal/enums/kind/phraseme-kind";
import type { Pos } from "../lu/universal/enums/kind/pos";
import { parseOptionalToken, unescapeToken } from "./escape";
import {
	expectBooleanFeature,
	expectYesLiteralFeature,
	parseFeatureBag,
} from "./features";
import { normalizeResolvedSurface } from "./serialize";
import type {
	LingId,
	LingIdResolvedSurface,
	LingIdSelection,
	ParsedShallowSurfaceDto,
	ParsedSurfaceResult,
	ShallowSurfaceLingId,
} from "./types";
import { parseHeader } from "./wire";

type KnownOrthographicStatus = Exclude<OrthographicStatus, "Unknown">;

export function parseLingId(id: LingId): ParsedSurfaceResult {
	const { body, kind, language } = parseHeader(id);

	if (kind === "SURF") {
		return parseSurfaceBody(language, body);
	}

	throw new Error(`Unsupported Ling ID kind: ${kind}`);
}

export function parseShallowSurfaceLingId(
	id: ShallowSurfaceLingId,
): ParsedShallowSurfaceDto {
	const { body, kind, language } = parseHeader(id);

	if (kind === "SURF-SHALLOW") {
		return parseShallowSurfaceBody(language, body);
	}

	throw new Error(`Unsupported Ling ID kind: ${kind}`);
}

export function parseLemmaBody(language: TargetLanguage, body: string): Lemma {
	const parts = body.split(";");

	if (parts.length !== 5) {
		throw new Error(`Malformed lemma payload in Ling ID: ${body}`);
	}

	const [
		canonicalLemmaToken,
		lemmaKind,
		lemmaSubKind,
		featuresToken,
		meaning,
	] = parts as [string, string, string, string, string];

	const canonicalLemma = unescapeToken(canonicalLemmaToken);
	const meaningInEmojis = parseOptionalToken(meaning);

	switch (lemmaKind) {
		case "Lexeme":
			return {
				canonicalLemma,
				inherentFeatures: parseFeatureBag(featuresToken),
				language,
				lemmaKind,
				...(meaningInEmojis === undefined ? {} : { meaningInEmojis }),
				pos: lemmaSubKind as Pos,
			} as Lemma;
		case "Morpheme": {
			const lemmaFeatures = parseFeatureBag(featuresToken);

			return {
				canonicalLemma,
				...(lemmaFeatures.isClosedSet === undefined
					? {}
					: {
							isClosedSet: expectBooleanFeature(
								"isClosedSet",
								lemmaFeatures,
							),
						}),
				language,
				lemmaKind,
				...(meaningInEmojis === undefined ? {} : { meaningInEmojis }),
				morphemeKind: lemmaSubKind as MorphemeKind,
				...(lemmaFeatures.separable === undefined
					? {}
					: {
							separable: expectYesLiteralFeature(
								"separable",
								lemmaFeatures,
							),
						}),
			} as Lemma;
		}
		case "Phraseme": {
			const lemmaFeatures = parseFeatureBag(featuresToken);
			const discourseFormulaRole = lemmaFeatures.discourseFormulaRole;

			if (
				discourseFormulaRole !== undefined &&
				typeof discourseFormulaRole !== "string"
			) {
				throw new Error(
					"Expected discourseFormulaRole to deserialize as a string",
				);
			}

			return {
				canonicalLemma,
				...(discourseFormulaRole === undefined
					? {}
					: { discourseFormulaRole: discourseFormulaRole as string }),
				language,
				lemmaKind,
				...(meaningInEmojis === undefined ? {} : { meaningInEmojis }),
				phrasemeKind: lemmaSubKind as PhrasemeKind,
			} as Lemma;
		}
		default:
			throw new Error(`Unsupported lemma kind in Ling ID: ${lemmaKind}`);
	}
}

function parseSurfaceBody(
	language: TargetLanguage,
	body: string,
): ParsedSurfaceResult {
	const parts = splitSurfaceBody(body);

	if (parts.length !== 8) {
		throw new Error(`Malformed surface Ling ID: ${body}`);
	}

	const [
		normalizedFullSurfaceToken,
		orthographicStatus,
		surfaceKind,
		lemmaKind,
		lemmaSubKind,
		inflectionalFeaturesToken,
		targetMode,
		targetPayloadToken,
	] = parts as [
		string,
		string,
		string,
		string,
		string,
		string,
		string,
		string,
	];

	if (targetMode === "observed") {
		return parseResolvedSurfaceBody(language, body, {
			inflectionalFeaturesToken,
			lemmaKind,
			lemmaSubKind,
			normalizedFullSurfaceToken,
			orthographicStatus,
			surfaceKind,
			targetPayloadToken,
		});
	}

	const normalizedFullSurface = unescapeToken(normalizedFullSurfaceToken);
	const target =
		targetMode === "canon"
			? { canonicalLemma: targetPayloadToken }
			: targetMode === "lemma"
				? parseLemmaBody(language, targetPayloadToken)
				: unsupportedTargetMode(targetMode);

	return {
		language,
		orthographicStatus: orthographicStatus as KnownOrthographicStatus,
		spelledSelection: normalizedFullSurface,
		surface: {
			discriminators: {
				lemmaKind: lemmaKind as LemmaKind,
				lemmaSubKind,
			},
			...(surfaceKind === "Inflection"
				? {
						inflectionalFeatures: parseFeatureBag(
							inflectionalFeaturesToken,
						),
					}
				: {}),
			normalizedFullSurface,
			surfaceKind: surfaceKind as SurfaceKind,
			target,
		},
	} as LingIdSelection;
}

function parseShallowSurfaceBody(
	language: TargetLanguage,
	body: string,
): ParsedShallowSurfaceDto {
	const parts = splitSurfaceBody(body, 6);

	if (parts.length !== 6) {
		throw new Error(`Malformed shallow surface Ling ID: ${body}`);
	}

	const [
		normalizedFullSurfaceToken,
		orthographicStatus,
		surfaceKind,
		lemmaKind,
		lemmaSubKind,
		inflectionalFeaturesToken,
	] = parts as [string, string, string, string, string, string];

	return {
		language,
		orthographicStatus: orthographicStatus as KnownOrthographicStatus,
		surface: {
			discriminators: {
				lemmaKind: lemmaKind as LemmaKind,
				lemmaSubKind,
			},
			...(surfaceKind === "Inflection"
				? {
						inflectionalFeatures: parseFeatureBag(
							inflectionalFeaturesToken,
						),
					}
				: {}),
			normalizedFullSurface: unescapeToken(normalizedFullSurfaceToken),
			surfaceKind: surfaceKind as SurfaceKind,
		},
	};
}

function parseResolvedSurfaceBody(
	language: TargetLanguage,
	body: string,
	{
		inflectionalFeaturesToken,
		lemmaKind,
		lemmaSubKind,
		normalizedFullSurfaceToken,
		orthographicStatus,
		surfaceKind,
		targetPayloadToken,
	}: {
		inflectionalFeaturesToken: string;
		lemmaKind: string;
		lemmaSubKind: string;
		normalizedFullSurfaceToken: string;
		orthographicStatus: string;
		surfaceKind: string;
		targetPayloadToken: string;
	},
): LingIdResolvedSurface {
	const resolvedLemma = parseLemmaBody(language, targetPayloadToken);
	const normalizedResolvedSurface = normalizeResolvedSurface(resolvedLemma);

	if (
		orthographicStatus !== "Standard" ||
		surfaceKind !== normalizedResolvedSurface.surfaceKind ||
		unescapeToken(normalizedFullSurfaceToken) !==
			normalizedResolvedSurface.normalizedFullSurface ||
		lemmaKind !== normalizedResolvedSurface.discriminators.lemmaKind ||
		lemmaSubKind !==
			normalizedResolvedSurface.discriminators.lemmaSubKind ||
		inflectionalFeaturesToken !== "-"
	) {
		throw new Error(`Malformed resolved surface Ling ID: ${body}`);
	}

	return normalizedResolvedSurface as LingIdResolvedSurface;
}

function unsupportedTargetMode(targetMode: string): never {
	throw new Error(`Unsupported target mode in Ling ID: ${targetMode}`);
}

function splitSurfaceBody(body: string, partCount = 8): string[] {
	const parts: string[] = [];
	let remainder = body;

	for (let index = 0; index < partCount - 1; index += 1) {
		const separatorIndex = remainder.indexOf(";");

		if (separatorIndex === -1) {
			throw new Error(`Malformed surface Ling ID: ${body}`);
		}

		parts.push(remainder.slice(0, separatorIndex));
		remainder = remainder.slice(separatorIndex + 1);
	}

	parts.push(remainder);

	return parts;
}
