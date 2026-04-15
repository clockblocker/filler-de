import { describe, expect, it } from "bun:test";
import { LemmaSchema, SelectionSchema } from "../../src";
import { HebrewNounSchemas } from "../../src/lu/hebrew/lu/lexeme/pos/hebrew-noun";
import { HebrewVerbSchemas } from "../../src/lu/hebrew/lu/lexeme/pos/hebrew-verb";

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
				spelledSelection: "shnatayim",
				surface: {
					discriminators: {
						lemmaKind: "Lexeme",
						lemmaSubKind: "NOUN",
					},
					inflectionalFeatures: {
						number: ["Dual", "Plur"],
					},
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
		expect("PART" in SelectionSchema.Hebrew.Standard.Inflection.Lexeme).toBe(
			false,
		);
		expect("PART" in LemmaSchema.Hebrew.Lexeme).toBe(false);
	});
});
