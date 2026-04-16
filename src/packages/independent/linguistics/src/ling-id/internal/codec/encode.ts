import type {
	Lemma,
	ResolvedSurface,
	UnresolvedSurface,
} from "../../../lu/public-entities";
import type { TargetLanguage } from "../../../lu/universal/enums/core/language";
import type { ConcreteLingIdKind, KnownSelection, LingId } from "../../types";
import {
	getRuntimeSchema,
	hasResolvedSurfaceTarget,
	isPlainObject,
} from "../guards";
import type { ParsedFeatureBag, ParsedFeatureValue } from "../wire/feature-bag";
import { compactFeatureBag, serializeFeatureBag } from "../wire/feature-bag";
import { buildHeader, encodeWireKind } from "../wire/header";
import {
	escapeToken,
	joinTokens,
	serializeOptionalToken,
} from "../wire/tokens";
import { inferConcreteLingIdKind } from "./infer-kind";

type EncodableValue<L extends TargetLanguage> =
	| Lemma<L>
	| KnownSelection<L>
	| ResolvedSurface<L>
	| UnresolvedSurface<L>;

export function encodeLingId<L extends TargetLanguage>(
	language: L,
	value: Lemma<L>,
): LingId<"Lemma", L>;
export function encodeLingId<L extends TargetLanguage>(
	language: L,
	value: KnownSelection<L>,
): LingId<"Selection", L>;
export function encodeLingId<L extends TargetLanguage>(
	language: L,
	value: ResolvedSurface<L>,
): LingId<"ResolvedSurface", L>;
export function encodeLingId<L extends TargetLanguage>(
	language: L,
	value: UnresolvedSurface<L>,
): LingId<"UnresolvedSurface", L>;
export function encodeLingId<L extends TargetLanguage>(
	language: L,
	value: EncodableValue<L>,
): LingId<ConcreteLingIdKind, L> {
	const kind = inferConcreteLingIdKind(value);
	assertLanguageMatch(language, value);
	const validation = getRuntimeSchema(language, kind).safeParse(value);

	if (!validation.success) {
		throw new Error(
			`Invalid ${kind} for Ling ID encoding: ${validation.error.issues
				.map((issue) => issue.message)
				.join("; ")}`,
		);
	}

	const payload = serializePayload(
		kind,
		validation.data as EncodableValue<L>,
	);
	return `${buildHeader(language, kind)};${payload}` as LingId<
		ConcreteLingIdKind,
		L
	>;
}

function assertLanguageMatch(expected: TargetLanguage, value: unknown): void {
	if (
		!isPlainObject(value) ||
		!("language" in value) ||
		typeof value.language !== "string"
	) {
		throw new Error("Ling ID encoding expects a language-tagged entity");
	}

	if (value.language !== expected) {
		throw new Error(
			`Ling ID builder language mismatch: expected ${expected}, received ${value.language}`,
		);
	}
}

function serializePayload(
	kind: ConcreteLingIdKind,
	value: EncodableValue<TargetLanguage>,
): string {
	switch (kind) {
		case "Lemma":
			return serializeLemmaPayload(value as Lemma);
		case "Selection":
			return serializeSelectionPayload(value as KnownSelection);
		case "ResolvedSurface":
			return serializeSurfacePayload(
				value as ResolvedSurface,
				"ResolvedSurface",
			);
		case "UnresolvedSurface":
			return serializeSurfacePayload(
				value as UnresolvedSurface,
				"UnresolvedSurface",
			);
	}
}

function serializeSelectionPayload(value: KnownSelection): string {
	const surfaceKind = inferSurfaceLingIdKind(value.surface);

	return joinTokens([
		value.orthographicStatus,
		value.selectionCoverage,
		escapeToken(value.spelledSelection),
		encodeWireKind(surfaceKind),
		serializeSurfacePayload(value.surface, surfaceKind),
	]);
}

function serializeSurfacePayload(
	value: ResolvedSurface | UnresolvedSurface,
	kind: "ResolvedSurface" | "UnresolvedSurface",
): string {
	const surfaceParts = serializeSurfaceBase(value);

	if (kind === "ResolvedSurface") {
		return joinTokens([
			...surfaceParts,
			serializeLemmaPayload(value.target as Lemma),
		]);
	}

	return joinTokens([
		...surfaceParts,
		escapeToken(value.target.canonicalLemma),
	]);
}

function inferSurfaceLingIdKind(
	value: {
		target: { canonicalLemma: string } | Lemma;
	} & (ResolvedSurface | UnresolvedSurface),
): "ResolvedSurface" | "UnresolvedSurface" {
	return hasResolvedSurfaceTarget(value.target)
		? "ResolvedSurface"
		: "UnresolvedSurface";
}

function serializeSurfaceBase(
	value: ResolvedSurface | UnresolvedSurface,
): string[] {
	return [
		escapeToken(value.normalizedFullSurface),
		value.surfaceKind,
		value.discriminators.lemmaKind,
		value.discriminators.lemmaSubKind,
		value.surfaceKind === "Inflection"
			? serializeFeatureBag(
					(("inflectionalFeatures" in value
						? value.inflectionalFeatures
						: undefined) ?? {}) as ParsedFeatureBag,
				)
			: "-",
	];
}

function serializeLemmaPayload(value: Lemma): string {
	const normalizedLemma = normalizeLemma(value);

	return joinTokens([
		escapeToken(normalizedLemma.canonicalLemma),
		normalizedLemma.lemmaKind,
		getLemmaSubKind(normalizedLemma),
		serializeFeatureBag(getLemmaFeatures(normalizedLemma)),
		serializeOptionalToken(normalizedLemma.meaningInEmojis),
	]);
}

function normalizeLemma(value: Lemma): Lemma {
	switch (value.lemmaKind) {
		case "Lexeme":
			return {
				canonicalLemma: value.canonicalLemma,
				inherentFeatures: compactFeatureBag(
					value.inherentFeatures as Record<
						string,
						ParsedFeatureValue | undefined
					>,
				),
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
				...("hasSepPrefix" in value && value.hasSepPrefix !== undefined
					? { hasSepPrefix: value.hasSepPrefix }
					: {}),
				...("isClosedSet" in value && value.isClosedSet !== undefined
					? { isClosedSet: value.isClosedSet }
					: {}),
				language: value.language,
				lemmaKind: value.lemmaKind,
				...(value.meaningInEmojis === undefined
					? {}
					: { meaningInEmojis: value.meaningInEmojis }),
				morphemeKind: value.morphemeKind,
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

function getLemmaFeatures(value: Lemma): ParsedFeatureBag {
	switch (value.lemmaKind) {
		case "Lexeme":
			return value.inherentFeatures as ParsedFeatureBag;
		case "Morpheme":
			return compactFeatureBag({
				...("hasSepPrefix" in value
					? { hasSepPrefix: value.hasSepPrefix }
					: {}),
				...("isClosedSet" in value
					? { isClosedSet: value.isClosedSet }
					: {}),
			});
		case "Phraseme":
			return compactFeatureBag({
				...("discourseFormulaRole" in value
					? {
							discourseFormulaRole: value.discourseFormulaRole as
								| string
								| undefined,
						}
					: {}),
			});
	}
}
