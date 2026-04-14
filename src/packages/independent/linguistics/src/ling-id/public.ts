import type { AnyLemma } from "../lu/public";
import type { TargetLanguage } from "../lu/universal/enums/core/language";
import { parseLingId } from "./parse";
import {
	serializeObservedSurface,
	serializeShallowSurface,
	serializeSurface,
} from "./serialize";
import type {
	LingIdSurfaceInput,
	ObservedSurfaceLingId,
	ParsedLemmaDto,
	ParsedLemmaDtoFor,
	ParsedObservedSurfaceDto,
	ParsedSurfaceDto,
	ParsedSurfaceDtoFor,
	ParsedTargetedSurfaceDto,
	ParsedTargetedSurfaceDtoFor,
	SerializableLemma,
	SerializableSurface,
	SerializableTargetedSurface,
	ShallowSurfaceLingId,
	SurfaceLingId,
} from "./types";

type LanguageSerializer = {
	toSurfaceLingId: {
		(value: SerializableLemma): ObservedSurfaceLingId;
		(value: SerializableSurface): SurfaceLingId | ObservedSurfaceLingId;
	};
	toShallowSurfaceLingId: (
		value: SerializableTargetedSurface,
	) => ShallowSurfaceLingId;
};

export type {
	LingId,
	LingIdSurfaceInput,
	ObservedSurfaceLingId,
	ParsedFeatureBag,
	ParsedFeatureValue,
	ParsedLemmaDto,
	ParsedLingDto,
	ParsedObservedSurfaceDto,
	ParsedSurfaceDto,
	ParsedTargetedSurfaceDto,
	ShallowSurfaceLingId,
	SurfaceLingId,
} from "./types";

export { parseLingId };

export function buildToLingIdFor<L extends TargetLanguage>(
	lang: L,
): {
	(
		value: AnyLemma<L> | ParsedLemmaDtoFor<L> | ParsedLemmaDto,
	): ObservedSurfaceLingId;
	(
		value:
			| LingIdSurfaceInput<L>
			| ParsedSurfaceDtoFor<L>
			| ParsedSurfaceDto,
	): SurfaceLingId | ObservedSurfaceLingId;
} {
	return buildToSurfaceLingIdFor(lang);
}

export function buildToSurfaceLingIdFor<L extends TargetLanguage>(
	lang: L,
): {
	(
		value: AnyLemma<L> | ParsedLemmaDtoFor<L> | ParsedLemmaDto,
	): ObservedSurfaceLingId;
	(
		value:
			| LingIdSurfaceInput<L>
			| ParsedSurfaceDtoFor<L>
			| ParsedSurfaceDto,
	): SurfaceLingId | ObservedSurfaceLingId;
} {
	return ((value) => {
		const serializer = getSerializerForValue(lang, getValueLanguage(value));

		return isSurfaceValue(value)
			? serializer.toSurfaceLingId(value as SerializableSurface)
			: serializer.toSurfaceLingId(value as SerializableLemma);
	}) as {
		(
			value: AnyLemma<L> | ParsedLemmaDtoFor<L> | ParsedLemmaDto,
		): ObservedSurfaceLingId;
		(
			value:
				| LingIdSurfaceInput<L>
				| ParsedSurfaceDtoFor<L>
				| ParsedSurfaceDto,
		): SurfaceLingId | ObservedSurfaceLingId;
	};
}

export function buildToShallowSurfaceLingIdFor<L extends TargetLanguage>(
	lang: L,
): (
	value:
		| LingIdSurfaceInput<L>
		| ParsedTargetedSurfaceDtoFor<L>
		| ParsedTargetedSurfaceDto,
) => ShallowSurfaceLingId {
	return (value) => {
		if (!isSurfaceValue(value)) {
			throw new Error(
				"Shallow surface Ling IDs require a targeted surface input",
			);
		}

		if (isObservedSurfaceValue(value)) {
			throw new Error(
				"Shallow surface Ling IDs do not support observed surfaces",
			);
		}

		return getSerializerForValue(
			lang,
			getValueLanguage(value),
		).toShallowSurfaceLingId(value as SerializableTargetedSurface);
	};
}

function isSurfaceValue(
	value: unknown,
): value is SerializableSurface | ParsedObservedSurfaceDto {
	return (
		typeof value === "object" && value !== null && "surfaceKind" in value
	);
}

function isObservedSurfaceValue(
	value: SerializableSurface | ParsedSurfaceDto | ParsedObservedSurfaceDto,
): value is ParsedObservedSurfaceDto {
	return value.target === "Lemma";
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

function createLanguageSerializer(
	language: TargetLanguage,
): LanguageSerializer {
	return {
		toShallowSurfaceLingId: (value) =>
			serializeShallowSurface(language, value),
		toSurfaceLingId: ((value: SerializableLemma | SerializableSurface) =>
			isSurfaceValue(value)
				? serializeSurface(language, value)
				: serializeObservedSurface(
						language,
						value,
					)) as LanguageSerializer["toSurfaceLingId"],
	};
}
