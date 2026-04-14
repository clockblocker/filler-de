import type { Lemma } from "../lu/public";
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
	SerializableLemma,
	SerializableSurface,
	ShallowSurfaceLingId,
	SurfaceLingId,
} from "./types";

export type {
	LingId,
	ObservedSurfaceLingId,
	ParsedObservedSurfaceDto,
	ParsedSurfaceDto,
	ParsedTargetedSurfaceDto,
	ShallowSurfaceLingId,
	SurfaceLingId,
} from "./types";

export { parseLingId };

export function buildToLingIdFor<L extends TargetLanguage>(lang: L) {
	return buildToSurfaceLingIdFor(lang);
}

export function buildToSurfaceLingIdFor<L extends TargetLanguage>(
	lang: L,
): {
	(
		value: Lemma<L> | ParsedLemmaDtoFor<L> | ParsedLemmaDto,
	): ObservedSurfaceLingId;
	(
		value:
			| LingIdSurfaceInput<L>
			| ParsedSurfaceDtoFor<L>
			| ParsedSurfaceDto,
	): SurfaceLingId | ObservedSurfaceLingId;
} {
	return (value) => {
		const serializer = getSerializerForValue(lang, getValueLanguage(value));

		return isSurfaceValue(value)
			? serializer.toSurfaceLingId(value as SerializableSurface)
			: serializer.toSurfaceLingId(value as SerializableLemma);
	};
}

export function buildToShallowSurfaceLingIdFor<L extends TargetLanguage>(
	lang: L,
): (
	value: LingIdSurfaceInput<L> | ParsedSurfaceDtoFor<L> | ParsedSurfaceDto,
) => ShallowSurfaceLingId {
	return (value) => {
		if (!isSurfaceValue(value)) {
			throw new Error("Shallow surface Ling IDs require a surface input");
		}

		return getSerializerForValue(
			lang,
			getValueLanguage(value),
		).toShallowSurfaceLingId(value as SerializableSurface);
	};
}

type LanguageSerializer = {
	toSurfaceLingId: {
		(value: SerializableLemma): ObservedSurfaceLingId;
		(value: SerializableSurface): SurfaceLingId | ObservedSurfaceLingId;
	};
	toShallowSurfaceLingId: (
		value: SerializableSurface,
	) => ShallowSurfaceLingId;
};

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
				? isObservedSurfaceValue(value)
					? serializeObservedSurface(language, value)
					: serializeSurface(language, value)
				: serializeObservedSurface(
						language,
						value,
					)) as LanguageSerializer["toSurfaceLingId"],
	};
}
