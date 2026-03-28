import { describe, expect, it } from "bun:test";
import { DeLemmaResultSchema } from "../../src/internal/contracts/de";

describe("DeLemmaResultSchema", () => {
	it("accepts Lexem + Verb", () => {
		const result = DeLemmaResultSchema.safeParse({
			contextWithLinkedParts: "Sie laufen.",
			lemma: "run",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Inflected",
		});

		expect(result.success).toBe(true);
	});

	it("accepts Phrasem + Idiom", () => {
		const result = DeLemmaResultSchema.safeParse({
			contextWithLinkedParts: "Mit den Wölfen heulen.",
			lemma: "mit Wölfen heulen",
			linguisticUnit: "Phrasem",
			posLikeKind: "Idiom",
			surfaceKind: "Lemma",
		});

		expect(result.success).toBe(true);
	});

	it("rejects legacy Lexem `pos` alias", () => {
		const result = DeLemmaResultSchema.safeParse({
			contextWithLinkedParts: "Haus",
			lemma: "Haus",
			linguisticUnit: "Lexem",
			pos: "Noun",
			surfaceKind: "Lemma",
		});

		expect(result.success).toBe(false);
	});

	it("rejects legacy Phrasem `phrasemeKind` alias", () => {
		const result = DeLemmaResultSchema.safeParse({
			contextWithLinkedParts: "Auf jeden Fall komme ich mit.",
			lemma: "auf jeden Fall",
			linguisticUnit: "Phrasem",
			phrasemeKind: "DiscourseFormula",
			surfaceKind: "Lemma",
		});

		expect(result.success).toBe(false);
	});

	it("rejects Morphem", () => {
		const result = DeLemmaResultSchema.safeParse({
			contextWithLinkedParts: "auf-",
			lemma: "auf-",
			linguisticUnit: "Morphem",
			posLikeKind: "Prefix",
			surfaceKind: "Lemma",
		});

		expect(result.success).toBe(false);
	});

	it("rejects Lexem + PhrasemeKind", () => {
		const result = DeLemmaResultSchema.safeParse({
			contextWithLinkedParts: "Sie laufen.",
			lemma: "run",
			linguisticUnit: "Lexem",
			posLikeKind: "Idiom",
			surfaceKind: "Lemma",
		});

		expect(result.success).toBe(false);
	});

	it("rejects Phrasem + POS", () => {
		const result = DeLemmaResultSchema.safeParse({
			contextWithLinkedParts: "Mit den Wölfen heulen.",
			lemma: "mit Wölfen heulen",
			linguisticUnit: "Phrasem",
			posLikeKind: "Verb",
			surfaceKind: "Lemma",
		});

		expect(result.success).toBe(false);
	});

	it("accepts required contextWithLinkedParts", () => {
		const result = DeLemmaResultSchema.safeParse({
			contextWithLinkedParts: "[Pass] auf dich [auf]",
			lemma: "aufpassen",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Inflected",
		});

		expect(result.success).toBe(true);
	});

	it("rejects missing contextWithLinkedParts", () => {
		const result = DeLemmaResultSchema.safeParse({
			lemma: "aufpassen",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Inflected",
		});

		expect(result.success).toBe(false);
	});
});
