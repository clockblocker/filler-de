import { describe, expect, it } from "bun:test";
import { pageNumberFromInt } from "../../../../src/commanders/librarian/indexing/codecs";
import { splitTextIntoPages } from "../../../../src/commanders/librarian/text-splitter/text-splitter";

describe("TextSplitter", () => {
	describe("splitTextIntoPages", () => {
		const textName = "TestText";

		it("should return single page for short text (scroll)", () => {
			const content = "This is a short text. It has just two sentences.";
			const result = splitTextIntoPages(content, textName, 15);

			expect(result.isBook).toBe(false);
			expect(result.pages.length).toBe(1);
			// Content is formatted with linked quotes
			expect(result.pages[0]).toContain("short text");
		});

		it("should return multiple pages for long text (book)", () => {
			// Create content with more than 15 sentences
			const sentences = Array.from(
				{ length: 30 },
				(_, i) => `This is sentence number ${i + 1}.`,
			);
			const content = sentences.join(" ");

			const result = splitTextIntoPages(content, textName, 15);

			expect(result.isBook).toBe(true);
			expect(result.pages.length).toBe(2);
		});

		it("should handle empty content", () => {
			const result = splitTextIntoPages("", textName, 15);

			expect(result.isBook).toBe(false);
			expect(result.pages.length).toBe(1);
		});

		it("should handle content with exactly maxBlocksPerPage blocks", () => {
			const sentences = Array.from(
				{ length: 15 },
				(_, i) => `Sentence ${i + 1}.`,
			);
			const content = sentences.join(" ");

			const result = splitTextIntoPages(content, textName, 15);

			expect(result.isBook).toBe(false);
			expect(result.pages.length).toBe(1);
		});

		it("should split at block boundaries", () => {
			// Use longer sentences to prevent merging (short sentences get merged)
			const sentences = Array.from(
				{ length: 25 },
				(_, i) =>
					`This is a much longer sentence number ${i + 1} that has enough words to not be merged.`,
			);
			const content = sentences.join(" ");

			const result = splitTextIntoPages(content, textName, 10);

			expect(result.isBook).toBe(true);
			expect(result.pages.length).toBeGreaterThanOrEqual(2);
		});

		it("should preserve headers in output", () => {
			const content = "# My Header\n\nThis is content after header.";

			const result = splitTextIntoPages(content, textName, 15);

			expect(result.isBook).toBe(false);
			expect(result.pages[0]).toContain("# My Header");
		});

		it("should use default maxBlocksPerPage when not specified", () => {
			// Create 14 sentences - should fit in one page with default of 15
			const sentences = Array.from(
				{ length: 14 },
				(_, i) => `Sentence ${i + 1}.`,
			);
			const content = sentences.join(" ");

			const result = splitTextIntoPages(content, textName);

			expect(result.isBook).toBe(false);
			expect(result.pages.length).toBe(1);
		});

		it("should handle German text correctly", () => {
			const germanText = `
				Hans ging zum Markt. Er kaufte Äpfel und Birnen.
				Die Verkäuferin fragte: "Möchten Sie noch etwas?"
				Hans antwortete: "Nein, danke."
			`.trim();

			const result = splitTextIntoPages(germanText, textName, 15);

			expect(result.isBook).toBe(false);
			expect(result.pages.length).toBe(1);
		});

		it("should format content with linked quotes", () => {
			const content = "First sentence here. Second sentence follows.";
			const result = splitTextIntoPages(content, textName, 15);

			// Output should contain block references (^number format)
			expect(result.pages[0]).toMatch(/\^[\d]+/);
		});
	});

	describe("pageNumberFromInt", () => {
		it("should pad single digit to 3 characters", () => {
			expect(pageNumberFromInt.encode(0)).toBe("000");
			expect(pageNumberFromInt.encode(5)).toBe("005");
			expect(pageNumberFromInt.encode(9)).toBe("009");
		});

		it("should pad double digit to 3 characters", () => {
			expect(pageNumberFromInt.encode(10)).toBe("010");
			expect(pageNumberFromInt.encode(42)).toBe("042");
			expect(pageNumberFromInt.encode(99)).toBe("099");
		});

		it("should preserve triple digit", () => {
			expect(pageNumberFromInt.encode(100)).toBe("100");
			expect(pageNumberFromInt.encode(500)).toBe("500");
			expect(pageNumberFromInt.encode(999)).toBe("999");
		});
	});
});

