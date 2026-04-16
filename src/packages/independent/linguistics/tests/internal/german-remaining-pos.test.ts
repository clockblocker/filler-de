import { describe, expect, it } from "bun:test";
import { lingSchemaFor } from "../../src";
import { GermanAdjectiveSchemas } from "../../src/lu/language-packs/german/lu/lexeme/pos/german-adjective";
import { GermanAdpositionSchemas } from "../../src/lu/language-packs/german/lu/lexeme/pos/german-adposition";
import { GermanAdverbSchemas } from "../../src/lu/language-packs/german/lu/lexeme/pos/german-adverb";
import { GermanAuxiliarySchemas } from "../../src/lu/language-packs/german/lu/lexeme/pos/german-auxiliary";
import { GermanCoordinatingConjunctionSchemas } from "../../src/lu/language-packs/german/lu/lexeme/pos/german-coordinating-conjunction";
import { GermanDeterminerSchemas } from "../../src/lu/language-packs/german/lu/lexeme/pos/german-determiner";
import { GermanInterjectionSchemas } from "../../src/lu/language-packs/german/lu/lexeme/pos/german-interjection";
import { GermanNounSchemas } from "../../src/lu/language-packs/german/lu/lexeme/pos/german-noun";
import { GermanNumeralSchemas } from "../../src/lu/language-packs/german/lu/lexeme/pos/german-numeral";
import { GermanOtherSchemas } from "../../src/lu/language-packs/german/lu/lexeme/pos/german-other";
import { GermanParticleSchemas } from "../../src/lu/language-packs/german/lu/lexeme/pos/german-particle";
import { GermanPronounSchemas } from "../../src/lu/language-packs/german/lu/lexeme/pos/german-pronoun";
import { GermanProperNounSchemas } from "../../src/lu/language-packs/german/lu/lexeme/pos/german-proper-noun";
import { GermanPunctuationSchemas } from "../../src/lu/language-packs/german/lu/lexeme/pos/german-punctuation";
import { GermanSubordinatingConjunctionSchemas } from "../../src/lu/language-packs/german/lu/lexeme/pos/german-subordinating-conjunction";
import { GermanSymbolSchemas } from "../../src/lu/language-packs/german/lu/lexeme/pos/german-symbol";
import { makeLexemeSurfaceReference } from "../helpers";

const { Lemma: LemmaSchema, Selection: SelectionSchema } = lingSchemaFor;

