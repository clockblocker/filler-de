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
