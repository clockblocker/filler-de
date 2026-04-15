import { describe, expect, it } from "bun:test";
import { EnglishAdjectiveSchemas } from "../../src/lu/english/lu/lexeme/pos/english-adjective";
import { EnglishAdpositionSchemas } from "../../src/lu/english/lu/lexeme/pos/english-adposition";
import { EnglishAuxiliarySchemas } from "../../src/lu/english/lu/lexeme/pos/english-auxiliary";
import { EnglishDeterminerSchemas } from "../../src/lu/english/lu/lexeme/pos/english-determiner";
import { EnglishNounSchemas } from "../../src/lu/english/lu/lexeme/pos/english-noun";
import { EnglishNumeralSchemas } from "../../src/lu/english/lu/lexeme/pos/english-numeral";
import { EnglishOtherSchemas } from "../../src/lu/english/lu/lexeme/pos/english-other";
import { EnglishParticleSchemas } from "../../src/lu/english/lu/lexeme/pos/english-particle";
import { EnglishPronounSchemas } from "../../src/lu/english/lu/lexeme/pos/english-pronoun";
import { EnglishProperNounSchemas } from "../../src/lu/english/lu/lexeme/pos/english-proper-noun";
import { EnglishSymbolSchemas } from "../../src/lu/english/lu/lexeme/pos/english-symbol";
import { EnglishVerbSchemas } from "../../src/lu/english/lu/lexeme/pos/english-verb";
import { EnglishCoordinatingConjunctionSchemas } from "../../src/lu/english/lu/lexeme/pos/english-coordinating-conjunction";

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

	it("keeps English NOUN and PROPN to UD-style number features and drops grammatical gender", () => {
		expect(
			EnglishNounSchemas.InflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				spelledSelection: "scissors",
				surface: {
					...lexemeSurface("NOUN", "scissors"),
					inflectionalFeatures: {
						number: "Ptan",
					},
					normalizedFullSurface: "scissors",
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
						case: "Gen",
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
						number: "Ptan",
					},
					normalizedFullSurface: "Anna",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

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
				canonicalLemma: "wash",
				inherentFeatures: {},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🧼",
				pos: "VERB",
			}).success,
		).toBe(true);

		expect(
			EnglishVerbSchemas.InflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				spelledSelection: "washing",
				surface: {
					...lexemeSurface("VERB", "wash"),
					inflectionalFeatures: {
						verbForm: "Ger",
					},
					normalizedFullSurface: "washing",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			EnglishVerbSchemas.InflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				spelledSelection: "washed",
				surface: {
					...lexemeSurface("VERB", "wash"),
					inflectionalFeatures: {
						voice: "Pass",
					},
					normalizedFullSurface: "washed",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			EnglishAuxiliarySchemas.InflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				spelledSelection: "being",
				surface: {
					...lexemeSurface("AUX", "be"),
					inflectionalFeatures: {
						verbForm: "Ger",
					},
					normalizedFullSurface: "being",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishVerbSchemas.LemmaSchema.safeParse({
				canonicalLemma: "look",
				inherentFeatures: {
					governedPreposition: "to",
					phrasal: "Yes",
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
					reflex: "Yes",
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
					separable: "Yes",
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

	it("aligns English pronoun and determiner features with UD English EWT", () => {
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
				canonicalLemma: "self",
				inherentFeatures: {
					pronType: "Emp",
					style: "Expr",
				},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "👤",
				pos: "PRON",
			}).success,
		).toBe(true);

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
				canonicalLemma: "half",
				inherentFeatures: {
					abbr: "Yes",
					extPos: "ADV",
					numForm: "Word",
					numType: "Frac",
					pronType: "Rcp",
					style: "Vrnc",
				},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🧮",
				pos: "DET",
			}).success,
		).toBe(true);

		expect(
			EnglishDeterminerSchemas.LemmaSchema.safeParse({
				canonicalLemma: "this",
				inherentFeatures: {
					poss: "Yes",
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

	it("aligns English NUM, SYM, and X with UD English EWT", () => {
		expect(
			EnglishNumeralSchemas.InflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				spelledSelection: "two",
				surface: {
					...lexemeSurface("NUM", "two"),
					inflectionalFeatures: {
						case: "Acc",
					},
					normalizedFullSurface: "two",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishNumeralSchemas.LemmaSchema.safeParse({
				canonicalLemma: "II",
				inherentFeatures: {
					abbr: "Yes",
					extPos: "PROPN",
					numForm: "Roman",
					numType: "Frac",
				},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🧮",
				pos: "NUM",
			}).success,
		).toBe(true);

		expect(
			EnglishSymbolSchemas.InflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				spelledSelection: "%",
				surface: {
					...lexemeSurface("SYM", "%"),
					inflectionalFeatures: {
						number: "Sing",
					},
					normalizedFullSurface: "%",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			EnglishSymbolSchemas.InflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				spelledSelection: "%",
				surface: {
					...lexemeSurface("SYM", "%"),
					inflectionalFeatures: {
						case: "Acc",
					},
					normalizedFullSurface: "%",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishOtherSchemas.LemmaSchema.safeParse({
				canonicalLemma: "etc",
				inherentFeatures: {
					extPos: "PROPN",
					foreign: "Yes",
				},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "❓",
				pos: "X",
			}).success,
		).toBe(true);

		expect(
			EnglishOtherSchemas.LemmaSchema.safeParse({
				canonicalLemma: "etc",
				inherentFeatures: {
					numType: "Card",
				},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "❓",
				pos: "X",
			}).success,
		).toBe(false);
	});

	it("limits English PART and CCONJ polarity to Neg in UD English EWT", () => {
		expect(
			EnglishParticleSchemas.LemmaSchema.safeParse({
				canonicalLemma: "not",
				inherentFeatures: {
					polarity: "Neg",
				},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🚫",
				pos: "PART",
			}).success,
		).toBe(true);

		expect(
			EnglishParticleSchemas.LemmaSchema.safeParse({
				canonicalLemma: "not",
				inherentFeatures: {
					polarity: "Pos",
				},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🚫",
				pos: "PART",
			}).success,
		).toBe(false);

		expect(
			EnglishCoordinatingConjunctionSchemas.LemmaSchema.safeParse({
				canonicalLemma: "nor",
				inherentFeatures: {
					polarity: "Neg",
				},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🔗",
				pos: "CCONJ",
			}).success,
		).toBe(true);

		expect(
			EnglishCoordinatingConjunctionSchemas.LemmaSchema.safeParse({
				canonicalLemma: "and",
				inherentFeatures: {
					polarity: "Pos",
				},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🔗",
				pos: "CCONJ",
			}).success,
		).toBe(false);
	});
});
