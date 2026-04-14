import { describe, expect, it } from "bun:test";
import { EnglishAdjectiveInflectionSelectionSchema } from "../src/lu/english/lu/lexeme/adjective/english-adjective-bundle";
import { EnglishAdpositionInflectionSelectionSchema } from "../src/lu/english/lu/lexeme/adposition/english-adposition-bundle";
import { EnglishAuxiliaryInflectionSelectionSchema } from "../src/lu/english/lu/lexeme/auxiliary/english-auxiliary-bundle";
import {
	EnglishDeterminerInflectionSelectionSchema,
	EnglishDeterminerLemmaSchema,
} from "../src/lu/english/lu/lexeme/determiner/english-determiner-bundle";
import {
	EnglishNounInflectionSelectionSchema,
	EnglishNounLemmaSchema,
} from "../src/lu/english/lu/lexeme/noun/english-noun-bundle";
import {
	EnglishPronounInflectionSelectionSchema,
	EnglishPronounLemmaSchema,
} from "../src/lu/english/lu/lexeme/pronoun/english-pronoun-bundle";
import {
	EnglishProperNounInflectionSelectionSchema,
	EnglishProperNounLemmaSchema,
} from "../src/lu/english/lu/lexeme/proper-noun/english-proper-noun-bundle";
import {
	EnglishVerbInflectionSelectionSchema,
	EnglishVerbLemmaSchema,
} from "../src/lu/english/lu/lexeme/verb/english-verb-bundle";

function lexemeSurface(pos: string, canonicalLemma: string) {
	return {
		discriminators: {
			lemmaKind: "Lexeme" as const,
			lemmaSubKind: pos,
		},
		target: {
			canonicalLemma,
		},
	};
}

describe("English schema specificity", () => {
	it("keeps English adjective inflection to degree and adpositions uninflected", () => {
		expect(
			EnglishAdjectiveInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				spelledSelection: "smaller",
				surface: {
					...lexemeSurface("ADJ", "small"),
					inflectionalFeatures: {
						degree: "Cmp",
					},
					normalizedFullSurface: "smaller",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			EnglishAdjectiveInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				spelledSelection: "small",
				surface: {
					...lexemeSurface("ADJ", "small"),
					inflectionalFeatures: {
						case: "Dat",
					},
					normalizedFullSurface: "small",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishAdpositionInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				spelledSelection: "to",
				surface: {
					...lexemeSurface("ADP", "to"),
					inflectionalFeatures: {
						case: "Acc",
					},
					normalizedFullSurface: "to",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);
	});

	it("limits English NOUN and PROPN case to genitive and drops grammatical gender", () => {
		expect(
			EnglishNounInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				spelledSelection: "dog's",
				surface: {
					...lexemeSurface("NOUN", "dog"),
					inflectionalFeatures: {
						case: "Gen",
						number: "Sing",
					},
					normalizedFullSurface: "dog's",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			EnglishNounInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				spelledSelection: "dog",
				surface: {
					...lexemeSurface("NOUN", "dog"),
					inflectionalFeatures: {
						case: "Dat",
					},
					normalizedFullSurface: "dog",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishProperNounInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				spelledSelection: "Anna",
				surface: {
					...lexemeSurface("PROPN", "Anna"),
					inflectionalFeatures: {
						case: "Nom",
					},
					normalizedFullSurface: "Anna",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishNounLemmaSchema.safeParse({
				canonicalLemma: "dog",
				inherentFeatures: {
					gender: "Masc",
				},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🐕",
				pos: "NOUN",
			}).success,
		).toBe(false);

		expect(
			EnglishProperNounLemmaSchema.safeParse({
				canonicalLemma: "Anna",
				inherentFeatures: {
					gender: "Fem",
				},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "👤",
				pos: "PROPN",
			}).success,
		).toBe(false);
	});

	it("removes German-specific verb and auxiliary morphology from English", () => {
		expect(
			EnglishVerbInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				spelledSelection: "washed",
				surface: {
					...lexemeSurface("VERB", "wash"),
					inflectionalFeatures: {
						gender: "Neut",
					},
					normalizedFullSurface: "washed",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishAuxiliaryInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				spelledSelection: "is",
				surface: {
					...lexemeSurface("AUX", "be"),
					inflectionalFeatures: {
						gender: "Fem",
					},
					normalizedFullSurface: "is",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishVerbLemmaSchema.safeParse({
				canonicalLemma: "look",
				inherentFeatures: {
					governedPreposition: "to",
					isPhrasal: true,
				},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "👀",
				pos: "VERB",
			}).success,
		).toBe(true);

		expect(
			EnglishVerbLemmaSchema.safeParse({
				canonicalLemma: "wash",
				inherentFeatures: {
					reflex: true,
				},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🧼",
				pos: "VERB",
			}).success,
		).toBe(false);

		expect(
			EnglishVerbLemmaSchema.safeParse({
				canonicalLemma: "wash",
				inherentFeatures: {
					separable: true,
				},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🧼",
				pos: "VERB",
			}).success,
		).toBe(false);

		expect(
			EnglishVerbLemmaSchema.safeParse({
				canonicalLemma: "look",
				inherentFeatures: {
					governedPreposition: "",
				},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "👀",
				pos: "VERB",
			}).success,
		).toBe(false);
	});

	it("keeps English pronoun case narrow and rejects polite pronoun or determiner features", () => {
		expect(
			EnglishPronounInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				spelledSelection: "him",
				surface: {
					...lexemeSurface("PRON", "him"),
					inflectionalFeatures: {
						case: "Acc",
					},
					normalizedFullSurface: "him",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			EnglishPronounInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				spelledSelection: "him",
				surface: {
					...lexemeSurface("PRON", "him"),
					inflectionalFeatures: {
						case: "Dat",
					},
					normalizedFullSurface: "him",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishPronounLemmaSchema.safeParse({
				canonicalLemma: "him",
				inherentFeatures: {
					polite: "Form",
				},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "👤",
				pos: "PRON",
			}).success,
		).toBe(false);

		expect(
			EnglishDeterminerLemmaSchema.safeParse({
				canonicalLemma: "this",
				inherentFeatures: {
					polite: "Form",
				},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "👉",
				pos: "DET",
			}).success,
		).toBe(false);

		expect(
			EnglishDeterminerInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				spelledSelection: "this",
				surface: {
					...lexemeSurface("DET", "this"),
					inflectionalFeatures: {
						case: "Gen",
					},
					normalizedFullSurface: "this",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);
	});
});
