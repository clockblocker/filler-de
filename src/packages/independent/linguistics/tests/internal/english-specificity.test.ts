import { describe, expect, it } from "bun:test";
import { EnglishAdjectiveSchemas } from "../../src/lu/english/lu/lexeme/adjective/english-adjective-bundle";
import { EnglishAdpositionSchemas } from "../../src/lu/english/lu/lexeme/adposition/english-adposition-bundle";
import { EnglishAuxiliarySchemas } from "../../src/lu/english/lu/lexeme/auxiliary/english-auxiliary-bundle";
import { EnglishDeterminerSchemas } from "../../src/lu/english/lu/lexeme/determiner/english-determiner-bundle";
import { EnglishNounSchemas } from "../../src/lu/english/lu/lexeme/noun/english-noun-bundle";
import { EnglishPronounSchemas } from "../../src/lu/english/lu/lexeme/pronoun/english-pronoun-bundle";
import { EnglishProperNounSchemas } from "../../src/lu/english/lu/lexeme/proper-noun/english-proper-noun-bundle";
import { EnglishVerbSchemas } from "../../src/lu/english/lu/lexeme/verb/english-verb-bundle";

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
			EnglishAdjectiveSchemas.InflectionSelectionSchema.safeParse({
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
			EnglishAdjectiveSchemas.InflectionSelectionSchema.safeParse({
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
			EnglishAdpositionSchemas.InflectionSelectionSchema.safeParse({
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
			EnglishNounSchemas.InflectionSelectionSchema.safeParse({
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
			EnglishNounSchemas.InflectionSelectionSchema.safeParse({
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
			EnglishProperNounSchemas.InflectionSelectionSchema.safeParse({
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
			EnglishNounSchemas.LemmaSchema.safeParse({
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
			EnglishProperNounSchemas.LemmaSchema.safeParse({
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
			EnglishVerbSchemas.InflectionSelectionSchema.safeParse({
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
			EnglishAuxiliarySchemas.InflectionSelectionSchema.safeParse({
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
			EnglishVerbSchemas.LemmaSchema.safeParse({
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
			EnglishVerbSchemas.LemmaSchema.safeParse({
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
			EnglishVerbSchemas.LemmaSchema.safeParse({
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
			EnglishVerbSchemas.LemmaSchema.safeParse({
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
			EnglishPronounSchemas.InflectionSelectionSchema.safeParse({
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
			EnglishPronounSchemas.InflectionSelectionSchema.safeParse({
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
			EnglishPronounSchemas.LemmaSchema.safeParse({
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
			EnglishDeterminerSchemas.LemmaSchema.safeParse({
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
			EnglishDeterminerSchemas.InflectionSelectionSchema.safeParse({
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
