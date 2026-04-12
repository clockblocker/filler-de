import { describe, expect, it } from "bun:test";
import { LemmaSchema, SelectionSchema } from "../src";
import {
	GermanAdjectiveInflectionSelectionSchema,
	GermanAdjectiveLemmaSchema,
} from "../src/german/lu/lexeme/adjective/german-adjective-bundle";
import {
	GermanAdpositionInflectionSelectionSchema,
	GermanAdpositionLemmaSchema,
} from "../src/german/lu/lexeme/adposition/german-adposition-bundle";
import {
	GermanAdverbInflectionSelectionSchema,
	GermanAdverbLemmaSchema,
} from "../src/german/lu/lexeme/adverb/german-adverb-bundle";
import {
	GermanAuxiliaryInflectionSelectionSchema,
	GermanAuxiliaryLemmaSchema,
} from "../src/german/lu/lexeme/auxiliary/german-auxiliary-bundle";
import {
	GermanCoordinatingConjunctionInflectionSelectionSchema,
	GermanCoordinatingConjunctionLemmaSchema,
} from "../src/german/lu/lexeme/coordinating-conjunction/german-coordinating-conjunction-bundle";
import {
	GermanDeterminerInflectionSelectionSchema,
	GermanDeterminerLemmaSchema,
} from "../src/german/lu/lexeme/determiner/german-determiner-bundle";
import {
	GermanInterjectionInflectionSelectionSchema,
	GermanInterjectionLemmaSchema,
} from "../src/german/lu/lexeme/interjection/german-interjection-bundle";
import {
	GermanNumeralInflectionSelectionSchema,
	GermanNumeralLemmaSchema,
} from "../src/german/lu/lexeme/numeral/german-numeral-bundle";
import {
	GermanOtherInflectionSelectionSchema,
	GermanOtherLemmaSchema,
} from "../src/german/lu/lexeme/other/german-other-bundle";
import {
	GermanParticleInflectionSelectionSchema,
	GermanParticleLemmaSchema,
} from "../src/german/lu/lexeme/particle/german-particle-bundle";
import {
	GermanPronounInflectionSelectionSchema,
	GermanPronounLemmaSchema,
} from "../src/german/lu/lexeme/pronoun/german-pronoun-bundle";
import {
	GermanProperNounInflectionSelectionSchema,
	GermanProperNounLemmaSchema,
} from "../src/german/lu/lexeme/proper-noun/german-proper-noun-bundle";
import {
	GermanPunctuationInflectionSelectionSchema,
	GermanPunctuationLemmaSchema,
} from "../src/german/lu/lexeme/punctuation/german-punctuation-bundle";
import {
	GermanSubordinatingConjunctionInflectionSelectionSchema,
	GermanSubordinatingConjunctionLemmaSchema,
} from "../src/german/lu/lexeme/subordinating-conjunction/german-subordinating-conjunction-bundle";
import {
	GermanSymbolInflectionSelectionSchema,
	GermanSymbolLemmaSchema,
} from "../src/german/lu/lexeme/symbol/german-symbol-bundle";

