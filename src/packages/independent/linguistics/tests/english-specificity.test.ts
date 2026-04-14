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

function lexemeSurface(pos: string, spelledLemma: string) {
	return {
		discriminators: {
			lemmaKind: "Lexeme" as const,
			lemmaSubKind: pos,
		},
		target: {
			spelledLemma,
		},
	};
}

describe("English schema specificity", () => {
	it("keeps English adjective inflection to degree and adpositions uninflected", () => {
		expect(
			EnglishAdjectiveInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				surface: {
					...lexemeSurface("ADJ", "small"),
					inflectionalFeatures: {
						degree: "Cmp",
					},
					spelledSurface: "smaller",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			EnglishAdjectiveInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				surface: {
					...lexemeSurface("ADJ", "small"),
					inflectionalFeatures: {
						case: "Dat",
					},
					spelledSurface: "small",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishAdpositionInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				surface: {
					...lexemeSurface("ADP", "to"),
					inflectionalFeatures: {
						case: "Acc",
					},
					spelledSurface: "to",
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
				surface: {
					...lexemeSurface("NOUN", "dog"),
					inflectionalFeatures: {
						case: "Gen",
						number: "Sing",
					},
					spelledSurface: "dog's",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			EnglishNounInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				surface: {
					...lexemeSurface("NOUN", "dog"),
					inflectionalFeatures: {
						case: "Dat",
					},
					spelledSurface: "dog",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishProperNounInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				surface: {
					...lexemeSurface("PROPN", "Anna"),
					inflectionalFeatures: {
						case: "Nom",
					},
					spelledSurface: "Anna",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishNounLemmaSchema.safeParse({
				inherentFeatures: {
					gender: "Masc",
				},
				language: "English",
				lemmaKind: "Lexeme",
				pos: "NOUN",
				spelledLemma: "dog",
			}).success,
		).toBe(false);

		expect(
			EnglishProperNounLemmaSchema.safeParse({
				inherentFeatures: {
					gender: "Fem",
				},
				language: "English",
				lemmaKind: "Lexeme",
				pos: "PROPN",
				spelledLemma: "Anna",
			}).success,
		).toBe(false);
	});

	it("removes German-specific verb and auxiliary morphology from English", () => {
		expect(
			EnglishVerbInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				surface: {
					...lexemeSurface("VERB", "wash"),
					inflectionalFeatures: {
						gender: "Neut",
					},
					spelledSurface: "washed",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishAuxiliaryInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				surface: {
					...lexemeSurface("AUX", "be"),
					inflectionalFeatures: {
						gender: "Fem",
					},
					spelledSurface: "is",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishVerbLemmaSchema.safeParse({
				inherentFeatures: {
					governedPreposition: "to",
					isPhrasal: true,
				},
				language: "English",
				lemmaKind: "Lexeme",
				pos: "VERB",
				spelledLemma: "look",
			}).success,
		).toBe(true);

		expect(
			EnglishVerbLemmaSchema.safeParse({
				inherentFeatures: {
					reflex: true,
				},
				language: "English",
				lemmaKind: "Lexeme",
				pos: "VERB",
				spelledLemma: "wash",
			}).success,
		).toBe(false);

		expect(
			EnglishVerbLemmaSchema.safeParse({
				inherentFeatures: {
					separable: true,
				},
				language: "English",
				lemmaKind: "Lexeme",
				pos: "VERB",
				spelledLemma: "wash",
			}).success,
		).toBe(false);

		expect(
			EnglishVerbLemmaSchema.safeParse({
				inherentFeatures: {
					governedPreposition: "",
				},
				language: "English",
				lemmaKind: "Lexeme",
				pos: "VERB",
				spelledLemma: "look",
			}).success,
		).toBe(false);
	});

	it("keeps English pronoun case narrow and rejects polite pronoun or determiner features", () => {
		expect(
			EnglishPronounInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				surface: {
					...lexemeSurface("PRON", "him"),
					inflectionalFeatures: {
						case: "Acc",
					},
					spelledSurface: "him",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			EnglishPronounInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				surface: {
					...lexemeSurface("PRON", "him"),
					inflectionalFeatures: {
						case: "Dat",
					},
					spelledSurface: "him",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishPronounLemmaSchema.safeParse({
				inherentFeatures: {
					polite: "Form",
				},
				language: "English",
				lemmaKind: "Lexeme",
				pos: "PRON",
				spelledLemma: "him",
			}).success,
		).toBe(false);

		expect(
			EnglishDeterminerLemmaSchema.safeParse({
				inherentFeatures: {
					polite: "Form",
				},
				language: "English",
				lemmaKind: "Lexeme",
				pos: "DET",
				spelledLemma: "this",
			}).success,
		).toBe(false);

		expect(
			EnglishDeterminerInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				surface: {
					...lexemeSurface("DET", "this"),
					inflectionalFeatures: {
						case: "Gen",
					},
					spelledSurface: "this",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);
	});
});
