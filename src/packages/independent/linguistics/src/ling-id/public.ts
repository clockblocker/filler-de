import type { Lemma } from "../lu/public";
import type { TargetLanguage } from "../lu/universal/enums/core/language";
import { parseLingId, parseShallowSurfaceLingId } from "./parse";
import {
	serializeObservedSurface,
	serializeShallowSurface,
	serializeSurface,
} from "./serialize";
import type {
	LingId as LingIdValue,
	LingIdSurfaceInput,
	ObservedSurfaceLingId,
	ParsedLemmaDto,
	ParsedLemmaDtoFor,
	ParsedObservedSurfaceDto,
	ParsedShallowSurfaceDto,
	ParsedShallowSurfaceDtoFor,
	ParsedSurfaceDto,
	ParsedSurfaceDtoFor,
	SerializableLemma,
	SerializableSurface,
	SerializableSurfaceShell,
	ShallowSurfaceLingId,
	SurfaceLingId,
} from "./types";

export type {
	LingId,
	ObservedSurfaceLingId,
	ParsedObservedSurfaceDto,
	ParsedShallowSurfaceDto,
	ParsedSurfaceDto,
	ParsedTargetedSurfaceDto,
	ShallowSurfaceLingId,
	SurfaceLingId,
} from "./types";

export type LingConverters<L extends TargetLanguage> = {
	getSurfaceLingId: {
		(
			value: Lemma<L> | ParsedLemmaDtoFor<L> | ParsedLemmaDto,
		): ObservedSurfaceLingId;
		(
			value:
				| LingIdSurfaceInput<L>
				| ParsedSurfaceDtoFor<L>
				| ParsedSurfaceDto,
		): SurfaceLingId | ObservedSurfaceLingId;
	};
	getShallowSurfaceLingId: (
		value:
			| LingIdSurfaceInput<L>
			| ParsedSurfaceDtoFor<L>
			| ParsedSurfaceDto
			| ParsedShallowSurfaceDtoFor<L>
			| ParsedShallowSurfaceDto,
	) => ShallowSurfaceLingId;
	parseSurface: (
		id: SurfaceLingId | ObservedSurfaceLingId,
	) => ParsedSurfaceDtoFor<L>;
	parseShallowSurface: (
		id: ShallowSurfaceLingId,
	) => ParsedShallowSurfaceDtoFor<L>;
};

export const LingId = {
	forLanguage: buildToLingConverters,
} as const;

export declare namespace LingId {
	export type Value = LingIdValue;
	export type Input<L extends TargetLanguage = TargetLanguage> =
		LingIdSurfaceInput<L>;
	export type Converters<L extends TargetLanguage> = LingConverters<L>;
	export type SurfaceId = SurfaceLingId;
	export type ObservedId = ObservedSurfaceLingId;
	export type ShallowId = ShallowSurfaceLingId;
}

export function buildToLingConverters<L extends TargetLanguage>(
	lang: L,
): LingConverters<L> {
	return {
		getShallowSurfaceLingId: (value) => {
			if (!isSurfaceValue(value)) {
				throw new Error(
					"Shallow surface Ling IDs require a surface input",
				);
			}

			return getSerializerForValue(
				lang,
				getValueLanguage(value),
			).toShallowSurfaceLingId(value as SerializableSurfaceShell);
		},
		getSurfaceLingId: ((value) => {
			const serializer = getSerializerForValue(
				lang,
				getValueLanguage(value),
			);

			if (isSurfaceValue(value)) {
				if (!hasSurfaceTarget(value)) {
					throw new Error(
						"Full surface Ling IDs require a target payload",
					);
				}

				return serializer.toSurfaceLingId(value as SerializableSurface);
			}

			return serializer.toSurfaceLingId(value as SerializableLemma);
		}) as LingConverters<L>["getSurfaceLingId"],
		parseShallowSurface: (id) => {
			const parsedShallowSurface = parseShallowSurfaceLingId(id);

			assertLanguageMatch(lang, parsedShallowSurface.language);

			return parsedShallowSurface as ParsedShallowSurfaceDtoFor<L>;
		},
		parseSurface: (id) => {
			const parsedSurface = parseLingId(id);

			assertLanguageMatch(lang, parsedSurface.language);

			return parsedSurface as ParsedSurfaceDtoFor<L>;
		},
	};
}

type LanguageSerializer = {
	toSurfaceLingId: {
		(value: SerializableLemma): ObservedSurfaceLingId;
		(value: SerializableSurface): SurfaceLingId | ObservedSurfaceLingId;
	};
	toShallowSurfaceLingId: (
		value: SerializableSurfaceShell,
	) => ShallowSurfaceLingId;
};

function isSurfaceValue(
	value: unknown,
): value is SerializableSurfaceShell | ParsedObservedSurfaceDto {
	return (
		typeof value === "object" && value !== null && "surfaceKind" in value
	);
}

function hasSurfaceTarget(value: unknown): value is SerializableSurface {
	return typeof value === "object" && value !== null && "target" in value;
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
