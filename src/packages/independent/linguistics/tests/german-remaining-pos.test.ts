import { describe, expect, it } from "bun:test";
import { LemmaSchema, SelectionSchema } from "../src";
import {
	GermanAdjectiveInflectionSelectionSchema,
	GermanAdjectiveLemmaSchema,
} from "../src/lu/german/lu/lexeme/adjective/german-adjective-bundle";
import {
	GermanAdpositionInflectionSelectionSchema,
	GermanAdpositionLemmaSchema,
} from "../src/lu/german/lu/lexeme/adposition/german-adposition-bundle";
import {
	GermanAdverbInflectionSelectionSchema,
	GermanAdverbLemmaSchema,
} from "../src/lu/german/lu/lexeme/adverb/german-adverb-bundle";
import {
	GermanAuxiliaryInflectionSelectionSchema,
	GermanAuxiliaryLemmaSchema,
} from "../src/lu/german/lu/lexeme/auxiliary/german-auxiliary-bundle";
import {
	GermanCoordinatingConjunctionInflectionSelectionSchema,
	GermanCoordinatingConjunctionLemmaSchema,
} from "../src/lu/german/lu/lexeme/coordinating-conjunction/german-coordinating-conjunction-bundle";
import {
	GermanDeterminerInflectionSelectionSchema,
	GermanDeterminerLemmaSchema,
} from "../src/lu/german/lu/lexeme/determiner/german-determiner-bundle";
import {
	GermanInterjectionInflectionSelectionSchema,
	GermanInterjectionLemmaSchema,
} from "../src/lu/german/lu/lexeme/interjection/german-interjection-bundle";
import {
	GermanNumeralInflectionSelectionSchema,
	GermanNumeralLemmaSchema,
} from "../src/lu/german/lu/lexeme/numeral/german-numeral-bundle";
import {
	GermanOtherInflectionSelectionSchema,
	GermanOtherLemmaSchema,
} from "../src/lu/german/lu/lexeme/other/german-other-bundle";
import {
	GermanParticleInflectionSelectionSchema,
	GermanParticleLemmaSchema,
} from "../src/lu/german/lu/lexeme/particle/german-particle-bundle";
import {
	GermanPronounInflectionSelectionSchema,
	GermanPronounLemmaSchema,
} from "../src/lu/german/lu/lexeme/pronoun/german-pronoun-bundle";
import {
	GermanProperNounInflectionSelectionSchema,
	GermanProperNounLemmaSchema,
} from "../src/lu/german/lu/lexeme/proper-noun/german-proper-noun-bundle";
import {
	GermanPunctuationInflectionSelectionSchema,
	GermanPunctuationLemmaSchema,
} from "../src/lu/german/lu/lexeme/punctuation/german-punctuation-bundle";
import {
	GermanSubordinatingConjunctionInflectionSelectionSchema,
	GermanSubordinatingConjunctionLemmaSchema,
} from "../src/lu/german/lu/lexeme/subordinating-conjunction/german-subordinating-conjunction-bundle";
import {
	GermanSymbolInflectionSelectionSchema,
	GermanSymbolLemmaSchema,
} from "../src/lu/german/lu/lexeme/symbol/german-symbol-bundle";

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
			GermanAdjectiveInflectionSelectionSchema.safeParse({
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
			GermanAdpositionInflectionSelectionSchema.safeParse({
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
			GermanAuxiliaryInflectionSelectionSchema.safeParse({
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
			GermanDeterminerInflectionSelectionSchema.safeParse({
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
			GermanPronounInflectionSelectionSchema.safeParse({
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
			GermanProperNounInflectionSelectionSchema.safeParse({
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
			GermanAdverbLemmaSchema.safeParse({
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
			GermanDeterminerLemmaSchema.safeParse({
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
			GermanNumeralLemmaSchema.safeParse({
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
			GermanParticleLemmaSchema.safeParse({
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
			GermanProperNounLemmaSchema.safeParse({
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
			GermanSymbolLemmaSchema.safeParse({
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
			GermanOtherLemmaSchema.safeParse({
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
			GermanCoordinatingConjunctionInflectionSelectionSchema.safeParse({
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
			GermanInterjectionInflectionSelectionSchema.safeParse({
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
			GermanPunctuationInflectionSelectionSchema.safeParse({
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
			GermanSubordinatingConjunctionInflectionSelectionSchema.safeParse({
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
			GermanCoordinatingConjunctionLemmaSchema.safeParse({
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
			GermanAdverbLemmaSchema.safeParse({
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
			GermanOtherInflectionSelectionSchema.safeParse({
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
