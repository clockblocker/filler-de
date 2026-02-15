import { describe, expect, it } from "bun:test";
import { GermanLinguisticUnitSchema } from "../../../src/linguistics/de";

describe("GermanLinguisticUnitSchema", () => {
	describe("Lexem + Noun", () => {
		it("parses Lemma with full features", () => {
			const result = GermanLinguisticUnitSchema.safeParse({
				kind: "Lexem",
				surface: {
					features: {
						genus: "Neutrum",
						nounClass: "Common",
						pos: "Noun",
					},
					lemma: "Haus",
					surfaceKind: "Lemma",
				},
			});
			expect(result.success).toBe(true);
		});

		it("parses Inflected with ref features", () => {
			const result = GermanLinguisticUnitSchema.safeParse({
				kind: "Lexem",
				surface: {
					features: { pos: "Noun" },
					lemma: "Haus",
					lemmaRef: "l-nom-n-m1",
					surface: "Häuser",
					surfaceKind: "Inflected",
				},
			});
			expect(result.success).toBe(true);
		});

		it("parses Variant with ref features", () => {
			const result = GermanLinguisticUnitSchema.safeParse({
				kind: "Lexem",
				surface: {
					features: { pos: "Noun" },
					lemma: "Haus",
					lemmaRef: "l-nom-n-m1",
					surface: "Hauß",
					surfaceKind: "Variant",
				},
			});
			expect(result.success).toBe(true);
		});

		it("rejects Noun Lemma without genus", () => {
			const result = GermanLinguisticUnitSchema.safeParse({
				kind: "Lexem",
				surface: {
					features: { nounClass: "Common", pos: "Noun" },
					lemma: "Haus",
					surfaceKind: "Lemma",
				},
			});
			expect(result.success).toBe(false);
		});

		it("rejects invalid genus value", () => {
			const result = GermanLinguisticUnitSchema.safeParse({
				kind: "Lexem",
				surface: {
					features: {
						genus: "Neuter",
						nounClass: "Common",
						pos: "Noun",
					},
					lemma: "Haus",
					surfaceKind: "Lemma",
				},
			});
			expect(result.success).toBe(false);
		});
	});

	describe("Phrasem", () => {
		it("parses Lemma with collocation features", () => {
			const result = GermanLinguisticUnitSchema.safeParse({
				kind: "Phrasem",
				surface: {
					features: {
						collocationType: "VerbNoun",
						phrasemeKind: "Collocation",
						strength: "Bound",
					},
					lemma: "eine Entscheidung treffen",
					surfaceKind: "Lemma",
				},
			});
			expect(result.success).toBe(true);
		});

		it("parses DiscourseFormula with role", () => {
			const result = GermanLinguisticUnitSchema.safeParse({
				kind: "Phrasem",
				surface: {
					features: {
						phrasemeKind: "DiscourseFormula",
						role: "Greeting",
					},
					lemma: "guten Tag",
					surfaceKind: "Lemma",
				},
			});
			expect(result.success).toBe(true);
		});

		it("rejects legacy collocation strength values", () => {
			const result = GermanLinguisticUnitSchema.safeParse({
				kind: "Phrasem",
				surface: {
					features: {
						phrasemeKind: "Collocation",
						strength: "Strong",
					},
					lemma: "starker Kaffee",
					surfaceKind: "Lemma",
				},
			});
			expect(result.success).toBe(false);
		});
	});

	describe("rejection", () => {
		it("rejects unknown kind", () => {
			const result = GermanLinguisticUnitSchema.safeParse({
				kind: "Unknown",
				surface: {
					features: { pos: "Noun" },
					lemma: "test",
					surfaceKind: "Lemma",
				},
			});
			expect(result.success).toBe(false);
		});

		it("rejects missing surface", () => {
			const result = GermanLinguisticUnitSchema.safeParse({
				kind: "Lexem",
			});
			expect(result.success).toBe(false);
		});
	});
});
