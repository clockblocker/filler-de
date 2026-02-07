import { describe, expect, it } from "bun:test";
import { GermanLinguisticUnitSchema } from "../../../src/linguistics/german/schemas/linguistic-unit";

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

	describe("Lexem POS stubs", () => {
		const stubPosValues = [
			"Pronoun",
			"Article",
			"Adjective",
			"Verb",
			"Preposition",
			"Adverb",
			"Particle",
			"Conjunction",
			"InteractionalUnit",
		];

		for (const pos of stubPosValues) {
			it(`parses ${pos} Lemma stub`, () => {
				const result = GermanLinguisticUnitSchema.safeParse({
					kind: "Lexem",
					surface: {
						features: { pos },
						lemma: "test",
						surfaceKind: "Lemma",
					},
				});
				expect(result.success).toBe(true);
			});
		}
	});

	describe("Phrasem", () => {
		it("parses Collocation with strength", () => {
			const result = GermanLinguisticUnitSchema.safeParse({
				kind: "Phrasem",
				surface: {
					features: {
						phrasemeKind: "Collocation",
						strength: "Strong",
					},
					lemma: "in Betracht ziehen",
					surfaceKind: "Lemma",
				},
			});
			expect(result.success).toBe(true);
		});

		it("parses Collocation without strength", () => {
			const result = GermanLinguisticUnitSchema.safeParse({
				kind: "Phrasem",
				surface: {
					features: { phrasemeKind: "Collocation" },
					lemma: "in Betracht ziehen",
					surfaceKind: "Lemma",
				},
			});
			expect(result.success).toBe(true);
		});

		it("parses Idiom stub", () => {
			const result = GermanLinguisticUnitSchema.safeParse({
				kind: "Phrasem",
				surface: {
					features: { phrasemeKind: "Idiom" },
					lemma: "ins Gras beißen",
					surfaceKind: "Lemma",
				},
			});
			expect(result.success).toBe(true);
		});
	});

	describe("Morphem", () => {
		it("parses Prefix with separability", () => {
			const result = GermanLinguisticUnitSchema.safeParse({
				kind: "Morphem",
				surface: {
					features: {
						morphemeKind: "Prefix",
						separability: "Separable",
					},
					lemma: "auf-",
					surfaceKind: "Lemma",
				},
			});
			expect(result.success).toBe(true);
		});

		it("parses Root stub", () => {
			const result = GermanLinguisticUnitSchema.safeParse({
				kind: "Morphem",
				surface: {
					features: { morphemeKind: "Root" },
					lemma: "-sprech-",
					surfaceKind: "Lemma",
				},
			});
			expect(result.success).toBe(true);
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
