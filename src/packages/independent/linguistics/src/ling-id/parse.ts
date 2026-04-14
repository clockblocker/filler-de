import type {
	LemmaKind,
	MorphemeKind,
	OrthographicStatus,
	PhrasemeKind,
	Pos,
	SurfaceKind,
} from "../lu/public";
import type { TargetLanguage } from "../lu/universal/enums/core/language";
import { parseOptionalToken, unescapeToken } from "./escape";
import { expectBooleanFeature, parseFeatureBag } from "./features";
import { normalizeObservedSurface } from "./serialize";
import type {
	LingId,
	ParsedLemmaDto,
	ParsedSurfaceDto,
	ParsedTargetedSurfaceDto,
} from "./types";
import { parseHeader } from "./wire";

export function parseLingId(id: LingId): ParsedSurfaceDto {
	const { body, kind, language } = parseHeader(id);

	if (kind === "SURF") {
		return parseSurfaceBody(language, body);
	}

	throw new Error(`Unsupported Ling ID kind: ${kind}`);
}

export function parseLemmaBody(
	language: TargetLanguage,
	body: string,
): ParsedLemmaDto {
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
				lingKind: "Lemma",
				meaningInEmojis,
				pos: lemmaSubKind as Pos,
			};
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
				lingKind: "Lemma",
				meaningInEmojis,
				morphemeKind: lemmaSubKind as MorphemeKind,
				...(lemmaFeatures.separable === undefined
					? {}
					: {
							separable: expectBooleanFeature(
								"separable",
								lemmaFeatures,
							),
						}),
			};
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
					: { discourseFormulaRole }),
				language,
				lemmaKind,
				lingKind: "Lemma",
				meaningInEmojis,
				phrasemeKind: lemmaSubKind as PhrasemeKind,
			};
		}
		default:
			throw new Error(`Unsupported lemma kind in Ling ID: ${lemmaKind}`);
	}
}

function parseSurfaceBody(
	language: TargetLanguage,
	body: string,
): ParsedSurfaceDto {
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
		return parseObservedSurfaceBody(language, body, {
			inflectionalFeaturesToken,
			lemmaKind,
			lemmaSubKind,
			normalizedFullSurfaceToken,
			orthographicStatus,
			surfaceKind,
			targetPayloadToken,
		});
	}

	const target =
		targetMode === "canon"
			? { canonicalLemma: targetPayloadToken }
			: targetMode === "lemma"
				? { lemma: parseLemmaBody(language, targetPayloadToken) }
				: unsupportedTargetMode(targetMode);

	return {
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
		language,
		lingKind: "Surface",
		normalizedFullSurface: unescapeToken(normalizedFullSurfaceToken),
		orthographicStatus: orthographicStatus as Exclude<
			OrthographicStatus,
			"Unknown"
		>,
		surfaceKind: surfaceKind as SurfaceKind,
		target,
	} satisfies ParsedTargetedSurfaceDto;
}

function parseObservedSurfaceBody(
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
): ParsedSurfaceDto {
	const observedLemma = parseLemmaBody(language, targetPayloadToken);
	const normalizedObservedSurface = normalizeObservedSurface(observedLemma);

	if (
		orthographicStatus !== normalizedObservedSurface.orthographicStatus ||
		surfaceKind !== normalizedObservedSurface.surfaceKind ||
		unescapeToken(normalizedFullSurfaceToken) !==
			normalizedObservedSurface.normalizedFullSurface ||
		lemmaKind !== normalizedObservedSurface.discriminators.lemmaKind ||
		lemmaSubKind !==
			normalizedObservedSurface.discriminators.lemmaSubKind ||
		inflectionalFeaturesToken !== "-"
	) {
		throw new Error(`Malformed observed surface Ling ID: ${body}`);
	}

	return normalizedObservedSurface;
}

function unsupportedTargetMode(targetMode: string): never {
	throw new Error(`Unsupported target mode in Ling ID: ${targetMode}`);
}

function splitSurfaceBody(body: string): string[] {
	const parts: string[] = [];
	let remainder = body;

	for (let index = 0; index < 7; index += 1) {
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
