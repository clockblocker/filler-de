import type {
	Lemma,
	LingIdResolvedSurface,
	LingIdSelection,
	ParsedSurfaceResult,
} from "../../../src";
import { buildToLingConverters } from "../../../src";

export type TestLanguage = "German" | "English" | "Hebrew";

export type LingIdSurfaceInput<L extends TestLanguage> = LingIdSelection<L>;

export type ParsedResolvedSurface<L extends TestLanguage = TestLanguage> =
	LingIdResolvedSurface<L>;

export type ParsedTargetedSurface<L extends TestLanguage = TestLanguage> =
	LingIdSelection<L>;

export type ParsedSurface<L extends TestLanguage = TestLanguage> =
	ParsedSurfaceResult<L>;

export const germanLingConverters = buildToLingConverters("German");
export const englishLingConverters = buildToLingConverters("English");
export const hebrewLingConverters = buildToLingConverters("Hebrew");

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

export const {
	getShallowSurfaceLingId: toHebrewShallowSurfaceLingId,
	getSurfaceLingId: toHebrewSurfaceLingId,
	parseShallowSurface: parseHebrewShallowSurface,
	parseSurface: parseHebrewSurface,
} = hebrewLingConverters;

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

export function buildHebrewKatavLemma() {
	return {
		canonicalLemma: "katav",
		inherentFeatures: {
			hebBinyan: "PAAL",
		},
		language: "Hebrew",
		lemmaKind: "Lexeme",
		meaningInEmojis: "✍️",
		pos: "VERB",
	} satisfies Lemma<"Hebrew", "Lexeme", "VERB">;
}
