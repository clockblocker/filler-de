import { describe, expect, it } from "bun:test";
import type { Lemma, Selection } from "../../src";
import { LingSchemaFor } from "../../src";
import { GermanMorphemeLemmaSchemas } from "../../src/lu/language-packs/german/lu/morpheme/german-morphemes";
import { GermanPhrasemeLemmaSchemas } from "../../src/lu/language-packs/german/lu/phraseme/german-phrasemes";

const { Lemma: LemmaSchema, Selection: SelectionSchema } = LingSchemaFor;

describe("German non-lexeme schemas", () => {
	it("exposes inferred morpheme and phraseme lemma types from the registry", () => {
		const morpheme = {
			canonicalLemma: "ab-",
			language: "German",
			lemmaKind: "Morpheme",
			meaningInEmojis: "🧩",
			morphemeKind: "Prefix",
		} satisfies Lemma<"German", "Morpheme", "Prefix">;

		const phraseme: Selection<
			"German",
			"Standard",
			"Lemma",
			"Phraseme",
			"DiscourseFormula"
		> = {
			language: "German",
			orthographicStatus: "Standard",
			spelledSelection: "auf jeden Fall",
			surface: {
				discriminators: {
					lemmaKind: "Phraseme",
					lemmaSubKind: "DiscourseFormula",
				},
				normalizedFullSurface: "auf jeden Fall",
				surfaceKind: "Lemma",
				target: {
					canonicalLemma: "auf jeden Fall",
				},
			},
		};

		expect(morpheme.morphemeKind).toBe("Prefix");
		expect(phraseme.surface.discriminators.lemmaSubKind).toBe(
			"DiscourseFormula",
		);
	});

	it("accepts German morpheme lemmas", () => {
		const result = GermanMorphemeLemmaSchemas.Prefix.safeParse({
			canonicalLemma: "ab-",
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
			canonicalLemma: "ab-",
			language: "German",
			lemmaKind: "Morpheme",
			morphemeKind: "Suffix",
		});

		expect(result.success).toBe(false);
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
				spelledSelection: "-hait",
				surface: {
					discriminators: {
						lemmaKind: "Morpheme",
						lemmaSubKind: "Suffix",
					},
					normalizedFullSurface: "-hait",
					surfaceKind: "Lemma",
					target: {
						canonicalLemma: "-heit",
					},
				},
			});
		const phrasemeResult =
			SelectionSchema.German.Typo.Lemma.Phraseme.Cliché.safeParse({
				language: "German",
				orthographicStatus: "Typo",
				spelledSelection: "Zeit ist Gelt",
				surface: {
					discriminators: {
						lemmaKind: "Phraseme",
						lemmaSubKind: "Cliché",
					},
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

	it("accepts German lemma selections with a narrower spelled selection", () => {
		const phraseme: Selection<
			"German",
			"Standard",
			"Lemma",
			"Phraseme",
			"Cliché"
		> = {
			language: "German",
			orthographicStatus: "Standard",
			spelledSelection: "Spaziergang",
			surface: {
				discriminators: {
					lemmaKind: "Phraseme",
					lemmaSubKind: "Cliché",
				},
				normalizedFullSurface: "ein Spaziergang im Park",
				surfaceKind: "Lemma",
				target: {
					canonicalLemma: "ein Spaziergang im Park",
				},
			},
		};
		const result =
			SelectionSchema.German.Standard.Lemma.Phraseme.Cliché.safeParse(
				phraseme,
			);

		expect(result.success).toBe(true);
	});
});
