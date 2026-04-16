import { describe, expect, it } from "bun:test";
import { EnglishAdjectiveSchemas } from "../../src/lu/language-packs/english/lu/lexeme/pos/english-adjective";
import { EnglishAdpositionSchemas } from "../../src/lu/language-packs/english/lu/lexeme/pos/english-adposition";
import { EnglishAuxiliarySchemas } from "../../src/lu/language-packs/english/lu/lexeme/pos/english-auxiliary";
import { EnglishCoordinatingConjunctionSchemas } from "../../src/lu/language-packs/english/lu/lexeme/pos/english-coordinating-conjunction";
import { EnglishDeterminerSchemas } from "../../src/lu/language-packs/english/lu/lexeme/pos/english-determiner";
import { EnglishNounSchemas } from "../../src/lu/language-packs/english/lu/lexeme/pos/english-noun";
import { EnglishNumeralSchemas } from "../../src/lu/language-packs/english/lu/lexeme/pos/english-numeral";
import { EnglishOtherSchemas } from "../../src/lu/language-packs/english/lu/lexeme/pos/english-other";
import { EnglishParticleSchemas } from "../../src/lu/language-packs/english/lu/lexeme/pos/english-particle";
import { EnglishPronounSchemas } from "../../src/lu/language-packs/english/lu/lexeme/pos/english-pronoun";
import { EnglishProperNounSchemas } from "../../src/lu/language-packs/english/lu/lexeme/pos/english-proper-noun";
import { EnglishSymbolSchemas } from "../../src/lu/language-packs/english/lu/lexeme/pos/english-symbol";
import { EnglishVerbSchemas } from "../../src/lu/language-packs/english/lu/lexeme/pos/english-verb";
import { makeLexemeSurfaceReference } from "../attested-entities";

describe("English schema specificity", () => {
	it("keeps English adjective inflection to degree and adpositions uninflected", () => {
		expect(
			EnglishAdjectiveSchemas.InflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "smaller",
				surface: {
					...makeLexemeSurfaceReference("ADJ", "small"),
					inflectionalFeatures: {
						degree: "Cmp",
					},
					language: "English",
					normalizedFullSurface: "smaller",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			EnglishAdjectiveSchemas.InflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "small",
				surface: {
					...makeLexemeSurfaceReference("ADJ", "small"),
					inflectionalFeatures: {
						case: "Dat",
					},
					language: "English",
					normalizedFullSurface: "small",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishAdpositionSchemas.InflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "to",
				surface: {
					...makeLexemeSurfaceReference("ADP", "to"),
					inflectionalFeatures: {
						case: "Acc",
					},
					language: "English",
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
				selectionCoverage: "Full",
				spelledSelection: "scissors",
				surface: {
					...makeLexemeSurfaceReference("NOUN", "scissors"),
					inflectionalFeatures: {
						number: "Ptan",
					},
					language: "English",
					normalizedFullSurface: "scissors",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			EnglishNounSchemas.InflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "dog",
				surface: {
					...makeLexemeSurfaceReference("NOUN", "dog"),
					inflectionalFeatures: {
						case: "Gen",
					},
					language: "English",
					normalizedFullSurface: "dog",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishProperNounSchemas.InflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "Anna",
				surface: {
					...makeLexemeSurfaceReference("PROPN", "Anna"),
					inflectionalFeatures: {
						number: "Ptan",
					},
					language: "English",
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
				selectionCoverage: "Full",
				spelledSelection: "washed",
				surface: {
					...makeLexemeSurfaceReference("VERB", "wash"),
					inflectionalFeatures: {
						gender: "Neut",
					},
					language: "English",
					normalizedFullSurface: "washed",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishAuxiliarySchemas.InflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "is",
				surface: {
					...makeLexemeSurfaceReference("AUX", "be"),
					inflectionalFeatures: {
						gender: "Fem",
					},
					language: "English",
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
				selectionCoverage: "Full",
				spelledSelection: "washing",
				surface: {
					...makeLexemeSurfaceReference("VERB", "wash"),
					inflectionalFeatures: {
						verbForm: "Ger",
					},
					language: "English",
					normalizedFullSurface: "washing",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			EnglishVerbSchemas.InflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "washed",
				surface: {
					...makeLexemeSurfaceReference("VERB", "wash"),
					inflectionalFeatures: {
						voice: "Pass",
					},
					language: "English",
					normalizedFullSurface: "washed",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			EnglishAuxiliarySchemas.InflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "being",
				surface: {
					...makeLexemeSurfaceReference("AUX", "be"),
					inflectionalFeatures: {
						verbForm: "Ger",
					},
					language: "English",
					normalizedFullSurface: "being",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			EnglishVerbSchemas.LemmaSchema.safeParse({
				canonicalLemma: "look",
				inherentFeatures: {
					hasGovPrep: "to",
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
					hasSepPrefix: "up",
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
					hasGovPrep: "",
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
				selectionCoverage: "Full",
				spelledSelection: "him",
				surface: {
					...makeLexemeSurfaceReference("PRON", "him"),
					inflectionalFeatures: {
						case: "Acc",
					},
					language: "English",
					normalizedFullSurface: "him",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			EnglishPronounSchemas.InflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "him",
				surface: {
					...makeLexemeSurfaceReference("PRON", "him"),
					inflectionalFeatures: {
						case: "Dat",
					},
					language: "English",
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
				selectionCoverage: "Full",
				spelledSelection: "this",
				surface: {
					...makeLexemeSurfaceReference("DET", "this"),
					inflectionalFeatures: {
						case: "Gen",
					},
					language: "English",
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
				selectionCoverage: "Full",
				spelledSelection: "two",
				surface: {
					...makeLexemeSurfaceReference("NUM", "two"),
					inflectionalFeatures: {
						case: "Acc",
					},
					language: "English",
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
				selectionCoverage: "Full",
				spelledSelection: "%",
				surface: {
					...makeLexemeSurfaceReference("SYM", "%"),
					inflectionalFeatures: {
						number: "Sing",
					},
					language: "English",
					normalizedFullSurface: "%",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			EnglishSymbolSchemas.InflectionSelectionSchema.safeParse({
				language: "English",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "%",
				surface: {
					...makeLexemeSurfaceReference("SYM", "%"),
					inflectionalFeatures: {
						case: "Acc",
					},
					language: "English",
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
