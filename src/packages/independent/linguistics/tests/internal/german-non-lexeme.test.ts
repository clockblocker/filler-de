import { describe, expect, it } from "bun:test";
import type { Lemma, Selection } from "../../src";
import { lingSchemaFor } from "../../src";
import { GermanMorphemeLemmaSchemas } from "../../src/lu/language-packs/german/lu/morpheme/german-morphemes";
import { GermanPhrasemeLemmaSchemas } from "../../src/lu/language-packs/german/lu/phraseme/german-phrasemes";
import {
	germanAbPrefixLemma,
	germanAufJedenFallDiscourseFormulaSelection,
	germanEinSpaziergangImParkClichePartialSelection,
} from "../helpers";

const { Lemma: LemmaSchema, Selection: SelectionSchema } = lingSchemaFor;

describe("German non-lexeme schemas", () => {
	it("exposes inferred morpheme and phraseme lemma types from the registry", () => {
		const morpheme = germanAbPrefixLemma satisfies Lemma<
			"German",
			"Morpheme",
			"Prefix"
		>;
		const phraseme =
			germanAufJedenFallDiscourseFormulaSelection satisfies Selection<
				"German",
				"Standard",
				"Lemma",
				"Phraseme",
				"DiscourseFormula"
			>;

		expect(morpheme.morphemeKind).toBe("Prefix");
		expect(phraseme.surface.discriminators.lemmaSubKind).toBe(
			"DiscourseFormula",
		);
	});

	it("accepts German morpheme lemmas", () => {
		const result = GermanMorphemeLemmaSchemas.Prefix.safeParse({
			canonicalLemma: "ab",
			isClosedSet: false,
			language: "German",
			lemmaKind: "Morpheme",
			meaningInEmojis: "🧩",
			morphemeKind: "Prefix",
		});

		expect(result.success).toBe(true);
	});

	it("rejects wrong discriminants for German morpheme lemmas", () => {
		const result = GermanMorphemeLemmaSchemas.Prefix.safeParse({
			canonicalLemma: "ab",
			language: "German",
			lemmaKind: "Morpheme",
			morphemeKind: "Suffix",
		});

		expect(result.success).toBe(false);
	});

	it("rejects decorated morpheme lemmas", () => {
		const prefixResult = GermanMorphemeLemmaSchemas.Prefix.safeParse({
			canonicalLemma: "ab-",
			language: "German",
			lemmaKind: "Morpheme",
			meaningInEmojis: "🧩",
			morphemeKind: "Prefix",
		});
		const suffixResult = GermanMorphemeLemmaSchemas.Suffix.safeParse({
			canonicalLemma: "-heit",
			language: "German",
			lemmaKind: "Morpheme",
			meaningInEmojis: "🧩",
			morphemeKind: "Suffix",
		});

		expect(prefixResult.success).toBe(false);
		expect(suffixResult.success).toBe(false);
	});

	it("accepts discourse formula phraseme roles and rejects them for other kinds", () => {
		const discourseFormulaResult =
			GermanPhrasemeLemmaSchemas.DiscourseFormula.safeParse({
				canonicalLemma: "auf jeden Fall",
				discourseFormulaRole: "Reaction",
				language: "German",
				lemmaKind: "Phraseme",
				meaningInEmojis: "✅",
				phrasemeKind: "DiscourseFormula",
			});

		const aphorismResult = GermanPhrasemeLemmaSchemas.Aphorism.safeParse({
			canonicalLemma: "Zeit ist Geld",
			discourseFormulaRole: "Reaction",
			language: "German",
			lemmaKind: "Phraseme",
			meaningInEmojis: "⏳💰",
			phrasemeKind: "Aphorism",
		});

		expect(discourseFormulaResult.success).toBe(true);
		expect(aphorismResult.success).toBe(false);
	});

	it("exposes lemma-only non-lexeme selection branches in the registry", () => {
		expect(
			SelectionSchema.German.Standard.Lemma.Morpheme.Prefix,
		).toBeDefined();
		expect(
			SelectionSchema.German.Typo.Lemma.Phraseme.DiscourseFormula,
		).toBeDefined();
		expect(
			SelectionSchema.German.Standard.Lemma.Phraseme.Cliché,
		).toBeDefined();
		expect("Morpheme" in SelectionSchema.German.Standard.Inflection).toBe(
			false,
		);
		expect(LemmaSchema.German.Morpheme.Prefix).toBe(
			GermanMorphemeLemmaSchemas.Prefix,
		);
		expect(LemmaSchema.German.Phraseme.Aphorism).toBe(
			GermanPhrasemeLemmaSchemas.Aphorism,
		);
	});

	it("accepts German typo lemma selections for morphemes and phrasemes", () => {
		const morphemeResult =
			SelectionSchema.German.Typo.Lemma.Morpheme.Suffix.safeParse({
				language: "German",
				orthographicStatus: "Typo",
				selectionCoverage: "Full",
				spelledSelection: "hait",
				surface: {
					discriminators: {
						lemmaKind: "Morpheme",
						lemmaSubKind: "Suffix",
					},
					language: "German",
					normalizedFullSurface: "hait",
					surfaceKind: "Lemma",
					target: {
						canonicalLemma: "heit",
					},
				},
			});
		const phrasemeResult =
			SelectionSchema.German.Typo.Lemma.Phraseme.Cliché.safeParse({
				language: "German",
				orthographicStatus: "Typo",
				selectionCoverage: "Full",
				spelledSelection: "Zeit ist Gelt",
				surface: {
					discriminators: {
						lemmaKind: "Phraseme",
						lemmaSubKind: "Cliché",
					},
					language: "German",
					normalizedFullSurface: "Zeit ist Gelt",
					surfaceKind: "Lemma",
					target: {
						canonicalLemma: "Zeit ist Geld",
					},
				},
			});

		expect(morphemeResult.success).toBe(true);
		expect(phrasemeResult.success).toBe(true);
	});

	it("rejects decorated unresolved morpheme targets", () => {
		const result =
			SelectionSchema.German.Typo.Lemma.Morpheme.Suffix.safeParse({
				language: "German",
				orthographicStatus: "Typo",
				selectionCoverage: "Full",
				spelledSelection: "hait",
				surface: {
					discriminators: {
						lemmaKind: "Morpheme",
						lemmaSubKind: "Suffix",
					},
					language: "German",
					normalizedFullSurface: "hait",
					surfaceKind: "Lemma",
					target: {
						canonicalLemma: "-heit",
					},
				},
			});

		expect(result.success).toBe(false);
	});

	it("accepts German lemma selections with a narrower spelled selection", () => {
		const result =
			SelectionSchema.German.Standard.Lemma.Phraseme.Cliché.safeParse(
				germanEinSpaziergangImParkClichePartialSelection,
			);

		expect(result.success).toBe(true);
	});
});
