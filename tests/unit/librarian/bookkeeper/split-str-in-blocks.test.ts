import { describe, expect, test } from "bun:test";
import { splitStrInBlocks } from "../../../../src/commanders/librarian/bookkeeper/segmenter/block-marker";
import {
	ASCHENPUTTEL_FIRST_TWO_PARAGRAPHS,
	EXPECTED_BLOCK_OUTPUT_WITH_PARAGRAPHS,
} from "./testcases/aschenputtel";

describe("splitStrInBlocks", () => {
	test("empty text returns empty result", () => {
		const result = splitStrInBlocks("");
		expect(result.markedText).toBe("");
		expect(result.blockCount).toBe(0);
	});

	test("whitespace-only text returns empty result", () => {
		const result = splitStrInBlocks("   \n\n   ");
		expect(result.markedText).toBe("");
		expect(result.blockCount).toBe(0);
	});

	test("single sentence gets block marker", () => {
		const result = splitStrInBlocks("Dies ist ein einfacher Satz.");
		expect(result.markedText).toBe("Dies ist ein einfacher Satz. ^0");
		expect(result.blockCount).toBe(1);
	});

	test("starts from custom index", () => {
		const result = splitStrInBlocks("Ein Satz.", 5);
		expect(result.markedText).toBe("Ein Satz. ^5");
		expect(result.blockCount).toBe(1);
	});

	test("short sentence (≤4 words) merges with next in same paragraph", () => {
		// "Das ist gut." is short (3 words ≤ 4)
		// It should merge with the next sentence in same paragraph
		const text = "Das ist gut. Das Mädchen ging jeden Tag hinaus.";
		const result = splitStrInBlocks(text);

		expect(result.blockCount).toBe(1);
		expect(result.markedText).toContain("^0");
		expect(result.markedText).toContain("Das Mädchen ging");
	});

	test("long sentence (>4 words) does not merge", () => {
		// "Darauf tat sie die Augen zu und verschied." is NOT short (8 words > 4)
		// It should NOT merge - each sentence gets own block
		const text =
			"Darauf tat sie die Augen zu und verschied. Das Mädchen ging jeden Tag hinaus.";
		const result = splitStrInBlocks(text);

		expect(result.blockCount).toBe(2);
	});

	test("direct speech stays in one block", () => {
		const text = `„Liebes Kind, bleibe fromm und gut, so wird dir der liebe Gott immer beistehen."`;
		const result = splitStrInBlocks(text);

		expect(result.blockCount).toBe(1);
		expect(result.markedText).toContain("Liebes Kind");
		expect(result.markedText).toContain("beistehen.");
	});

	test("short speech intro merges with following quote", () => {
		// "sprach er:" is short intro (2 words)
		const text = `Da sprach er: „Komm mit mir!"`;
		const result = splitStrInBlocks(text);

		expect(result.blockCount).toBe(1);
		expect(result.markedText).toContain("sprach er:");
		expect(result.markedText).toContain("Komm mit mir!");
	});

	test("intro with quote is one block (segmenter limitation)", () => {
		// Note: Intl.Segmenter treats "intro: quote" as one sentence
		// So the block marker cannot split them without modifying sentence segmentation
		const text = `Einem reichen Manne wurde seine Frau krank und er sprach: „Ich liebe dich." Sie lächelte.`;
		const result = splitStrInBlocks(text);

		// Intro+quote is one sentence, "Sie lächelte" is another (short, merges backward)
		// Result: 1 block containing everything
		expect(result.blockCount).toBe(1);
	});

	test("multiple paragraphs get separate blocks", () => {
		const text = `Erster Absatz.\n\nZweiter Absatz.`;
		const result = splitStrInBlocks(text);

		expect(result.blockCount).toBe(2);
		expect(result.markedText).toContain("^0");
		expect(result.markedText).toContain("^1");
	});

	test("never merges across paragraph boundaries", () => {
		// Even short sentence should not merge across paragraphs
		const text = `Ein Satz.\n\nKurz. Noch einer.`;
		const result = splitStrInBlocks(text);

		// First paragraph = 1 block, second paragraph = potentially merged
		expect(result.blockCount).toBeGreaterThanOrEqual(2);
	});

	test("merged blocks do not exceed max word limit", () => {
		// Create 12 short sentences (12 words total), limit is 10
		// Should split: first block ~10 words, second block ~2 words
		const text = `Kurz. Kurz. Kurz. Kurz. Kurz. Kurz. Kurz. Kurz. Kurz. Kurz. Kurz. Kurz.`;
		const result = splitStrInBlocks(text, 0, { maxMergedWords: 10 });

		// With 12 words and limit 10, should split into 2 blocks
		expect(result.blockCount).toBeGreaterThan(1);
	});

	test("Aschenputtel opening paragraph", () => {
		const text = `Einem reichen Manne, dem wurde seine Frau krank, und als sie fühlte, daß ihr Ende herankam, rief sie ihr einziges Töchterlein zu sich ans Bett und sprach:

„Liebes Kind, bleibe fromm und gut, so wird dir der liebe Gott immer beistehen, und ich will vom Himmel auf dich herabblicken, und will um dich sein." Darauf tat sie die Augen zu und verschied. Das Mädchen ging jeden Tag hinaus zu dem Grabe der Mutter und weinte, und blieb fromm und gut.`;

		const result = splitStrInBlocks(text);

		// Should have multiple blocks
		expect(result.blockCount).toBeGreaterThan(1);

		// First block: long intro with ":"
		expect(result.markedText).toContain("rief sie ihr einziges Töchterlein");

		// Direct speech should be together
		expect(result.markedText).toContain("Liebes Kind");
		expect(result.markedText).toContain("um dich sein.");
	});

	test("paragraph breaks are preserved with extra blank lines", () => {
		const result = splitStrInBlocks(ASCHENPUTTEL_FIRST_TWO_PARAGRAPHS);

		// Should match the expected output exactly
		expect(result.markedText).toBe(EXPECTED_BLOCK_OUTPUT_WITH_PARAGRAPHS);
	});

	test("paragraph break creates 4 newlines between blocks", () => {
		// Simple test with two paragraphs
		const text = `Erster Satz ist lang genug. Zweiter Satz ist auch lang.

Dritter Satz nach Absatz. Vierter Satz hier auch.`;

		const result = splitStrInBlocks(text);

		// Should have 4 newlines (3 blank lines) between paragraphs
		expect(result.markedText).toContain("^1\n\n\n\n");
	});
});
