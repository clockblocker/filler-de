import { describe, expect, it } from "bun:test";
import { DeLemmaResultSchema } from "../../../src/linguistics/de/lemma";

describe("DeLemmaResultSchema", () => {
	it("accepts Lexem + Verb", () => {
		const result = DeLemmaResultSchema.safeParse({
			lemma: "run",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Inflected",
		});

		expect(result.success).toBe(true);
	});

	it("accepts Phrasem + Idiom", () => {
		const result = DeLemmaResultSchema.safeParse({
			lemma: "mit Wölfen heulen",
			linguisticUnit: "Phrasem",
			posLikeKind: "Idiom",
			surfaceKind: "Lemma",
		});

		expect(result.success).toBe(true);
	});

	it("rejects Morphem", () => {
		const result = DeLemmaResultSchema.safeParse({
			lemma: "auf-",
			linguisticUnit: "Morphem",
			posLikeKind: "Prefix",
			surfaceKind: "Lemma",
		});

		expect(result.success).toBe(false);
	});

	it("rejects Lexem + PhrasemeKind", () => {
		const result = DeLemmaResultSchema.safeParse({
			lemma: "run",
			linguisticUnit: "Lexem",
			posLikeKind: "Idiom",
			surfaceKind: "Lemma",
		});

		expect(result.success).toBe(false);
	});

	it("rejects Phrasem + POS", () => {
		const result = DeLemmaResultSchema.safeParse({
			lemma: "mit Wölfen heulen",
			linguisticUnit: "Phrasem",
			posLikeKind: "Verb",
			surfaceKind: "Lemma",
		});

		expect(result.success).toBe(false);
	});

	it("accepts optional contextWithLinkedParts", () => {
		const result = DeLemmaResultSchema.safeParse({
			contextWithLinkedParts: "[Pass] auf dich [auf]",
			lemma: "aufpassen",
			linguisticUnit: "Lexem",
			posLikeKind: "Verb",
			surfaceKind: "Inflected",
		});

		expect(result.success).toBe(true);
	});
});
