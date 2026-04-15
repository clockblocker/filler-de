import { describe, expect, it } from "bun:test";
import { LemmaSchema, SelectionSchema } from "../../src";
import { GermanAdjectiveSchemas } from "../../src/lu/german/lu/lexeme/pos/adjective/german-adjective-bundle";
import { GermanAdpositionSchemas } from "../../src/lu/german/lu/lexeme/pos/adposition/german-adposition-bundle";
import { GermanAdverbSchemas } from "../../src/lu/german/lu/lexeme/pos/adverb/german-adverb-bundle";
import { GermanAuxiliarySchemas } from "../../src/lu/german/lu/lexeme/pos/auxiliary/german-auxiliary-bundle";
import { GermanCoordinatingConjunctionSchemas } from "../../src/lu/german/lu/lexeme/pos/coordinating-conjunction/german-coordinating-conjunction-bundle";
import { GermanDeterminerSchemas } from "../../src/lu/german/lu/lexeme/pos/determiner/german-determiner-bundle";
import { GermanInterjectionSchemas } from "../../src/lu/german/lu/lexeme/pos/interjection/german-interjection-bundle";
import { GermanNumeralSchemas } from "../../src/lu/german/lu/lexeme/pos/numeral/german-numeral-bundle";
import { GermanOtherSchemas } from "../../src/lu/german/lu/lexeme/pos/other/german-other-bundle";
import { GermanParticleSchemas } from "../../src/lu/german/lu/lexeme/pos/particle/german-particle-bundle";
import { GermanPronounSchemas } from "../../src/lu/german/lu/lexeme/pos/pronoun/german-pronoun-bundle";
import { GermanProperNounSchemas } from "../../src/lu/german/lu/lexeme/pos/proper-noun/german-proper-noun-bundle";
import { GermanPunctuationSchemas } from "../../src/lu/german/lu/lexeme/pos/punctuation/german-punctuation-bundle";
import { GermanSubordinatingConjunctionSchemas } from "../../src/lu/german/lu/lexeme/pos/subordinating-conjunction/german-subordinating-conjunction-bundle";
import { GermanSymbolSchemas } from "../../src/lu/german/lu/lexeme/pos/symbol/german-symbol-bundle";

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

