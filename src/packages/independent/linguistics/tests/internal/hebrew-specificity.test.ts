import { describe, expect, it } from "bun:test";
import { lingSchemaFor } from "../../src";
import { HebrewNounSchemas } from "../../src/lu/language-packs/hebrew/lu/lexeme/pos/hebrew-noun";
import { HebrewVerbSchemas } from "../../src/lu/language-packs/hebrew/lu/lexeme/pos/hebrew-verb";

const { Lemma: LemmaSchema, Selection: SelectionSchema } = lingSchemaFor;

describe("Hebrew schema specificity", () => {
	it("accepts Hebrew-specific lexical and inflectional features", () => {
		expect(
			HebrewVerbSchemas.LemmaSchema.safeParse({
				canonicalLemma: "katav",
				inherentFeatures: {
					hebBinyan: "PAAL",
				},
				language: "Hebrew",
				lemmaKind: "Lexeme",
				meaningInEmojis: "✍️",
				pos: "VERB",
			}).success,
		).toBe(true);

		expect(
			HebrewVerbSchemas.InflectionSelectionSchema.safeParse({
				language: "Hebrew",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "katvu",
				surface: {
					discriminators: {
						lemmaKind: "Lexeme",
						lemmaSubKind: "VERB",
					},
					inflectionalFeatures: {
						number: "Plur",
						person: ["1", "2", "3"],
						tense: "Past",
					},
					language: "Hebrew",
					normalizedFullSurface: "katvu",
					surfaceKind: "Inflection",
					target: {
						canonicalLemma: "katav",
					},
				},
			}).success,
		).toBe(true);

		expect(
			HebrewNounSchemas.InflectionSelectionSchema.safeParse({
				language: "Hebrew",
				orthographicStatus: "Standard",
				selectionCoverage: "Full",
				spelledSelection: "shnatayim",
				surface: {
					discriminators: {
						lemmaKind: "Lexeme",
						lemmaSubKind: "NOUN",
					},
					inflectionalFeatures: {
						number: ["Dual", "Plur"],
					},
					language: "Hebrew",
					normalizedFullSurface: "shnatayim",
					surfaceKind: "Inflection",
					target: {
						canonicalLemma: "shana",
					},
				},
			}).success,
		).toBe(true);
	});

	it("keeps Hebrew aligned with the UD source inventory and omits PART", () => {
		expect(
			"PART" in SelectionSchema.Hebrew.Standard.Inflection.Lexeme,
		).toBe(false);
		expect("PART" in LemmaSchema.Hebrew.Lexeme).toBe(false);
	});
});
