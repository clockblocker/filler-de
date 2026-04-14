import type {
	Lemma,
	OrthographicStatus,
	ParsedObservedSurfaceDto,
	ParsedSurfaceDto,
	ParsedTargetedSurfaceDto,
	Surface,
} from "../../../src";
import { buildToLingConverters } from "../../../src";

export type TestLanguage = "German" | "English";

export type LingIdSurfaceInput<L extends TestLanguage> = Surface<L> & {
	orthographicStatus: Exclude<OrthographicStatus, "Unknown">;
};

export type ParsedObservedSurface<L extends TestLanguage = TestLanguage> =
	ParsedObservedSurfaceDto & { language: L };

export type ParsedTargetedSurface<L extends TestLanguage = TestLanguage> =
	ParsedTargetedSurfaceDto & { language: L };

export type ParsedSurface<L extends TestLanguage = TestLanguage> =
	ParsedSurfaceDto & { language: L };

export const germanLingConverters = buildToLingConverters("German");
export const englishLingConverters = buildToLingConverters("English");

export const {
	getShallowSurfaceLingId: toGermanShallowSurfaceLingId,
	getSurfaceLingId: toGermanSurfaceLingId,
	parseShallowSurface: parseGermanShallowSurface,
	parseSurface: parseGermanSurface,
} = germanLingConverters;

export const {
	getShallowSurfaceLingId: toEnglishShallowSurfaceLingId,
	getSurfaceLingId: toEnglishSurfaceLingId,
	parseShallowSurface: parseEnglishShallowSurface,
	parseSurface: parseEnglishSurface,
} = englishLingConverters;

export function buildGermanFeminineSeeLemma() {
	return {
		canonicalLemma: "See",
		inherentFeatures: {
			gender: "Fem",
		},
		language: "German",
		lemmaKind: "Lexeme",
		meaningInEmojis: "🌊",
		pos: "NOUN",
	} satisfies Lemma<"German", "Lexeme", "NOUN">;
}

export function buildGermanNeuterSeeLemma() {
	return {
		...buildGermanFeminineSeeLemma(),
		inherentFeatures: {
			gender: "Neut",
		},
	} satisfies Lemma<"German", "Lexeme", "NOUN">;
}

export function buildEnglishWalkLemma() {
	return {
		canonicalLemma: "walk",
		inherentFeatures: {},
		language: "English",
		lemmaKind: "Lexeme",
		meaningInEmojis: "🚶",
		pos: "VERB",
	} satisfies Lemma<"English", "Lexeme", "VERB">;
}
