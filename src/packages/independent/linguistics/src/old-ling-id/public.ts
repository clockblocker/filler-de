import type { Lemma } from "../lu/public-entities";
import {
	TARGET_LANGUAGES,
	type TargetLanguage,
} from "../lu/universal/enums/core/language";
import { parseLingId, parseShallowSurfaceLingId } from "./parse";
import {
	serializeResolvedSurface,
	serializeShallowSurface,
	serializeSurface,
} from "./serialize";
import type {
	LingIdResolvedSurface,
	LingIdSelection,
	LingId as LingIdValue,
	ParsedShallowSurfaceDto,
	ParsedShallowSurfaceDtoFor,
	ParsedSurfaceResult,
	ResolvedSurfaceLingId,
	SerializableLemma,
	SerializableSurface,
	SerializableSurfaceShell,
	ShallowSurfaceLingId,
	SurfaceLingId,
} from "./types";
import { parseHeader } from "./wire";

export type {
	LingIdResolvedSurface,
	LingIdSelection,
	ParsedShallowSurfaceDto,
	ParsedSurfaceResult,
	ResolvedSurfaceLingId,
	ShallowSurfaceLingId,
	SurfaceLingId,
} from "./types";

export type LingConverters<L extends TargetLanguage> = {
	getSurfaceLingId: {
		(value: Lemma<L> | SerializableLemma): ResolvedSurfaceLingId;
		(
			value:
				| LingIdSelection<L>
				| LingIdResolvedSurface<L>
				| SerializableSurface,
		): SurfaceLingId | ResolvedSurfaceLingId;
	};
	getShallowSurfaceLingId: (
		value:
			| LingIdSelection<L>
			| LingIdResolvedSurface<L>
			| ParsedShallowSurfaceDtoFor<L>
			| SerializableSurfaceShell,
	) => ShallowSurfaceLingId;
	parseSurface: (
		id: SurfaceLingId | ResolvedSurfaceLingId,
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
		| LingIdResolvedSurface<L>;
	export type Converters<L extends TargetLanguage> = LingConverters<L>;
	export type SurfaceId = SurfaceLingId;
	export type ResolvedId = ResolvedSurfaceLingId;
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
		(value: SerializableLemma): ResolvedSurfaceLingId;
		(value: SerializableSurface): SurfaceLingId | ResolvedSurfaceLingId;
	};
	toShallowSurfaceLingId: (
		value: SerializableSurfaceShell,
	) => ShallowSurfaceLingId;
};

function isSurfaceValue(value: unknown): value is SerializableSurfaceShell {
	return (
		isSelectionValue(value) ||
		isResolvedSurfaceValue(value) ||
		isShallowSurfaceValue(value)
	);
}

function isFullSurfaceValue(value: unknown): value is SerializableSurface {
	return isSelectionValue(value) || isResolvedSurfaceValue(value);
}

function isSelectionValue(value: unknown): value is LingIdSelection {
	return (
		typeof value === "object" &&
		value !== null &&
		"surface" in value &&
		"spelledSelection" in value
	);
}

function isResolvedSurfaceValue(
	value: unknown,
): value is LingIdResolvedSurface {
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
		typeof value.language === "string" &&
		(TARGET_LANGUAGES as readonly string[]).includes(value.language)
	) {
		return value.language as TargetLanguage;
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
				? isResolvedSurfaceValue(value)
					? serializeResolvedSurface(language, value)
					: serializeSurface(language, value)
				: serializeResolvedSurface(
						language,
						value,
					)) as LanguageSerializer["toSurfaceLingId"],
	};
}