describe("German remaining POS schemas", () => {
	it("accepts core inflectional schemas across the richer POS classes", () => {
		expect(
			GermanAdjectiveSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				spelledSelection: "kleiner",
				surface: {
					...lexemeSurface("ADJ", "klein"),
					inflectionalFeatures: {
						case: "Dat",
						degree: "Cmp",
						gender: "Fem",
						number: "Sing",
					},
					normalizedFullSurface: "kleiner",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanAdpositionSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				spelledSelection: "zur",
				surface: {
					...lexemeSurface("ADP", "zu"),
					inflectionalFeatures: {
						case: "Dat",
					},
					normalizedFullSurface: "zur",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanAuxiliarySchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				spelledSelection: "war",
				surface: {
					...lexemeSurface("AUX", "sein"),
					inflectionalFeatures: {
						mood: "Ind",
						number: "Sing",
						person: "3",
						tense: "Past",
						verbForm: "Fin",
					},
					normalizedFullSurface: "war",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanDeterminerSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				spelledSelection: "dieser",
				surface: {
					...lexemeSurface("DET", "dies"),
					inflectionalFeatures: {
						case: "Nom",
						gender: "Masc",
						number: "Sing",
					},
					normalizedFullSurface: "dieser",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanPronounSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				spelledSelection: "sich",
				surface: {
					...lexemeSurface("PRON", "sich"),
					inflectionalFeatures: {
						case: "Dat",
						number: "Sing",
						reflex: true,
					},
					normalizedFullSurface: "sich",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanProperNounSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				spelledSelection: "Angelas",
				surface: {
					...lexemeSurface("PROPN", "Angela"),
					inflectionalFeatures: {
						case: "Gen",
						number: "Sing",
					},
					normalizedFullSurface: "Angelas",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);
	});

	it("accepts lexical feature bundles for the richer POS classes", () => {
		expect(
			GermanAdverbSchemas.LemmaSchema.safeParse({
				canonicalLemma: "gern",
				inherentFeatures: {
					pronType: "Dem",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "😊",
				pos: "ADV",
			}).success,
		).toBe(true);

		expect(
			GermanDeterminerSchemas.LemmaSchema.safeParse({
				canonicalLemma: "dies",
				inherentFeatures: {
					definite: "Def",
					pronType: "Art",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "👉",
				pos: "DET",
			}).success,
		).toBe(true);

		expect(
			GermanNumeralSchemas.LemmaSchema.safeParse({
				canonicalLemma: "eins",
				inherentFeatures: {
					numType: "Card",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🔢",
				pos: "NUM",
			}).success,
		).toBe(true);

		expect(
			GermanParticleSchemas.LemmaSchema.safeParse({
				canonicalLemma: "nicht",
				inherentFeatures: {
					polarity: "Neg",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🚫",
				pos: "PART",
			}).success,
		).toBe(true);

		expect(
			GermanProperNounSchemas.LemmaSchema.safeParse({
				canonicalLemma: "Angela",
				inherentFeatures: {
					gender: "Masc",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "👤",
				pos: "PROPN",
			}).success,
		).toBe(true);

		expect(
			GermanSymbolSchemas.LemmaSchema.safeParse({
				canonicalLemma: "%",
				inherentFeatures: {
					numType: "Range",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "📊",
				pos: "SYM",
			}).success,
		).toBe(true);

		expect(
			GermanOtherSchemas.LemmaSchema.safeParse({
				canonicalLemma: "foobar",
				inherentFeatures: {
					foreign: true,
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "❓",
				pos: "X",
			}).success,
		).toBe(true);
	});

	it("keeps the non-inflecting classes strict", () => {
		expect(
			GermanCoordinatingConjunctionSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				spelledSelection: "und",
				surface: {
					...lexemeSurface("CCONJ", "und"),
					inflectionalFeatures: {},
					normalizedFullSurface: "und",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanInterjectionSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				spelledSelection: "ach",
				surface: {
					...lexemeSurface("INTJ", "ach"),
					inflectionalFeatures: {},
					normalizedFullSurface: "ach",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanPunctuationSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				spelledSelection: ",",
				surface: {
					...lexemeSurface("PUNCT", ","),
					inflectionalFeatures: {},
					normalizedFullSurface: ",",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanSubordinatingConjunctionSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				spelledSelection: "weil",
				surface: {
					...lexemeSurface("SCONJ", "weil"),
					inflectionalFeatures: {},
					normalizedFullSurface: "weil",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanCoordinatingConjunctionSchemas.LemmaSchema.safeParse({
				canonicalLemma: "und",
				inherentFeatures: {
					case: "Nom",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "➕",
				pos: "CCONJ",
			}).success,
		).toBe(false);
	});

	it("rejects unsupported feature values where subsets matter", () => {
		expect(
			GermanAdverbSchemas.LemmaSchema.safeParse({
				canonicalLemma: "gern",
				inherentFeatures: {
					pronType: "Prs",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "😊",
				pos: "ADV",
			}).success,
		).toBe(false);

		expect(
			GermanOtherSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				spelledSelection: "foobar",
				surface: {
					...lexemeSurface("X", "foobar"),
					inflectionalFeatures: {
						tense: "Past",
					},
					normalizedFullSurface: "foobar",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);
	});

	it("exposes registry access for the newly implemented POSes", () => {
		const standardInflectionChecks = [
			["ADJ", GermanAdjectiveSchemas.InflectionSelectionSchema],
			["ADP", GermanAdpositionSchemas.InflectionSelectionSchema],
			["ADV", GermanAdverbSchemas.InflectionSelectionSchema],
			["AUX", GermanAuxiliarySchemas.InflectionSelectionSchema],
			["CCONJ", GermanCoordinatingConjunctionSchemas.InflectionSelectionSchema],
			["DET", GermanDeterminerSchemas.InflectionSelectionSchema],
			["INTJ", GermanInterjectionSchemas.InflectionSelectionSchema],
			["NUM", GermanNumeralSchemas.InflectionSelectionSchema],
			["PART", GermanParticleSchemas.InflectionSelectionSchema],
			["PRON", GermanPronounSchemas.InflectionSelectionSchema],
			["PROPN", GermanProperNounSchemas.InflectionSelectionSchema],
			["PUNCT", GermanPunctuationSchemas.InflectionSelectionSchema],
			["SCONJ", GermanSubordinatingConjunctionSchemas.InflectionSelectionSchema],
			["SYM", GermanSymbolSchemas.InflectionSelectionSchema],
			["X", GermanOtherSchemas.InflectionSelectionSchema],
		] as const;

		for (const [pos, schema] of standardInflectionChecks) {
			expect(SelectionSchema.German.Standard.Inflection.Lexeme[pos]).toBe(
				schema,
			);
		}

		const lemmaChecks = [
			["ADJ", GermanAdjectiveSchemas.LemmaSchema],
			["ADP", GermanAdpositionSchemas.LemmaSchema],
			["ADV", GermanAdverbSchemas.LemmaSchema],
			["AUX", GermanAuxiliarySchemas.LemmaSchema],
			["CCONJ", GermanCoordinatingConjunctionSchemas.LemmaSchema],
			["DET", GermanDeterminerSchemas.LemmaSchema],
			["INTJ", GermanInterjectionSchemas.LemmaSchema],
			["NUM", GermanNumeralSchemas.LemmaSchema],
			["PART", GermanParticleSchemas.LemmaSchema],
			["PRON", GermanPronounSchemas.LemmaSchema],
			["PROPN", GermanProperNounSchemas.LemmaSchema],
			["PUNCT", GermanPunctuationSchemas.LemmaSchema],
			["SCONJ", GermanSubordinatingConjunctionSchemas.LemmaSchema],
			["SYM", GermanSymbolSchemas.LemmaSchema],
			["X", GermanOtherSchemas.LemmaSchema],
		] as const;

		for (const [pos, schema] of lemmaChecks) {
			expect(LemmaSchema.German.Lexeme[pos]).toBe(schema);
		}
	});
});
