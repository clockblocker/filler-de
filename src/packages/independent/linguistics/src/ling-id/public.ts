import type { AnyLemma } from "../lu/public";
import type { TargetLanguage } from "../lu/universal/enums/core/language";
import { parseLingId } from "./parse";
import { serializeLemma, serializeShallowSurface, serializeSurface } from "./serialize";
import type {
	LemmaLingId,
	LingId,
	LingIdSurfaceInput,
	ParsedLemmaDto,
	ParsedLemmaDtoFor,
	ParsedLingDto,
	ParsedLingDtoFor,
	ParsedSurfaceDto,
	ParsedSurfaceDtoFor,
	SerializableLemma,
	SerializableSurface,
	ShallowSurfaceLingId,
	SurfaceLingId,
} from "./types";

type LanguageSerializer = {
	toLemmaLingId: (value: SerializableLemma) => LemmaLingId;
	toSurfaceLingId: (value: SerializableSurface) => SurfaceLingId;
	toShallowSurfaceLingId: (
		value: SerializableSurface,
	) => ShallowSurfaceLingId;
};

export type {
	LemmaLingId,
	LingId,
	LingIdSurfaceInput,
	ParsedFeatureBag,
	ParsedFeatureValue,
	ParsedLemmaDto,
	ParsedLingDto,
	ParsedSurfaceDto,
	ShallowSurfaceLingId,
	SurfaceLingId,
} from "./types";

export { parseLingId };

export function buildToLingIdFor<L extends TargetLanguage>(
	lang: L,
): (
	value:
		| AnyLemma<L>
		| LingIdSurfaceInput<L>
		| ParsedLingDtoFor<L>
		| ParsedLemmaDto
		| ParsedSurfaceDto,
) => LingId {
	return (value) => {
		const serializer = getSerializerForValue(lang, getValueLanguage(value));

		return isSurfaceValue(value)
			? serializer.toSurfaceLingId(value as SerializableSurface)
			: serializer.toLemmaLingId(value as SerializableLemma);
	};
}

export function buildToLemmaLingIdFor<L extends TargetLanguage>(
	lang: L,
): (value: AnyLemma<L> | ParsedLemmaDtoFor<L> | ParsedLemmaDto) => LemmaLingId {
	return (value) =>
		getSerializerForValue(lang, getValueLanguage(value)).toLemmaLingId(
			value as SerializableLemma,
		);
}

export function buildToSurfaceLingIdFor<L extends TargetLanguage>(
	lang: L,
): (
	value: LingIdSurfaceInput<L> | ParsedSurfaceDtoFor<L> | ParsedSurfaceDto,
) => SurfaceLingId {
	return (value) =>
		getSerializerForValue(lang, getValueLanguage(value)).toSurfaceLingId(
			value as SerializableSurface,
		);
}

export function buildToShallowSurfaceLingIdFor<L extends TargetLanguage>(
	lang: L,
): (
	value: LingIdSurfaceInput<L> | ParsedSurfaceDtoFor<L> | ParsedSurfaceDto,
) => ShallowSurfaceLingId {
	return (value) =>
		getSerializerForValue(
			lang,
			getValueLanguage(value),
		).toShallowSurfaceLingId(value as SerializableSurface);
}

function isSurfaceValue(value: unknown): value is SerializableSurface {
	return (
		typeof value === "object" && value !== null && "surfaceKind" in value
	);
}

function getValueLanguage(value: unknown): TargetLanguage | undefined {
	if (
		typeof value === "object" &&
		value !== null &&
		"language" in value &&
		(value.language === "German" || value.language === "English")
	) {
		return value.language;
	}

	return undefined;
}

function getSerializerForValue(
	lang: TargetLanguage,
	valueLanguage: TargetLanguage | undefined,
): LanguageSerializer {
	if (valueLanguage !== undefined) {
		assertLanguageMatch(lang, valueLanguage);

		return createLanguageSerializer(valueLanguage);
	}

	return createLanguageSerializer(lang);
}

function assertLanguageMatch(expected: TargetLanguage, actual: TargetLanguage) {
	if (expected !== actual) {
		throw new Error(
			`Ling ID builder language mismatch: expected ${expected}, received ${actual}`,
		);
	}
}

function createLanguageSerializer(language: TargetLanguage): LanguageSerializer {
	return {
		toLemmaLingId: (value) => serializeLemma(language, value),
		toShallowSurfaceLingId: (value) =>
			serializeShallowSurface(language, value),
		toSurfaceLingId: (value) =>
			serializeSurface(language, value, (lemma) =>
				getSerializerForValue(language, lemma.language).toLemmaLingId(lemma),
			),
	};
}
