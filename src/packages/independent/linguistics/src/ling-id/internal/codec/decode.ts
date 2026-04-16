import { err, ok, type Result } from "neverthrow";
import type { Lemma } from "../../../lu/public-entities";
import type { TargetLanguage } from "../../../lu/universal/enums/core/language";
import type {
	ConcreteLingIdKind,
	LingIdDecodeError,
	LingIdValueFor,
} from "../../types";
import { lingIdDecodeError } from "../errors";
import { getRuntimeSchema } from "../guards";
import { parseFeatureBag } from "../wire/feature-bag";
import { parseHeader } from "../wire/header";
import {
	parseOptionalToken,
	splitLeadingTokens,
	unescapeToken,
} from "../wire/tokens";

export function decodeLingId<L extends TargetLanguage>(
	language: L,
	input: string,
): Result<LingIdValueFor<ConcreteLingIdKind, L>, LingIdDecodeError> {
	return decodeLingIdInternal(language, input);
}

export function decodeLingIdAs<L extends TargetLanguage, K extends ConcreteLingIdKind>(
	language: L,
	expectedKind: K,
	input: string,
): Result<LingIdValueFor<K, L>, LingIdDecodeError> {
	const decoded = decodeLingIdInternal(language, input);

	if (decoded.isErr()) {
		return err(decoded.error);
	}

	const header = parseHeader(input);

	if (header.kind !== expectedKind) {
		return err(
			lingIdDecodeError(
				"EntityMismatch",
				input,
				`Ling ID entity mismatch: expected ${expectedKind}, received ${header.kind}`,
			),
		);
	}

	return ok(decoded.value as LingIdValueFor<K, L>);
}

function decodeLingIdInternal<L extends TargetLanguage>(
	language: L,
	input: string,
): Result<LingIdValueFor<ConcreteLingIdKind, L>, LingIdDecodeError> {
	let header;

	try {
		header = parseHeader(input);
	} catch (cause) {
		return err(classifyHeaderError(input, cause));
	}

	if (header.language !== language) {
		return err(
			lingIdDecodeError(
				"LanguageMismatch",
				input,
				`Ling ID language mismatch: expected ${language}, received ${header.language}`,
			),
		);
	}

	let parsedValue: unknown;

	try {
		parsedValue = parsePayload(language, header.kind, header.body);
	} catch (cause) {
		return err(
			lingIdDecodeError(
				"PayloadDecodeFailed",
				input,
				"Failed to parse Ling ID payload",
				cause,
			),
		);
	}

	const validation = getRuntimeSchema(language, header.kind).safeParse(
		parsedValue,
	);

	if (!validation.success) {
		return err(
			lingIdDecodeError(
				"PayloadDecodeFailed",
				input,
				"Decoded Ling ID payload does not match the entity schema",
				validation.error,
			),
		);
	}

	return ok(validation.data as LingIdValueFor<ConcreteLingIdKind, L>);
}

function classifyHeaderError(input: string, cause: unknown): LingIdDecodeError {
	const message =
		cause instanceof Error ? cause.message : "Malformed Ling ID";

	if (message.startsWith("Unsupported Ling ID version:")) {
		return lingIdDecodeError("UnsupportedVersion", input, message, cause);
	}

	if (message.startsWith("Unsupported language code")) {
		return lingIdDecodeError("UnsupportedLanguage", input, message, cause);
	}

	if (message.startsWith("Unsupported Ling ID kind:")) {
		return lingIdDecodeError(
			"UnsupportedEntityKind",
			input,
			message,
			cause,
		);
	}

	return lingIdDecodeError("MalformedLingId", input, message, cause);
}

function parsePayload(
	language: TargetLanguage,
	kind: ConcreteLingIdKind,
	body: string,
): unknown {
	switch (kind) {
		case "Lemma":
			return parseLemmaPayload(language, body);
		case "Selection":
			return parseSelectionPayload(language, body);
		case "ResolvedSurface":
			return parseSurfacePayload(language, "ResolvedSurface", body);
		case "UnresolvedSurface":
			return parseSurfacePayload(language, "UnresolvedSurface", body);
	}
}

