import type { Lemma } from "../lu/public";
import type { TargetLanguage } from "../lu/universal/enums/core/language";
import { parseLingId, parseShallowSurfaceLingId } from "./parse";
import {
	serializeObservedSurface,
	serializeShallowSurface,
	serializeSurface,
} from "./serialize";
import type {
	LingIdObservedSurface,
	LingIdSelection,
	LingId as LingIdValue,
	ObservedSurfaceLingId,
	ParsedShallowSurfaceDto,
	ParsedShallowSurfaceDtoFor,
	ParsedSurfaceResult,
	SerializableLemma,
	SerializableSurface,
	SerializableSurfaceShell,
	ShallowSurfaceLingId,
	SurfaceLingId,
} from "./types";
import { parseHeader } from "./wire";

export type {
	LingIdObservedSurface,
	LingIdSelection,
	ObservedSurfaceLingId,
	ParsedShallowSurfaceDto,
	ParsedSurfaceResult,
	ShallowSurfaceLingId,
	SurfaceLingId,
} from "./types";

export type LingConverters<L extends TargetLanguage> = {
	getSurfaceLingId: {
		(value: Lemma<L> | SerializableLemma): ObservedSurfaceLingId;
		(
			value:
				| LingIdSelection<L>
				| LingIdObservedSurface<L>
				| SerializableSurface,
		): SurfaceLingId | ObservedSurfaceLingId;
	};
	getShallowSurfaceLingId: (
		value:
			| LingIdSelection<L>
			| LingIdObservedSurface<L>
			| ParsedShallowSurfaceDtoFor<L>
			| SerializableSurfaceShell,
	) => ShallowSurfaceLingId;
	parseSurface: (
		id: SurfaceLingId | ObservedSurfaceLingId,
	) => ParsedSurfaceResult<L>;
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
		| LingIdSelection<L>
		| LingIdObservedSurface<L>;
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

			if (isFullSurfaceValue(value)) {
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
			assertLanguageMatch(lang, parseHeader(id).language);

			return parseLingId(id) as ParsedSurfaceResult<L>;
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

function isSurfaceValue(value: unknown): value is SerializableSurfaceShell {
	return (
		isSelectionValue(value) ||
		isObservedSurfaceValue(value) ||
		isShallowSurfaceValue(value)
	);
}

function isFullSurfaceValue(value: unknown): value is SerializableSurface {
	return isSelectionValue(value) || isObservedSurfaceValue(value);
}

function isSelectionValue(value: unknown): value is LingIdSelection {
	return (
		typeof value === "object" &&
		value !== null &&
		"surface" in value &&
		"spelledSelection" in value
	);
}

function isObservedSurfaceValue(
	value: unknown,
): value is LingIdObservedSurface {
	return (
		typeof value === "object" &&
		value !== null &&
		"surfaceKind" in value &&
		"target" in value &&
		!("surface" in value)
	);
}

function isShallowSurfaceValue(
	value: unknown,
): value is ParsedShallowSurfaceDto {
	return (
		typeof value === "object" &&
		value !== null &&
		"surface" in value &&
		"orthographicStatus" in value &&
		!("spelledSelection" in value)
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
			isFullSurfaceValue(value)
				? isObservedSurfaceValue(value)
					? serializeObservedSurface(language, value)
					: serializeSurface(language, value)
				: serializeObservedSurface(
						language,
						value,
					)) as LanguageSerializer["toSurfaceLingId"],
	};
}
