import { describe, expect, test } from "bun:test";
import { splitStrInBlocks } from "../../../../src/commanders/librarian/bookkeeper/segmenter/block-marker/split-str-in-blocks";
import {
	ASCHENPUTTEL_FIRST_TWO_PARAGRAPHS,
	EXPECTED_BLOCK_OUTPUT_WITH_PARAGRAPHS,
} from "./testcases/aschenputtel";
import { EXTRA_E2_CONTENT } from "./testcases/extra-e2";

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

	test("headings without space after hashes are detected", () => {
		const text = `###### **ANNA:**
Groß, schlank .. ein cooler Amerikaner.`;

		const result = splitStrInBlocks(text);

		// Heading should NOT be merged into content
		expect(result.markedText).not.toContain("###### **ANNA:**Groß");
		// Heading should be on its own line
		expect(result.markedText).toContain("###### **ANNA:**\n");
		// Content should have block marker
		expect(result.markedText).toContain("Groß, schlank .. ein cooler Amerikaner. ^0");
	});

	test("EXTRA_E2_CONTENT: headings preserved as metadata", () => {
		const result = splitStrInBlocks(EXTRA_E2_CONTENT);

		// Should have many blocks (one per dialogue)
		expect(result.blockCount).toBeGreaterThan(10);

		// Headings should NOT be merged with content (no space/text directly after **)
		expect(result.markedText).not.toMatch(/###### \*\*ANNA:\*\*[^\n]/);
		expect(result.markedText).not.toMatch(/###### \*\*SAM:\*\*[^\n]/);

		// Each heading should be followed by newline (heading ends at **)
		expect(result.markedText).toMatch(/###### \*\*ANNA:\*\*\n/);
		expect(result.markedText).toMatch(/###### \*\*SAM:\*\*\n/);
		expect(result.markedText).toMatch(/###### \*\*SASCHA:\*\*\n/);
		expect(result.markedText).toMatch(/###### \*\*NIC:\*\*\n/);

		// Block markers should be on content, not headings
		const lines = result.markedText.split("\n");
		for (const line of lines) {
			// Heading lines should NOT have block markers
			if (line.startsWith("######")) {
				expect(line).not.toMatch(/\^\d+$/);
			}
		}
	});

	test("lone asterisk from italics merges with previous content", () => {
		// When italics span multiple sentences, the segmenter may split them
		// and create an orphaned closing asterisk as its own "sentence"
		// e.g., "*First sentence.* *Second sentence.*" could segment with orphaned "*"
		// We simulate this by checking that lone asterisks don't get their own block
		const text = `*Sie haben einen Nachbarn - Nic.*`;
		const result = splitStrInBlocks(text);
		expect(result.blockCount).toBe(1);
		// The asterisk should be part of the content, not a separate block
		expect(result.markedText).toContain("Nic.*");
	});

	test("orphaned markdown markers merge with previous sentence", () => {
		// Text where a lone * or ** might be segmented separately
		const text = `Das ist *wichtig* für uns.`;
		const result = splitStrInBlocks(text);
		expect(result.blockCount).toBe(1);
	});

	test("horizontal rule preserved without block ID", () => {
		const text = `Content before this rule.\n\n---\n\nContent after the rule.`;
		const result = splitStrInBlocks(text);
		expect(result.markedText).toContain("---");
		// HR should NOT have a block marker
		expect(result.markedText).not.toMatch(/---\s*\^\d+/);
		// Should have 2 content blocks
		expect(result.blockCount).toBe(2);
	});

	test("horizontal rule with asterisks preserved without block ID", () => {
		const text = `Before.\n\n***\n\nAfter.`;
		const result = splitStrInBlocks(text);
		expect(result.markedText).toContain("***");
		expect(result.markedText).not.toMatch(/\*\*\*\s*\^\d+/);
		expect(result.blockCount).toBe(2);
	});

	test("horizontal rule with underscores preserved without block ID", () => {
		const text = `Before.\n\n___\n\nAfter.`;
		const result = splitStrInBlocks(text);
		expect(result.markedText).toContain("___");
		expect(result.markedText).not.toMatch(/___\s*\^\d+/);
		expect(result.blockCount).toBe(2);
	});

	test("multiple horizontal rules are all preserved", () => {
		const text = `First.\n\n---\n\nSecond.\n\n***\n\nThird.`;
		const result = splitStrInBlocks(text);
		expect(result.markedText).toContain("---");
		expect(result.markedText).toContain("***");
		expect(result.blockCount).toBe(3);
	});

	describe("decoration stripping and restoration", () => {
		describe("italics (*)", () => {
			test("splits sentences inside italics and wraps each", () => {
				const text = `*Das ist die Geschichte von Sascha und Anna aus Berlin. Sie wohnen zusammen in Berlin.*`;
				const result = splitStrInBlocks(text);
				expect(result.blockCount).toBe(2);
				// Each sentence should have its own complete *...* wrapper
				expect(result.markedText).toMatch(
					/\*Das ist die Geschichte von Sascha und Anna aus Berlin\.\*/,
				);
				expect(result.markedText).toMatch(/\*Sie wohnen zusammen in Berlin\.\*/);
			});

			test("handles three sentences inside italics", () => {
				const text = `*First sentence here. Second sentence here. Third sentence here.*`;
				const result = splitStrInBlocks(text);
				// Sentences in same block get merged decorations: *a.* *b.* → *a. b.*
				// Short sentences may merge into same block
				expect(result.markedText).toContain("*First sentence here.");
				expect(result.markedText).toContain("Third sentence here.*");
			});

			test("preserves already-balanced italics", () => {
				const text = `*This is complete.* Normal text here.`;
				const result = splitStrInBlocks(text);
				expect(result.markedText).toContain("*This is complete.*");
				// Normal text should not have asterisks
				expect(result.markedText).toMatch(/Normal text here\./);
			});

			test("mixed italics and normal text", () => {
				const text = `Normal start. *Italics sentence one. Italics sentence two.* Normal end.`;
				const result = splitStrInBlocks(text);
				// Each italics sentence should have *...* wrapper
				expect(result.markedText).toMatch(/\*Italics sentence one\.\*/);
				expect(result.markedText).toMatch(/\*Italics sentence two\.\*/);
				// Normal text should NOT be wrapped in italics
				expect(result.markedText).not.toMatch(/\*Normal start\./);
				expect(result.markedText).not.toMatch(/Normal end\.\*/);
			});
		});

		describe("bold (**)", () => {
			test("single bold sentence unchanged", () => {
				const text = `**This is bold text here.**`;
				const result = splitStrInBlocks(text);
				expect(result.blockCount).toBe(1);
				expect(result.markedText).toContain("**This is bold text here.**");
			});

			test("bold: each sentence gets own wrapper", () => {
				const text = `**Bold sentence one is here. Bold sentence two is here.**`;
				const result = splitStrInBlocks(text);
				expect(result.markedText).toMatch(/\*\*Bold sentence one is here\.\*\*/);
				expect(result.markedText).toMatch(/\*\*Bold sentence two is here\.\*\*/);
			});
		});

		describe("strikethrough (~~)", () => {
			test("strikethrough: merged when sentences in same block", () => {
				const text = `~~Strike sentence one here. Strike sentence two here.~~`;
				const result = splitStrInBlocks(text);
				// Sentences in same block get merged decorations: ~~a.~~ ~~b.~~ → ~~a. b.~~
				expect(result.markedText).toContain("~~Strike sentence one here.");
				expect(result.markedText).toContain("Strike sentence two here.~~");
			});
		});

		describe("highlight (==)", () => {
			test("highlight: merged when sentences in same block", () => {
				const text = `==Highlight sentence one. Highlight sentence two.==`;
				const result = splitStrInBlocks(text);
				// Sentences in same block get merged decorations: ==a.== ==b.== → ==a. b.==
				expect(result.markedText).toContain("==Highlight sentence one.");
				expect(result.markedText).toContain("Highlight sentence two.==");
			});
		});

		describe("nested decorations", () => {
			test("nested decorations: outer stripped, inner preserved", () => {
				const text = `*Text with **bold** inside here.*`;
				const result = splitStrInBlocks(text);
				expect(result.markedText).toContain("**bold**");
				// The outer italics should wrap the sentence
				expect(result.markedText).toMatch(
					/\*Text with \*\*bold\*\* inside here\.\*/,
				);
			});
		});

		describe("consecutive spans", () => {
			test("consecutive balanced spans with whitespace gap are merged in same block", () => {
				const text = `*First sentence here.*
*Second sentence here.*
*Third sentence here.*`;
				const result = splitStrInBlocks(text);
				// Sentences in same block get merged decorations: *a.* *b.* → *a. b.*
				// At least some should be merged (depends on block grouping)
				expect(result.markedText).toContain("*First sentence here.");
				expect(result.markedText).toContain("Third sentence here.*");
			});

			test("consecutive with paragraph gap - separate regions", () => {
				const text = `*Italic region one.*

Plain text paragraph.

*Italic region two.*`;
				const result = splitStrInBlocks(text);
				expect(result.markedText).toMatch(/\*Italic region one\.\*/);
				expect(result.markedText).not.toMatch(/\*Plain text/);
				expect(result.markedText).toMatch(/\*Italic region two\.\*/);
			});

			test("handles multiple italicized lines (merged within block, separated across paragraphs)", () => {
				const text = `*First line sentence one. First line sentence two.*

*Second line has one sentence.*`;
				const result = splitStrInBlocks(text);
				// Sentences in same block get merged: *a.* *b.* → *a. b.*
				// But paragraph breaks force new blocks
				expect(result.markedText).toContain("*First line sentence one.");
				expect(result.markedText).toContain("sentence two.*");
				expect(result.markedText).toMatch(/\*Second line has one sentence\.\*/);
				// Should have paragraph break between the two italicized lines
				expect(result.blockCount).toBeGreaterThanOrEqual(2);
			});
		});

		describe("edge cases", () => {
			test("inline decoration in the middle of sentence unchanged", () => {
				// Decoration that doesn't span multiple sentences should stay as-is
				const text = `Das ist *wichtig* für uns.`;
				const result = splitStrInBlocks(text);
				expect(result.blockCount).toBe(1);
				expect(result.markedText).toContain("*wichtig*");
			});

			test("mixed decorated and plain text in complex order", () => {
				const text = `Plain one. *Italic one. Italic two.* Plain two.`;
				const result = splitStrInBlocks(text);
				// Italics should be wrapped
				expect(result.markedText).toMatch(/\*Italic one\.\*/);
				expect(result.markedText).toMatch(/\*Italic two\.\*/);
				// Plain should not be wrapped
				expect(result.markedText).not.toMatch(/\*Plain one/);
				expect(result.markedText).not.toMatch(/Plain two\.\*/);
			});
		});
	});
});
