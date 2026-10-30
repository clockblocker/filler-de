import { describe, expect, test } from "bun:test";
import { splitStrInSentenceBlocks } from "../../../../src/commanders/librarian/pages/segmenter/block-marker/split-str-in-sentence-blocks";
import {
	ASCHENPUTTEL_FIRST_TWO_PARAGRAPHS,
	EXPECTED_BLOCK_OUTPUT_WITH_PARAGRAPHS,
} from "./testcases/aschenputtel";
import { EXTRA_E2_CONTENT } from "./testcases/extra-e2";

describe("splitStrInSentenceBlocks", () => {
	test("empty text returns empty result", () => {
		const result = splitStrInSentenceBlocks("");
		expect(result.markedText).toBe("");
		expect(result.blockCount).toBe(0);
	});

	test("whitespace-only text returns empty result", () => {
		const result = splitStrInSentenceBlocks("   \n\n   ");
		expect(result.markedText).toBe("");
		expect(result.blockCount).toBe(0);
	});

	test("single sentence gets block marker", () => {
		const result = splitStrInSentenceBlocks("Dies ist ein einfacher Satz.");
		expect(result.markedText).toBe("Dies ist ein einfacher Satz. ^0");
		expect(result.blockCount).toBe(1);
	});

	test("starts from custom index", () => {
		const result = splitStrInSentenceBlocks("Ein Satz.", 5);
		expect(result.markedText).toBe("Ein Satz. ^5");
		expect(result.blockCount).toBe(1);
	});

	test("a short sentence gets a block of its own", () => {
		const text = "Das ist gut. Das Mädchen ging jeden Tag hinaus.";
		const result = splitStrInSentenceBlocks(text);

		expect(result.blockCount).toBe(2);
		expect(result.markedText).toBe(
			"Das ist gut. ^0\n\nDas Mädchen ging jeden Tag hinaus. ^1",
		);
	});

	test("every sentence gets a block of its own", () => {
		const text =
			"Darauf tat sie die Augen zu und verschied. Das Mädchen ging jeden Tag hinaus.";
		const result = splitStrInSentenceBlocks(text);

		expect(result.blockCount).toBe(2);
	});

	test("one-word sentences are never grouped", () => {
		const result = splitStrInSentenceBlocks("Kurz. Kurz. Kurz.");
		expect(result.markedText).toBe("Kurz. ^0\n\nKurz. ^1\n\nKurz. ^2");
	});

	test("a one-sentence quote is one block", () => {
		const text = `„Liebes Kind, bleibe fromm und gut, so wird dir der liebe Gott immer beistehen."`;
		const result = splitStrInSentenceBlocks(text);

		expect(result.blockCount).toBe(1);
		expect(result.markedText).toContain("Liebes Kind");
		expect(result.markedText).toContain("beistehen.");
	});

	test("a speech intro and its quote that dumgen reads as one sentence are one block", () => {
		const text = `Da sprach er: „Komm mit mir!"`;
		const result = splitStrInSentenceBlocks(text);

		expect(result.blockCount).toBe(1);
		expect(result.markedText).toContain("sprach er:");
		expect(result.markedText).toContain("Komm mit mir!");
	});

	test("the sentence after an intro with its quote gets a block of its own", () => {
		// dumgen's splitText reads "intro: quote" as one sentence
		const text = `Einem reichen Manne wurde seine Frau krank und er sprach: „Ich liebe dich." Sie lächelte.`;
		const result = splitStrInSentenceBlocks(text);

		expect(result.markedText).toBe(
			`Einem reichen Manne wurde seine Frau krank und er sprach: „Ich liebe dich." ^0\n\nSie lächelte. ^1`,
		);
	});

	test("direct speech of several sentences is cut at each sentence", () => {
		const text = "Er sagte: „Ich komme. Warte!“ Dann ging er.";
		expect(splitStrInSentenceBlocks(text).markedText).toBe(
			"Er sagte: „Ich komme. ^0\n\nWarte!“ ^1\n\nDann ging er. ^2",
		);
	});

	test("multiple paragraphs get separate blocks", () => {
		const text = `Erster Absatz.\n\nZweiter Absatz.`;
		const result = splitStrInSentenceBlocks(text);

		expect(result.blockCount).toBe(2);
		expect(result.markedText).toContain("^0");
		expect(result.markedText).toContain("^1");
	});

	test("paragraphs keep their wider gap between sentence blocks", () => {
		const text = `Ein Satz.\n\nKurz. Noch einer.`;
		const result = splitStrInSentenceBlocks(text);

		expect(result.markedText).toBe(
			"Ein Satz. ^0\n\n\n\nKurz. ^1\n\nNoch einer. ^2",
		);
	});

	test("verse keeps its line breaks inside each sentence", () => {
		const text = "Rose rot,\nVeilchen blau.\nZucker süß,\nund du auch.";
		expect(splitStrInSentenceBlocks(text).markedText).toBe(
			"Rose rot,\nVeilchen blau. ^0\n\nZucker süß,\nund du auch. ^1",
		);
	});

	test("a footnote reference stays with the sentence it follows", () => {
		expect(
			splitStrInSentenceBlocks("Er ging nach Hause.[^1] Sie blieb dort.")
				.markedText,
		).toBe("Er ging nach Hause.[^1] ^0\n\nSie blieb dort. ^1");
		expect(
			splitStrInSentenceBlocks("Er ging nach Hause[^n]. Sie blieb dort.")
				.markedText,
		).toBe("Er ging nach Hause[^n]. ^0\n\nSie blieb dort. ^1");
	});

	test("links are kept whole", () => {
		const text =
			"Er kam [[Worter/de/x|nach Hause. Dann]] weiter. Sie blieb [hier. Dort](https://x.de/a.b). Ende.";
		expect(splitStrInSentenceBlocks(text).markedText).toBe(
			"Er kam [[Worter/de/x|nach Hause. Dann]] weiter. ^0\n\nSie blieb [hier. Dort](https://x.de/a.b). ^1\n\nEnde. ^2",
		);
	});

	test("Aschenputtel opening paragraph", () => {
		const text = `Einem reichen Manne, dem wurde seine Frau krank, und als sie fühlte, daß ihr Ende herankam, rief sie ihr einziges Töchterlein zu sich ans Bett und sprach:

„Liebes Kind, bleibe fromm und gut, so wird dir der liebe Gott immer beistehen, und ich will vom Himmel auf dich herabblicken, und will um dich sein." Darauf tat sie die Augen zu und verschied. Das Mädchen ging jeden Tag hinaus zu dem Grabe der Mutter und weinte, und blieb fromm und gut.`;

		const result = splitStrInSentenceBlocks(text);

		// Should have multiple blocks
		expect(result.blockCount).toBeGreaterThan(1);

		// First block: long intro with ":"
		expect(result.markedText).toContain("rief sie ihr einziges Töchterlein");

		// Direct speech should be together
		expect(result.markedText).toContain("Liebes Kind");
		expect(result.markedText).toContain("um dich sein.");
	});

	test("paragraph breaks are preserved with extra blank lines", () => {
		const result = splitStrInSentenceBlocks(ASCHENPUTTEL_FIRST_TWO_PARAGRAPHS);

		// Should match the expected output exactly
		expect(result.markedText).toBe(EXPECTED_BLOCK_OUTPUT_WITH_PARAGRAPHS);
	});

	test("paragraph break creates 4 newlines between blocks", () => {
		// Simple test with two paragraphs
		const text = `Erster Satz ist lang genug. Zweiter Satz ist auch lang.

Dritter Satz nach Absatz. Vierter Satz hier auch.`;

		const result = splitStrInSentenceBlocks(text);

		// Should have 4 newlines (3 blank lines) between paragraphs
		expect(result.markedText).toContain("^1\n\n\n\n");
	});

	test("a heading without blank lines around it still ends the text before it", () => {
		// dumgen joins a hard-wrapped line with the next, so the removed
		// heading must leave a boundary behind.
		const text =
			"Dies ist eine lange Zeile ohne einen Punkt am Ende\n## Kapitel\nDer Mann ging heim. Er schlief.";

		const result = splitStrInSentenceBlocks(text);

		expect(result.markedText).toBe(
			"Dies ist eine lange Zeile ohne einen Punkt am Ende ^0\n\n\n\n## Kapitel\nDer Mann ging heim. ^1\n\nEr schlief. ^2",
		);
	});

	test("headings without space after hashes are detected", () => {
		const text = `###### **ANNA:**
Groß, schlank .. ein cooler Amerikaner.`;

		const result = splitStrInSentenceBlocks(text);

		// Heading should NOT be merged into content
		expect(result.markedText).not.toContain("###### **ANNA:**Groß");
		// Heading should be on its own line
		expect(result.markedText).toContain("###### **ANNA:**\n");
		// Content should have block marker
		expect(result.markedText).toContain("Groß, schlank .. ein cooler Amerikaner. ^0");
	});

	test("EXTRA_E2_CONTENT: headings preserved as metadata", () => {
		const result = splitStrInSentenceBlocks(EXTRA_E2_CONTENT);

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
		const result = splitStrInSentenceBlocks(text);
		expect(result.blockCount).toBe(1);
		// The asterisk should be part of the content, not a separate block
		expect(result.markedText).toContain("Nic.*");
	});

	test("orphaned markdown markers merge with previous sentence", () => {
		// Text where a lone * or ** might be segmented separately
		const text = `Das ist *wichtig* für uns.`;
		const result = splitStrInSentenceBlocks(text);
		expect(result.blockCount).toBe(1);
	});

	test("horizontal rule preserved without block ID", () => {
		const text = `Content before this rule.\n\n---\n\nContent after the rule.`;
		const result = splitStrInSentenceBlocks(text);
		expect(result.markedText).toContain("---");
		// HR should NOT have a block marker
		expect(result.markedText).not.toMatch(/---\s*\^\d+/);
		// Should have 2 content blocks
		expect(result.blockCount).toBe(2);
	});

	test("horizontal rule with asterisks preserved without block ID", () => {
		const text = `Before.\n\n***\n\nAfter.`;
		const result = splitStrInSentenceBlocks(text);
		expect(result.markedText).toContain("***");
		expect(result.markedText).not.toMatch(/\*\*\*\s*\^\d+/);
		expect(result.blockCount).toBe(2);
	});

	test("horizontal rule with underscores preserved without block ID", () => {
		const text = `Before.\n\n___\n\nAfter.`;
		const result = splitStrInSentenceBlocks(text);
		expect(result.markedText).toContain("___");
		expect(result.markedText).not.toMatch(/___\s*\^\d+/);
		expect(result.blockCount).toBe(2);
	});

	test("multiple horizontal rules are all preserved", () => {
		const text = `First.\n\n---\n\nSecond.\n\n***\n\nThird.`;
		const result = splitStrInSentenceBlocks(text);
		expect(result.markedText).toContain("---");
		expect(result.markedText).toContain("***");
		expect(result.blockCount).toBe(3);
	});

	describe("decoration stripping and restoration", () => {
		describe("italics (*)", () => {
			test("splits sentences inside italics and wraps each", () => {
				const text = `*Das ist die Geschichte von Sascha und Anna aus Berlin. Sie wohnen zusammen in Berlin.*`;
				const result = splitStrInSentenceBlocks(text);
				expect(result.blockCount).toBe(2);
				// Each sentence should have its own complete *...* wrapper
				expect(result.markedText).toMatch(
					/\*Das ist die Geschichte von Sascha und Anna aus Berlin\.\*/,
				);
				expect(result.markedText).toMatch(/\*Sie wohnen zusammen in Berlin\.\*/);
			});

			test("handles three sentences inside italics", () => {
				const text = `*First sentence here. Second sentence here. Third sentence here.*`;
				const result = splitStrInSentenceBlocks(text);
				expect(result.markedText).toBe(
					"*First sentence here.* ^0\n\n*Second sentence here.* ^1\n\n*Third sentence here.* ^2",
				);
			});

			test("preserves already-balanced italics", () => {
				const text = `*This is complete.* Normal text here.`;
				const result = splitStrInSentenceBlocks(text);
				expect(result.markedText).toBe(
					"*This is complete.* ^0\n\nNormal text here. ^1",
				);
			});

			test("never closes italics a line opens and closes itself", () => {
				const text = "*Kursiv* und normal. Dann mehr.";
				expect(splitStrInSentenceBlocks(text).markedText).toBe(
					"*Kursiv* und normal. ^0\n\nDann mehr. ^1",
				);
			});

			test("mixed italics and normal text", () => {
				const text = `Normal start. *Italics sentence one. Italics sentence two.* Normal end.`;
				const result = splitStrInSentenceBlocks(text);
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
				const result = splitStrInSentenceBlocks(text);
				expect(result.blockCount).toBe(1);
				expect(result.markedText).toContain("**This is bold text here.**");
			});

			test("bold: each sentence gets own wrapper", () => {
				const text = `**Bold sentence one is here. Bold sentence two is here.**`;
				const result = splitStrInSentenceBlocks(text);
				expect(result.markedText).toMatch(/\*\*Bold sentence one is here\.\*\*/);
				expect(result.markedText).toMatch(/\*\*Bold sentence two is here\.\*\*/);
			});
		});

		describe("underscores (_, __)", () => {
			test("each sentence gets own wrapper", () => {
				expect(
					splitStrInSentenceBlocks("_Er kam. Sie ging._ Ende.").markedText,
				).toBe("_Er kam._ ^0\n\n_Sie ging._ ^1\n\nEnde. ^2");
				expect(
					splitStrInSentenceBlocks("Er kam. __Sie ging. Er lief.__ Ende.")
						.markedText,
				).toBe(
					"Er kam. ^0\n\n__Sie ging.__ ^1\n\n__Er lief.__ ^2\n\nEnde. ^3",
				);
			});

			test("an underscore inside a word is no emphasis", () => {
				expect(
					splitStrInSentenceBlocks("Die snake_case Form. Eine my_var Zeile.")
						.markedText,
				).toBe("Die snake_case Form. ^0\n\nEine my_var Zeile. ^1");
			});
		});

		describe("strikethrough (~~)", () => {
			test("strikethrough: each sentence gets own wrapper", () => {
				const text = `~~Strike sentence one here. Strike sentence two here.~~`;
				const result = splitStrInSentenceBlocks(text);
				expect(result.markedText).toBe(
					"~~Strike sentence one here.~~ ^0\n\n~~Strike sentence two here.~~ ^1",
				);
			});
		});

		describe("highlight (==)", () => {
			test("highlight: each sentence gets own wrapper", () => {
				const text = `==Highlight sentence one. Highlight sentence two.==`;
				const result = splitStrInSentenceBlocks(text);
				expect(result.markedText).toBe(
					"==Highlight sentence one.== ^0\n\n==Highlight sentence two.== ^1",
				);
			});
		});

		describe("nested decorations", () => {
			test("nested decorations: outer stripped, inner preserved", () => {
				const text = `*Text with **bold** inside here.*`;
				const result = splitStrInSentenceBlocks(text);
				expect(result.markedText).toContain("**bold**");
				// The outer italics should wrap the sentence
				expect(result.markedText).toMatch(
					/\*Text with \*\*bold\*\* inside here\.\*/,
				);
			});
		});

		describe("consecutive spans", () => {
			test("consecutive balanced spans each keep their wrapper", () => {
				const text = `*First sentence here.*
*Second sentence here.*
*Third sentence here.*`;
				const result = splitStrInSentenceBlocks(text);
				expect(result.markedText).toBe(
					"*First sentence here.* ^0\n\n*Second sentence here.* ^1\n\n*Third sentence here.* ^2",
				);
			});

			test("consecutive with paragraph gap - separate regions", () => {
				const text = `*Italic region one.*

Plain text paragraph.

*Italic region two.*`;
				const result = splitStrInSentenceBlocks(text);
				expect(result.markedText).toMatch(/\*Italic region one\.\*/);
				expect(result.markedText).not.toMatch(/\*Plain text/);
				expect(result.markedText).toMatch(/\*Italic region two\.\*/);
			});

			test("handles multiple italicized lines across paragraphs", () => {
				const text = `*First line sentence one. First line sentence two.*

*Second line has one sentence.*`;
				const result = splitStrInSentenceBlocks(text);
				expect(result.markedText).toBe(
					"*First line sentence one.* ^0\n\n*First line sentence two.* ^1\n\n\n\n*Second line has one sentence.* ^2",
				);
			});
		});

		describe("edge cases", () => {
			test("inline decoration in the middle of sentence unchanged", () => {
				// Decoration that doesn't span multiple sentences should stay as-is
				const text = `Das ist *wichtig* für uns.`;
				const result = splitStrInSentenceBlocks(text);
				expect(result.blockCount).toBe(1);
				expect(result.markedText).toContain("*wichtig*");
			});

			test("mixed decorated and plain text in complex order", () => {
				const text = `Plain one. *Italic one. Italic two.* Plain two.`;
				const result = splitStrInSentenceBlocks(text);
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