describe("German remaining POS schemas", () => {
	it("accepts core inflectional schemas across the richer POS classes", () => {
		expect(
			GermanAdjectiveSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "kleiner",
				surface: {
					...makeLexemeSurfaceReference("ADJ", "klein"),
					inflectionalFeatures: {
						case: "Dat",
						degree: "Cmp",
						gender: "Fem",
						number: "Sing",
					},
					language: "German",
					normalizedFullSurface: "kleiner",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanAdpositionSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "zu",
				surface: {
					...makeLexemeSurfaceReference("ADP", "zu"),
					inflectionalFeatures: {},
					language: "German",
					normalizedFullSurface: "zu",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanAuxiliarySchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "war",
				surface: {
					...makeLexemeSurfaceReference("AUX", "sein"),
					inflectionalFeatures: {
						mood: "Ind",
						number: "Sing",
						person: "3",
						tense: "Past",
						verbForm: "Fin",
					},
					language: "German",
					normalizedFullSurface: "war",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanDeterminerSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "dieser",
				surface: {
					...makeLexemeSurfaceReference("DET", "dies"),
					inflectionalFeatures: {
						case: "Nom",
						gender: "Masc",
						number: "Sing",
					},
					language: "German",
					normalizedFullSurface: "dieser",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanPronounSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "sich",
				surface: {
					...makeLexemeSurfaceReference("PRON", "sich"),
					inflectionalFeatures: {
						case: "Dat",
						number: "Sing",
						reflex: "Yes",
					},
					language: "German",
					normalizedFullSurface: "sich",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanProperNounSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "Angelas",
				surface: {
					...makeLexemeSurfaceReference("PROPN", "Angela"),
					inflectionalFeatures: {
						case: "Gen",
						number: "Sing",
					},
					language: "German",
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
					polite: "Infm",
					pronType: "Art",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "👉",
				pos: "DET",
			}).success,
		).toBe(true);

		expect(
			GermanAdpositionSchemas.LemmaSchema.safeParse({
				canonicalLemma: "zu",
				inherentFeatures: {
					governedCase: "Dat",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "➡️",
				pos: "ADP",
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
			GermanPronounSchemas.LemmaSchema.safeParse({
				canonicalLemma: "du",
				inherentFeatures: {
					person: "2",
					polite: "Infm",
					pronType: "Prs",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "👤",
				pos: "PRON",
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
					foreign: "Yes",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "❓",
				pos: "X",
			}).success,
		).toBe(true);
	});

	it("accepts restored UD German feature families and multi-valued feature bags", () => {
		expect(
			GermanAuxiliarySchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "worden",
				surface: {
					...makeLexemeSurfaceReference("AUX", "werden"),
					inflectionalFeatures: {
						aspect: "Perf",
						verbForm: "Part",
						voice: "Pass",
					},
					language: "German",
					normalizedFullSurface: "worden",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanDeterminerSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "dessen",
				surface: {
					...makeLexemeSurfaceReference("DET", "dessen"),
					inflectionalFeatures: {
						gender: ["Masc", "Neut"],
						"gender[psor]": ["Masc", "Neut"],
						"number[psor]": "Sing",
					},
					language: "German",
					normalizedFullSurface: "dessen",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanDeterminerSchemas.LemmaSchema.safeParse({
				canonicalLemma: "welch",
				inherentFeatures: {
					extPos: "ADV",
					foreign: "Yes",
					pronType: ["Int", "Rel"],
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "❓",
				pos: "DET",
			}).success,
		).toBe(true);

		expect(
			GermanPronounSchemas.LemmaSchema.safeParse({
				canonicalLemma: "wer",
				inherentFeatures: {
					extPos: "DET",
					pronType: ["Dem", "Rel"],
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "❓",
				pos: "PRON",
			}).success,
		).toBe(true);

		expect(
			GermanPronounSchemas.LemmaSchema.safeParse({
				canonicalLemma: "wer",
				inherentFeatures: {
					extPos: "DET",
					pronType: ["Int", "Rel"],
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "❓",
				pos: "PRON",
			}).success,
		).toBe(true);

		expect(
			GermanAdverbSchemas.LemmaSchema.safeParse({
				canonicalLemma: "nirgends",
				inherentFeatures: {
					pronType: "Neg",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🚫",
				pos: "ADV",
			}).success,
		).toBe(true);

		expect(
			GermanAdpositionSchemas.LemmaSchema.safeParse({
				canonicalLemma: "mit",
				inherentFeatures: {
					adpType: "Prep",
					extPos: "SCONJ",
					governedCase: "Dat",
					partType: "Vbp",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "➡️",
				pos: "ADP",
			}).success,
		).toBe(true);

		expect(
			GermanParticleSchemas.LemmaSchema.safeParse({
				canonicalLemma: "zu",
				inherentFeatures: {
					partType: "Inf",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "➕",
				pos: "PART",
			}).success,
		).toBe(true);

		expect(
			GermanSubordinatingConjunctionSchemas.LemmaSchema.safeParse({
				canonicalLemma: "als",
				inherentFeatures: {
					conjType: "Comp",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🔗",
				pos: "SCONJ",
			}).success,
		).toBe(true);

		expect(
			GermanCoordinatingConjunctionSchemas.LemmaSchema.safeParse({
				canonicalLemma: "wie",
				inherentFeatures: {
					conjType: "Comp",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🔗",
				pos: "CCONJ",
			}).success,
		).toBe(true);

		expect(
			GermanInterjectionSchemas.LemmaSchema.safeParse({
				canonicalLemma: "hm",
				inherentFeatures: {
					partType: "Res",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🤔",
				pos: "INTJ",
			}).success,
		).toBe(true);

		expect(
			GermanPunctuationSchemas.LemmaSchema.safeParse({
				canonicalLemma: ".",
				inherentFeatures: {
					punctType: "Peri",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "⏹️",
				pos: "PUNCT",
			}).success,
		).toBe(true);

		expect(
			GermanAdjectiveSchemas.LemmaSchema.safeParse({
				canonicalLemma: "nix",
				inherentFeatures: {
					variant: "Short",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "✂️",
				pos: "ADJ",
			}).success,
		).toBe(true);

		expect(
			GermanNounSchemas.LemmaSchema.safeParse({
				canonicalLemma: "S-Bahn-",
				inherentFeatures: {
					gender: "Fem",
					hyph: "Yes",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "➖",
				pos: "NOUN",
			}).success,
		).toBe(true);
	});

	it("keeps the non-inflecting classes strict", () => {
		expect(
			GermanCoordinatingConjunctionSchemas.InflectionSelectionSchema.safeParse(
				{
					language: "German",
					orthographicStatus: "Standard",
					selectionCoverage: "Full",
					spelledSelection: "und",
					surface: {
						...makeLexemeSurfaceReference("CCONJ", "und"),
						inflectionalFeatures: {},
						language: "German",
						normalizedFullSurface: "und",
						surfaceKind: "Inflection",
					},
				},
			).success,
		).toBe(true);

		expect(
			GermanInterjectionSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "ach",
				surface: {
					...makeLexemeSurfaceReference("INTJ", "ach"),
					inflectionalFeatures: {},
					language: "German",
					normalizedFullSurface: "ach",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanPunctuationSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: ",",
				surface: {
					...makeLexemeSurfaceReference("PUNCT", ","),
					inflectionalFeatures: {},
					language: "German",
					normalizedFullSurface: ",",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(true);

		expect(
			GermanSubordinatingConjunctionSchemas.InflectionSelectionSchema.safeParse(
				{
					language: "German",
					orthographicStatus: "Standard",
					selectionCoverage: "Full",
					spelledSelection: "weil",
					surface: {
						...makeLexemeSurfaceReference("SCONJ", "weil"),
						inflectionalFeatures: {},
						language: "German",
						normalizedFullSurface: "weil",
						surfaceKind: "Inflection",
					},
				},
			).success,
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
				selectionCoverage: "Full",
				spelledSelection: "foobar",
				surface: {
					...makeLexemeSurfaceReference("X", "foobar"),
					inflectionalFeatures: {
						tense: "Past",
					},
					language: "German",
					normalizedFullSurface: "foobar",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			GermanAdpositionSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "zu",
				surface: {
					...makeLexemeSurfaceReference("ADP", "zu"),
					inflectionalFeatures: {
						case: "Dat",
					},
					language: "German",
					normalizedFullSurface: "zu",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			GermanParticleSchemas.LemmaSchema.safeParse({
				canonicalLemma: "hm",
				inherentFeatures: {
					partType: "Res",
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🤔",
				pos: "PART",
			}).success,
		).toBe(false);

		expect(
			GermanDeterminerSchemas.LemmaSchema.safeParse({
				canonicalLemma: "welch",
				inherentFeatures: {
					pronType: ["Emp", "Rel"],
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "❓",
				pos: "DET",
			}).success,
		).toBe(false);

		expect(
			GermanPronounSchemas.LemmaSchema.safeParse({
				canonicalLemma: "wer",
				inherentFeatures: {
					pronType: ["Neg", "Rel"],
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "❓",
				pos: "PRON",
			}).success,
		).toBe(false);

		expect(
			GermanDeterminerSchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "dessen",
				surface: {
					...makeLexemeSurfaceReference("DET", "dessen"),
					inflectionalFeatures: {
						gender: ["Masc", "Neut", "Neut"],
					},
					language: "German",
					normalizedFullSurface: "dessen",
					surfaceKind: "Inflection",
				},
			}).success,
		).toBe(false);

		expect(
			GermanPronounSchemas.LemmaSchema.safeParse({
				canonicalLemma: "wer",
				inherentFeatures: {
					pronType: ["Int", "Rel", "Rel"],
				},
				language: "German",
				lemmaKind: "Lexeme",
				meaningInEmojis: "❓",
				pos: "PRON",
			}).success,
		).toBe(false);
	});

	it("rejects impossible German auxiliary feature combinations", () => {
		expect(
			GermanAuxiliarySchemas.InflectionSelectionSchema.safeParse({
				language: "German",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "sei",
				surface: {
					...makeLexemeSurfaceReference("AUX", "sein"),
					inflectionalFeatures: {
						mood: "Sub",
						person: "3",
						verbForm: "Inf",
					},
					language: "German",
					normalizedFullSurface: "sei",
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
			[
				"CCONJ",
				GermanCoordinatingConjunctionSchemas.InflectionSelectionSchema,
			],
			["DET", GermanDeterminerSchemas.InflectionSelectionSchema],
			["INTJ", GermanInterjectionSchemas.InflectionSelectionSchema],
			["NUM", GermanNumeralSchemas.InflectionSelectionSchema],
			["PART", GermanParticleSchemas.InflectionSelectionSchema],
			["PRON", GermanPronounSchemas.InflectionSelectionSchema],
			["PROPN", GermanProperNounSchemas.InflectionSelectionSchema],
			["PUNCT", GermanPunctuationSchemas.InflectionSelectionSchema],
			[
				"SCONJ",
				GermanSubordinatingConjunctionSchemas.InflectionSelectionSchema,
			],
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