describe("German remaining POS schemas", () => {
	it("accepts core inflectional schemas across the richer POS classes", () => {
		expect(
			GermanAdjectiveInflectionSelectionSchema.safeParse({
				orthographicStatus: "Standard",
				surface: {
					inflectionalFeatures: {
						case: "Dat",
						degree: "Cmp",
						gender: "Fem",
						number: "Sing",
					},
					lemma: {
						lemmaKind: "Lexeme",
						pos: "ADJ",
						spelledLemma: "klein",
					},
					spelledSurface: "kleiner",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanAdpositionInflectionSelectionSchema.safeParse({
				orthographicStatus: "Standard",
				surface: {
					inflectionalFeatures: {
						case: "Dat",
					},
					lemma: {
						lemmaKind: "Lexeme",
						pos: "ADP",
						spelledLemma: "zu",
					},
					spelledSurface: "zur",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanAuxiliaryInflectionSelectionSchema.safeParse({
				orthographicStatus: "Standard",
				surface: {
					inflectionalFeatures: {
						mood: "Ind",
						number: "Sing",
						person: "3",
						tense: "Past",
						verbForm: "Fin",
					},
					lemma: {
						lemmaKind: "Lexeme",
						pos: "AUX",
						spelledLemma: "sein",
					},
					spelledSurface: "war",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanDeterminerInflectionSelectionSchema.safeParse({
				orthographicStatus: "Standard",
				surface: {
					inflectionalFeatures: {
						case: "Nom",
						gender: "Masc",
						number: "Sing",
					},
					lemma: {
						lemmaKind: "Lexeme",
						pos: "DET",
						spelledLemma: "dies",
					},
					spelledSurface: "dieser",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanPronounInflectionSelectionSchema.safeParse({
				orthographicStatus: "Standard",
				surface: {
					inflectionalFeatures: {
						case: "Dat",
						number: "Sing",
						reflex: true,
					},
					lemma: {
						lemmaKind: "Lexeme",
						pos: "PRON",
						spelledLemma: "sich",
					},
					spelledSurface: "sich",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanProperNounInflectionSelectionSchema.safeParse({
				orthographicStatus: "Standard",
				surface: {
					inflectionalFeatures: {
						case: "Gen",
						number: "Sing",
					},
					lemma: {
						lemmaKind: "Lexeme",
						pos: "PROPN",
						spelledLemma: "Angela",
					},
					spelledSurface: "Angelas",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);
	});

	it("accepts lexical feature bundles for the richer POS classes", () => {
		expect(
			GermanAdverbLemmaSchema.safeParse({
				inherentFeatures: {
					pronType: "Dem",
				},
				lexicalRelations: {},
				morphologicalRelations: {},
				pos: "ADV",
			}).success,
		).toBe(true);

		expect(
			GermanDeterminerLemmaSchema.safeParse({
				inherentFeatures: {
					definite: "Def",
					pronType: "Art",
				},
				lexicalRelations: {},
				morphologicalRelations: {},
				pos: "DET",
			}).success,
		).toBe(true);

		expect(
			GermanNumeralLemmaSchema.safeParse({
				inherentFeatures: {
					numType: "Card",
				},
				lexicalRelations: {},
				morphologicalRelations: {},
				pos: "NUM",
			}).success,
		).toBe(true);

		expect(
			GermanParticleLemmaSchema.safeParse({
				inherentFeatures: {
					polarity: "Neg",
				},
				lexicalRelations: {},
				morphologicalRelations: {},
				pos: "PART",
			}).success,
		).toBe(true);

		expect(
			GermanProperNounLemmaSchema.safeParse({
				inherentFeatures: {
					gender: "Masc",
				},
				lexicalRelations: {},
				morphologicalRelations: {},
				pos: "PROPN",
			}).success,
		).toBe(true);

		expect(
			GermanSymbolLemmaSchema.safeParse({
				inherentFeatures: {
					numType: "Range",
				},
				lexicalRelations: {},
				morphologicalRelations: {},
				pos: "SYM",
			}).success,
		).toBe(true);

		expect(
			GermanOtherLemmaSchema.safeParse({
				inherentFeatures: {
					foreign: true,
				},
				lexicalRelations: {},
				morphologicalRelations: {},
				pos: "X",
			}).success,
		).toBe(true);
	});

	it("keeps the non-inflecting classes strict", () => {
		expect(
			GermanCoordinatingConjunctionInflectionSelectionSchema.safeParse({
				orthographicStatus: "Standard",
				surface: {
					inflectionalFeatures: {},
					lemma: {
						lemmaKind: "Lexeme",
						pos: "CCONJ",
						spelledLemma: "und",
					},
					spelledSurface: "und",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanInterjectionInflectionSelectionSchema.safeParse({
				orthographicStatus: "Standard",
				surface: {
					inflectionalFeatures: {},
					lemma: {
						lemmaKind: "Lexeme",
						pos: "INTJ",
						spelledLemma: "ach",
					},
					spelledSurface: "ach",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanPunctuationInflectionSelectionSchema.safeParse({
				orthographicStatus: "Standard",
				surface: {
					inflectionalFeatures: {},
					lemma: {
						lemmaKind: "Lexeme",
						pos: "PUNCT",
						spelledLemma: ",",
					},
					spelledSurface: ",",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanSubordinatingConjunctionInflectionSelectionSchema.safeParse({
				orthographicStatus: "Standard",
				surface: {
					inflectionalFeatures: {},
					lemma: {
						lemmaKind: "Lexeme",
						pos: "SCONJ",
						spelledLemma: "weil",
					},
					spelledSurface: "weil",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanCoordinatingConjunctionLemmaSchema.safeParse({
				inherentFeatures: {
					case: "Nom",
				},
				lexicalRelations: {},
				morphologicalRelations: {},
				pos: "CCONJ",
			}).success,
		).toBe(false);
	});

	it("rejects unsupported feature values where subsets matter", () => {
		expect(
			GermanAdverbLemmaSchema.safeParse({
				inherentFeatures: {
					pronType: "Prs",
				},
				lexicalRelations: {},
				morphologicalRelations: {},
				pos: "ADV",
			}).success,
		).toBe(false);

		expect(
			GermanOtherInflectionSelectionSchema.safeParse({
				orthographicStatus: "Standard",
				surface: {
					inflectionalFeatures: {
						tense: "Past",
					},
					lemma: {
						lemmaKind: "Lexeme",
						pos: "X",
						spelledLemma: "foobar",
					},
					spelledSurface: "foobar",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);
	});

	it("exposes registry access for the newly implemented POSes", () => {
		const standardInflectionChecks = [
			["ADJ", GermanAdjectiveInflectionSelectionSchema],
			["ADP", GermanAdpositionInflectionSelectionSchema],
			["ADV", GermanAdverbInflectionSelectionSchema],
			["AUX", GermanAuxiliaryInflectionSelectionSchema],
			["CCONJ", GermanCoordinatingConjunctionInflectionSelectionSchema],
			["DET", GermanDeterminerInflectionSelectionSchema],
			["INTJ", GermanInterjectionInflectionSelectionSchema],
			["NUM", GermanNumeralInflectionSelectionSchema],
			["PART", GermanParticleInflectionSelectionSchema],
			["PRON", GermanPronounInflectionSelectionSchema],
			["PROPN", GermanProperNounInflectionSelectionSchema],
			["PUNCT", GermanPunctuationInflectionSelectionSchema],
			["SCONJ", GermanSubordinatingConjunctionInflectionSelectionSchema],
			["SYM", GermanSymbolInflectionSelectionSchema],
			["X", GermanOtherInflectionSelectionSchema],
		] as const;

		for (const [pos, schema] of standardInflectionChecks) {
			expect(SelectionSchema.German.Standard.Inflection.Lexeme[pos]).toBe(
				schema,
			);
		}

		const lemmaChecks = [
			["ADJ", GermanAdjectiveLemmaSchema],
			["ADP", GermanAdpositionLemmaSchema],
			["ADV", GermanAdverbLemmaSchema],
			["AUX", GermanAuxiliaryLemmaSchema],
			["CCONJ", GermanCoordinatingConjunctionLemmaSchema],
			["DET", GermanDeterminerLemmaSchema],
			["INTJ", GermanInterjectionLemmaSchema],
			["NUM", GermanNumeralLemmaSchema],
			["PART", GermanParticleLemmaSchema],
			["PRON", GermanPronounLemmaSchema],
			["PROPN", GermanProperNounLemmaSchema],
			["PUNCT", GermanPunctuationLemmaSchema],
			["SCONJ", GermanSubordinatingConjunctionLemmaSchema],
			["SYM", GermanSymbolLemmaSchema],
			["X", GermanOtherLemmaSchema],
		] as const;

		for (const [pos, schema] of lemmaChecks) {
			expect(LemmaSchema.German.Lexeme[pos]).toBe(schema);
		}
	});
});
