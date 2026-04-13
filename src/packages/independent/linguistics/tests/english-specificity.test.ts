import { describe, expect, it } from "bun:test";
import {
	EnglishAdjectiveInflectionSelectionSchema,
} from "../src/english/lu/lexeme/adjective/english-adjective-bundle";
import {
	EnglishAdpositionInflectionSelectionSchema,
} from "../src/english/lu/lexeme/adposition/english-adposition-bundle";
import {
	EnglishAuxiliaryInflectionSelectionSchema,
} from "../src/english/lu/lexeme/auxiliary/english-auxiliary-bundle";
import {
	EnglishDeterminerInflectionSelectionSchema,
	EnglishDeterminerLemmaSchema,
} from "../src/english/lu/lexeme/determiner/english-determiner-bundle";
import {
	EnglishNounInflectionSelectionSchema,
	EnglishNounLemmaSchema,
} from "../src/english/lu/lexeme/noun/english-noun-bundle";
import {
	EnglishPronounInflectionSelectionSchema,
	EnglishPronounLemmaSchema,
} from "../src/english/lu/lexeme/pronoun/english-pronoun-bundle";
import {
	EnglishProperNounInflectionSelectionSchema,
	EnglishProperNounLemmaSchema,
} from "../src/english/lu/lexeme/proper-noun/english-proper-noun-bundle";
import {
	EnglishVerbInflectionSelectionSchema,
	EnglishVerbLemmaSchema,
} from "../src/english/lu/lexeme/verb/english-verb-bundle";

describe("English schema specificity", () => {
	it("keeps English adjective inflection to degree and adpositions uninflected", () => {
		expect(
			EnglishAdjectiveInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				surface: {
					inflectionalFeatures: {
						degree: "Cmp",
					},
					lemma: {
						lemmaKind: "Lexeme",
						language: "English",
						pos: "ADJ",
						spelledLemma: "small",
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
					inflectionalFeatures: {
						case: "Dat",
					},
					lemma: {
						lemmaKind: "Lexeme",
						language: "English",
						pos: "ADJ",
						spelledLemma: "small",
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
					inflectionalFeatures: {
						case: "Acc",
					},
					lemma: {
						lemmaKind: "Lexeme",
						language: "English",
						pos: "ADP",
						spelledLemma: "to",
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
					inflectionalFeatures: {
						case: "Gen",
						number: "Sing",
					},
					lemma: {
						lemmaKind: "Lexeme",
						language: "English",
						pos: "NOUN",
						spelledLemma: "dog",
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
					inflectionalFeatures: {
						case: "Dat",
					},
					lemma: {
						lemmaKind: "Lexeme",
						language: "English",
						pos: "NOUN",
						spelledLemma: "dog",
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
					inflectionalFeatures: {
						case: "Nom",
					},
					lemma: {
						lemmaKind: "Lexeme",
						language: "English",
						pos: "PROPN",
						spelledLemma: "Anna",
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
				lexicalRelations: {},
				morphologicalRelations: {},
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
				lexicalRelations: {},
				morphologicalRelations: {},
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
					inflectionalFeatures: {
						gender: "Neut",
					},
					lemma: {
						lemmaKind: "Lexeme",
						language: "English",
						pos: "VERB",
						spelledLemma: "wash",
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
					inflectionalFeatures: {
						gender: "Fem",
					},
					lemma: {
						lemmaKind: "Lexeme",
						language: "English",
						pos: "AUX",
						spelledLemma: "be",
					},
					spelledSurface: "is",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishVerbLemmaSchema.safeParse({
				inherentFeatures: {
					reflex: true,
				},
				language: "English",
				lexicalRelations: {},
				morphologicalRelations: {},
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
				lexicalRelations: {},
				morphologicalRelations: {},
				pos: "VERB",
				spelledLemma: "wash",
			}).success,
		).toBe(false);
	});

	it("keeps English pronoun case narrow and rejects polite pronoun or determiner features", () => {
		expect(
			EnglishPronounInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				surface: {
					inflectionalFeatures: {
						case: "Acc",
					},
					lemma: {
						lemmaKind: "Lexeme",
						language: "English",
						pos: "PRON",
						spelledLemma: "him",
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
					inflectionalFeatures: {
						case: "Dat",
					},
					lemma: {
						lemmaKind: "Lexeme",
						language: "English",
						pos: "PRON",
						spelledLemma: "him",
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
				lexicalRelations: {},
				morphologicalRelations: {},
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
				lexicalRelations: {},
				morphologicalRelations: {},
				pos: "DET",
				spelledLemma: "this",
			}).success,
		).toBe(false);

		expect(
			EnglishDeterminerInflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				surface: {
					inflectionalFeatures: {
						case: "Gen",
					},
					lemma: {
						lemmaKind: "Lexeme",
						language: "English",
						pos: "DET",
						spelledLemma: "this",
					},
					spelledSurface: "this",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);
	});
});
