import { describe, expect, it } from "bun:test";
import {
	DeEnrichmentInputSchema,
	DeEnrichmentOutputSchema,
	DeFeaturesInputSchema,
	DeFeaturesOutputSchema,
	DeInflectionInputSchema,
	DeInflectionOutputSchema,
	DeLexicalTargetSchema,
	DeRelationInputSchema,
	DeRelationOutputSchema,
	DeWordTranslationInputSchema,
	DeWordTranslationOutputSchema,
} from "../../../src/lexical-generation/internal/contracts/de";

describe("De generate contracts", () => {
	it("accepts Lexem lexical target", () => {
		const result = DeLexicalTargetSchema.safeParse({
			lemma: "laufen",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Lemma",
		});

		expect(result.success).toBe(true);
	});

	it("accepts Phrasem lexical target", () => {
		const result = DeLexicalTargetSchema.safeParse({
			lemma: "auf jeden Fall",
			linguisticUnit: "Phrasem",
			posLikeKind: "DiscourseFormula",
			surfaceKind: "Lemma",
		});

		expect(result.success).toBe(true);
	});

	it("accepts enrichment input for Lexem", () => {
		const result = DeEnrichmentInputSchema.safeParse({
			context: "Er [läuft] heute schnell.",
			target: {
				lemma: "laufen",
				linguisticUnit: "Lexem",
				posLikeKind: "Verb",
				surfaceKind: "Lemma",
			},
		});

		expect(result.success).toBe(true);
	});

	it("accepts noun enrichment output with nounClass + genus", () => {
		const result = DeEnrichmentOutputSchema.safeParse({
			emojiDescription: ["🏠"],
			genus: "Neutrum",
			ipa: "haʊ̯s",
			linguisticUnit: "Lexem",
			nounClass: "Common",
			posLikeKind: "Noun",
		});

		expect(result.success).toBe(true);
	});

	it("accepts noun enrichment output without genus (best-effort metadata)", () => {
		const result = DeEnrichmentOutputSchema.safeParse({
			emojiDescription: ["🏠"],
			ipa: "haʊ̯s",
			linguisticUnit: "Lexem",
			nounClass: "Common",
			posLikeKind: "Noun",
		});

		expect(result.success).toBe(true);
	});

	it("accepts noun enrichment output without nounClass (best-effort metadata)", () => {
		const result = DeEnrichmentOutputSchema.safeParse({
			emojiDescription: ["🏠"],
			genus: "Neutrum",
			ipa: "haʊ̯s",
			linguisticUnit: "Lexem",
			posLikeKind: "Noun",
		});

		expect(result.success).toBe(true);
	});

	it("rejects non-noun enrichment output with noun fields", () => {
		const result = DeEnrichmentOutputSchema.safeParse({
			emojiDescription: ["🏃"],
			genus: "Maskulinum",
			ipa: "ˈlaʊ̯fn̩",
			linguisticUnit: "Lexem",
			nounClass: "Common",
			posLikeKind: "Verb",
		});

		expect(result.success).toBe(false);
	});

	it("accepts phrasem enrichment output", () => {
		const result = DeEnrichmentOutputSchema.safeParse({
			emojiDescription: ["✅"],
			ipa: "aʊ̯f ˈjeːdn̩ fal",
			linguisticUnit: "Phrasem",
			posLikeKind: "DiscourseFormula",
		});

		expect(result.success).toBe(true);
	});

	it("accepts relation input + output", () => {
		const input = DeRelationInputSchema.safeParse({
			context: "Das ist [gut].",
			target: {
				lemma: "gut",
				linguisticUnit: "Lexem",
				posLikeKind: "Adjective",
				surfaceKind: "Lemma",
			},
		});
		const output = DeRelationOutputSchema.safeParse({
			relations: [{ kind: "Synonym", words: ["prima", "toll"] }],
		});

		expect(input.success).toBe(true);
		expect(output.success).toBe(true);
	});

	it("accepts inflection input + output for Lexem", () => {
		const input = DeInflectionInputSchema.safeParse({
			context: "Das [Haus] ist alt.",
			target: {
				lemma: "Haus",
				linguisticUnit: "Lexem",
				posLikeKind: "Noun",
				surfaceKind: "Lemma",
			},
		});
		const output = DeInflectionOutputSchema.safeParse({
			rows: [{ forms: "[[Haus]], [[Häuser]]", label: "N" }],
		});

		expect(input.success).toBe(true);
		expect(output.success).toBe(true);
	});

	it("rejects inflection input for Phrasem", () => {
		const input = DeInflectionInputSchema.safeParse({
			context: "Das machen wir [auf jeden Fall].",
			target: {
				lemma: "auf jeden Fall",
				linguisticUnit: "Phrasem",
				posLikeKind: "DiscourseFormula",
				surfaceKind: "Lemma",
			},
		});

		expect(input.success).toBe(false);
	});

	it("accepts features input + output for Lexem", () => {
		const input = DeFeaturesInputSchema.safeParse({
			context: "Er [läuft] schnell.",
			target: {
				lemma: "laufen",
				linguisticUnit: "Lexem",
				posLikeKind: "Verb",
				surfaceKind: "Lemma",
			},
		});
		const output = DeFeaturesOutputSchema.safeParse({
			tags: ["transitiv", "stark"],
		});

		expect(input.success).toBe(true);
		expect(output.success).toBe(true);
	});

	it("accepts structured verb features output", () => {
		const output = DeFeaturesOutputSchema.safeParse({
			conjugation: "Regular",
			valency: {
				reflexivity: "NonReflexive",
				separability: "Separable",
			},
		});

		expect(output.success).toBe(true);
	});

	it("rejects features input for Phrasem", () => {
		const input = DeFeaturesInputSchema.safeParse({
			context: "Das ist [auf jeden Fall] klar.",
			target: {
				lemma: "auf jeden Fall",
				linguisticUnit: "Phrasem",
				posLikeKind: "DiscourseFormula",
				surfaceKind: "Lemma",
			},
		});

		expect(input.success).toBe(false);
	});

	it("accepts word translation input + output", () => {
		const input = DeWordTranslationInputSchema.safeParse({
			context: "Das machen wir [auf jeden Fall].",
			target: {
				lemma: "auf jeden Fall",
				linguisticUnit: "Phrasem",
				posLikeKind: "DiscourseFormula",
				surfaceKind: "Lemma",
			},
		});
		const output = DeWordTranslationOutputSchema.safeParse("in any case");

		expect(input.success).toBe(true);
		expect(output.success).toBe(true);
	});
});
