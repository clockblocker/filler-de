import { describe, expect, it } from "bun:test";
import type { Lemma, Selection } from "../src";
import { LemmaSchema, SelectionSchema } from "../src";
import { GermanMorphemeLemmaSchemas } from "../src/lu/german/lu/morpheme/german-morphemes";
import { GermanPhrasemeLemmaSchemas } from "../src/lu/german/lu/phraseme/german-phrasemes";

describe("German non-lexeme schemas", () => {
	it("exposes inferred morpheme and phraseme lemma types from the registry", () => {
		const morpheme: Lemma<"German", "Morpheme", "Prefix"> = {
			language: "German",
			lemmaKind: "Morpheme",
			morphemeKind: "Prefix",
			spelledLemma: "ab-",
		};
		const phraseme: Selection<
			"German",
			"Standard",
			"Lemma",
			"Phraseme",
			"DiscourseFormula"
		> = {
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				lemma: {
					language: "German",
					lemmaKind: "Phraseme",
					phrasemeKind: "DiscourseFormula",
					spelledLemma: "auf jeden Fall",
				},
				spelledSurface: "auf jeden Fall",
				surfaceKind: "Lemma",
			},
		};

		expect(morpheme.morphemeKind).toBe("Prefix");
		expect(phraseme.surface.lemma.phrasemeKind).toBe("DiscourseFormula");
	});

	it("accepts German morpheme lemmas", () => {
		const result = GermanMorphemeLemmaSchemas.Prefix.safeParse({
			emojiDescription: ["🧩"],
			isClosedSet: false,
			language: "German",
			lemmaKind: "Morpheme",
			morphemeKind: "Prefix",
			spelledLemma: "ab-",
		});

		expect(result.success).toBe(true);
	});

	it("rejects wrong discriminants for German morpheme lemmas", () => {
		const result = GermanMorphemeLemmaSchemas.Prefix.safeParse({
			language: "German",
			lemmaKind: "Morpheme",
			morphemeKind: "Suffix",
			spelledLemma: "ab-",
		});

		expect(result.success).toBe(false);
	});

	it("accepts discourse formula phraseme roles and rejects them for other kinds", () => {
		const discourseFormulaResult =
			GermanPhrasemeLemmaSchemas.DiscourseFormula.safeParse({
				discourseFormulaRole: "Reaction",
				language: "German",
				lemmaKind: "Phraseme",
				phrasemeKind: "DiscourseFormula",
				spelledLemma: "auf jeden Fall",
			});
		const aphorismResult = GermanPhrasemeLemmaSchemas.Aphorism.safeParse({
			discourseFormulaRole: "Reaction",
			language: "German",
			lemmaKind: "Phraseme",
			phrasemeKind: "Aphorism",
			spelledLemma: "Zeit ist Geld",
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
			SelectionSchema.German.Standard.Partial.Phraseme.Cliché,
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
				surface: {
					lemma: {
						emojiDescription: ["🧩"],
						language: "German",
						lemmaKind: "Morpheme",
						morphemeKind: "Suffix",
						spelledLemma: "-heit",
					},
					spelledSurface: "-hait",
					surfaceKind: "Lemma",
				},
			});
		const phrasemeResult =
			SelectionSchema.German.Typo.Lemma.Phraseme.Cliché.safeParse({
				language: "German",
				orthographicStatus: "Typo",
				surface: {
					lemma: {
						emojiDescription: ["💬"],
						language: "German",
						lemmaKind: "Phraseme",
						phrasemeKind: "Cliché",
						spelledLemma: "Zeit ist Geld",
					},
					spelledSurface: "Zeit ist Gelt",
					surfaceKind: "Lemma",
				},
			});

		expect(morphemeResult.success).toBe(true);
		expect(phrasemeResult.success).toBe(true);
	});

	it("accepts German partial phraseme selections", () => {
		const phraseme: Selection<
			"German",
			"Standard",
			"Partial",
			"Phraseme",
			"Cliché"
		> = {
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				lemma: {
					language: "German",
					lemmaKind: "Phraseme",
					phrasemeKind: "Cliché",
					spelledLemma: "ein Spaziergang im Park",
				},
				spelledSurface: "Spaziergang",
				surfaceKind: "Partial",
			},
		};
		const result =
			SelectionSchema.German.Standard.Partial.Phraseme.Cliché.safeParse(
				phraseme,
			);

		expect(result.success).toBe(true);
	});
});
