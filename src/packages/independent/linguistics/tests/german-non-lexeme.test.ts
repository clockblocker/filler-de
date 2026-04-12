import { describe, expect, it } from "bun:test";
import { LemmaSchema, SelectionSchema } from "../src";
import type { Lemma, Selection } from "../src";
import { GermanMorphemeLemmaSchemas } from "../src/german/lu/morpheme/german-morphemes";
import { GermanPhrasemeLemmaSchemas } from "../src/german/lu/phraseme/german-phrasemes";

describe("German non-lexeme schemas", () => {
	it("exposes inferred morpheme and phraseme lemma types from the registry", () => {
		const morpheme: Lemma<"German", "Morpheme", "Prefix"> = {
			lexicalRelations: {},
			morphemeKind: "Prefix",
		};
		const phraseme: Selection<
			"German",
			"Standard",
			"Lemma",
			"Phraseme",
			"DiscourseFormula"
		> = {
			orthographicStatus: "Standard",
			surface: {
				lemma: {
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

	it("accepts German morpheme lemmas with lexical relations", () => {
		const result = GermanMorphemeLemmaSchemas.Prefix.safeParse({
			isClosedSet: false,
			lexicalRelations: {
				synonym: ["ab-"],
			},
			morphemeKind: "Prefix",
		});

		expect(result.success).toBe(true);
	});

	it("rejects wrong discriminants for German morpheme lemmas", () => {
		const result = GermanMorphemeLemmaSchemas.Prefix.safeParse({
			lexicalRelations: {},
			morphemeKind: "Suffix",
		});

		expect(result.success).toBe(false);
	});

	it("accepts discourse formula phraseme roles and rejects them for other kinds", () => {
		const discourseFormulaResult =
			GermanPhrasemeLemmaSchemas.DiscourseFormula.safeParse({
				discourseFormulaRole: "Reaction",
				lexicalRelations: {},
				phrasemeKind: "DiscourseFormula",
			});
		const aphorismResult = GermanPhrasemeLemmaSchemas.Aphorism.safeParse({
			discourseFormulaRole: "Reaction",
			lexicalRelations: {},
			phrasemeKind: "Aphorism",
		});

		expect(discourseFormulaResult.success).toBe(true);
		expect(aphorismResult.success).toBe(false);
	});

	it("exposes lemma-only non-lexeme selection branches in the registry", () => {
		expect(SelectionSchema.German.Standard.Lemma.Morpheme.Prefix).toBeDefined();
		expect(
			SelectionSchema.German.Typo.Lemma.Phraseme.DiscourseFormula,
		).toBeDefined();
		expect("Morpheme" in SelectionSchema.German.Standard.Inflection).toBe(
			false,
		);
		expect("Phraseme" in SelectionSchema.German.Standard.Partial).toBe(
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
				orthographicStatus: "Typo",
				surface: {
					lemma: {
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
				orthographicStatus: "Typo",
				surface: {
					lemma: {
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
});