function parseSelectionPayload(
	language: TargetLanguage,
	body: string,
): unknown {
	const parts = splitLeadingTokens(body, 11, "selection");

	if (parts.length !== 11) {
		throw new Error(`Malformed selection payload in Ling ID: ${body}`);
	}

	const [
		orthographicStatus,
		selectionCoverage,
		spelledSelectionToken,
		normalizedSelectedSurfaceToken,
		normalizedFullSurfaceToken,
		surfaceKind,
		lemmaKind,
		lemmaSubKind,
		inflectionalFeaturesToken,
		targetMode,
		targetPayload,
	] = parts as [
		string,
		string,
		string,
		string,
		string,
		string,
		string,
		string,
		string,
		string,
		string,
	];
	const normalizedSelectedSurface =
		normalizedSelectedSurfaceToken === "-"
			? undefined
			: parseOptionalToken(normalizedSelectedSurfaceToken);

	return {
		language,
		...(normalizedSelectedSurface === undefined
			? {}
			: { normalizedSelectedSurface }),
		orthographicStatus,
		selectionCoverage,
		spelledSelection: unescapeToken(spelledSelectionToken),
		surface: {
			...parseSurfaceCore(language, {
				inflectionalFeaturesToken,
				lemmaKind,
				lemmaSubKind,
				normalizedFullSurfaceToken,
				surfaceKind,
			}),
			target: parseSelectionTarget(language, targetMode, targetPayload),
		},
	};
}

function parseSurfacePayload(
	language: TargetLanguage,
	kind: "ResolvedSurface" | "UnresolvedSurface",
	body: string,
): unknown {
	const parts = splitLeadingTokens(body, 6, "surface");

	if (parts.length !== 6) {
		throw new Error(`Malformed surface payload in Ling ID: ${body}`);
	}

	const [
		normalizedFullSurfaceToken,
		surfaceKind,
		lemmaKind,
		lemmaSubKind,
		inflectionalFeaturesToken,
		targetPayload,
	] = parts as [string, string, string, string, string, string];

	return {
		...parseSurfaceCore(language, {
			inflectionalFeaturesToken,
			lemmaKind,
			lemmaSubKind,
			normalizedFullSurfaceToken,
			surfaceKind,
		}),
		target:
			kind === "ResolvedSurface"
				? parseLemmaPayload(language, targetPayload)
				: { canonicalLemma: unescapeToken(targetPayload) },
	};
}

function parseSurfaceCore(
	language: TargetLanguage,
	{
		inflectionalFeaturesToken,
		lemmaKind,
		lemmaSubKind,
		normalizedFullSurfaceToken,
		surfaceKind,
	}: {
		inflectionalFeaturesToken: string;
		lemmaKind: string;
		lemmaSubKind: string;
		normalizedFullSurfaceToken: string;
		surfaceKind: string;
	},
) {
	return {
		discriminators: {
			lemmaKind,
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
		normalizedFullSurface: unescapeToken(normalizedFullSurfaceToken),
		surfaceKind,
	};
}

function parseSelectionTarget(
	language: TargetLanguage,
	targetMode: string,
	targetPayload: string,
) {
	if (targetMode === "canon") {
		return { canonicalLemma: unescapeToken(targetPayload) };
	}

	if (targetMode === "lemma") {
		return parseLemmaPayload(language, targetPayload);
	}

	throw new Error(
		`Unsupported selection target mode in Ling ID: ${targetMode}`,
	);
}

function parseLemmaPayload(language: TargetLanguage, body: string): Lemma {
	const parts = splitLeadingTokens(body, 5, "lemma");

	if (parts.length !== 5) {
		throw new Error(`Malformed lemma payload in Ling ID: ${body}`);
	}

	const [
		canonicalLemmaToken,
		lemmaKind,
		lemmaSubKind,
		featuresToken,
		meaningToken,
	] = parts as [string, string, string, string, string];
	const meaningInEmojis = parseOptionalToken(meaningToken);

	const base = {
		canonicalLemma: unescapeToken(canonicalLemmaToken),
		language,
		...(meaningInEmojis === undefined ? {} : { meaningInEmojis }),
	};

	switch (lemmaKind) {
		case "Lexeme":
			return {
				...base,
				inherentFeatures: parseFeatureBag(featuresToken),
				lemmaKind,
				pos: lemmaSubKind,
			} as Lemma;
		case "Morpheme": {
			const features = parseFeatureBag(featuresToken);
			return {
				...base,
				...("hasSepPrefix" in features
					? { hasSepPrefix: features.hasSepPrefix as string }
					: {}),
				...("isClosedSet" in features
					? { isClosedSet: features.isClosedSet }
					: {}),
				lemmaKind,
				morphemeKind: lemmaSubKind,
			} as Lemma;
		}
		case "Phraseme": {
			const features = parseFeatureBag(featuresToken);
			return {
				...base,
				...("discourseFormulaRole" in features
					? {
							discourseFormulaRole:
								features.discourseFormulaRole as string,
						}
					: {}),
				lemmaKind,
				phrasemeKind: lemmaSubKind,
			} as Lemma;
		}
		default:
			throw new Error(`Unsupported lemma kind in Ling ID: ${lemmaKind}`);
	}
}
