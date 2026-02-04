import { describe, expect, it } from "bun:test";
import {
	protectMarkdownSyntax,
	restoreProtectedContent,
} from "../../../../src/commanders/librarian/bookkeeper/segmenter/stream/markdown-protector";

describe("markdown-protector", () => {
	describe("protectMarkdownSyntax", () => {
		it("protects URLs with query parameters", () => {
			const text =
				"Check https://www.youtube.com/watch?v=YYFOKZrvO-w&index=2 for video.";
			const result = protectMarkdownSyntax(text);

			expect(result.safeText).not.toContain("?");
			expect(result.safeText).not.toContain(
				"https://www.youtube.com/watch",
			);
			expect(result.protectedItems).toHaveLength(1);
			expect(result.protectedItems[0]?.original).toBe(
				"https://www.youtube.com/watch?v=YYFOKZrvO-w&index=2",
			);
		});

		it("protects multiple URLs", () => {
			const text = "Visit https://a.com?x=1 and https://b.com?y=2 today.";
			const result = protectMarkdownSyntax(text);

			expect(result.protectedItems).toHaveLength(2);
			expect(result.protectedItems[0]?.original).toBe(
				"https://a.com?x=1",
			);
			expect(result.protectedItems[1]?.original).toBe(
				"https://b.com?y=2",
			);
		});

		it("protects URLs with parentheses (Wikipedia-style)", () => {
			const text =
				"See https://en.wikipedia.org/wiki/Thing_(disambiguation) for more.";
			const result = protectMarkdownSyntax(text);

			expect(result.protectedItems).toHaveLength(1);
			expect(result.protectedItems[0]?.original).toBe(
				"https://en.wikipedia.org/wiki/Thing_(disambiguation)",
			);
		});

		it("protects horizontal rules", () => {
			const text = "Some text\n---\nMore text";
			const result = protectMarkdownSyntax(text);

			expect(result.protectedItems).toHaveLength(1);
			expect(result.protectedItems[0]?.original).toBe("---");
		});

		it("protects wikilinks", () => {
			const text = "See [[Page Name|display]] for details.";
			const result = protectMarkdownSyntax(text);

			expect(result.protectedItems).toHaveLength(1);
			expect(result.protectedItems[0]?.original).toBe(
				"[[Page Name|display]]",
			);
		});

		it("protects multiple wikilinks", () => {
			const text = "Check [[A]] and [[B]] and [[C]].";
			const result = protectMarkdownSyntax(text);

			expect(result.protectedItems).toHaveLength(3);
		});

		it("protects markdown links", () => {
			const text = "Click [here](https://example.com?foo=bar) now.";
			const result = protectMarkdownSyntax(text);

			// Should capture the whole markdown link
			expect(result.protectedItems.some((p) => p.original.includes("[here]"))).toBe(true);
		});

		it("protects fenced code blocks", () => {
			const text =
				"Some text\n```\ncode with ? and !\n```\nMore text.";
			const result = protectMarkdownSyntax(text);

			expect(result.protectedItems).toHaveLength(1);
			expect(result.protectedItems[0]?.original).toContain("```");
		});

		it("does not protect inline code", () => {
			const text = "Use `code?with` here.";
			const result = protectMarkdownSyntax(text);

			// Inline code should not be protected
			expect(result.safeText).toContain("`code?with`");
		});

		it("handles text without special syntax", () => {
			const text = "This is plain text. Nothing special here!";
			const result = protectMarkdownSyntax(text);

			expect(result.safeText).toBe(text);
			expect(result.protectedItems).toHaveLength(0);
		});
	});

	describe("restoreProtectedContent", () => {
		it("restores URLs", () => {
			const original =
				"Check https://www.youtube.com/watch?v=XYZ&index=2 for video.";
			const { safeText, protectedItems } =
				protectMarkdownSyntax(original);

			const restored = restoreProtectedContent(safeText, protectedItems);
			expect(restored).toBe(original);
		});

		it("restores multiple protected items", () => {
			const original =
				"Visit https://a.com?x=1 and [[Page]] today.";
			const { safeText, protectedItems } =
				protectMarkdownSyntax(original);

			const restored = restoreProtectedContent(safeText, protectedItems);
			expect(restored).toBe(original);
		});

		it("restores horizontal rules", () => {
			const original = "Text\n---\nMore";
			const { safeText, protectedItems } =
				protectMarkdownSyntax(original);

			const restored = restoreProtectedContent(safeText, protectedItems);
			expect(restored).toBe(original);
		});

		it("handles empty protected items", () => {
			const text = "Plain text without special syntax.";
			const result = restoreProtectedContent(text, []);
			expect(result).toBe(text);
		});
	});

	describe("round-trip protection and restoration", () => {
		const testCases = [
			"Simple https://example.com/page?query=value&other=123 URL",
			"Multiple: [[Link1]] and [[Link2|alias]]",
			"Code:\n```js\nif (x? y : z) {}\n```\nEnd.",
			"---\n# Heading\nContent",
			"Complex: https://a.com?x=1 with [[Page]] and [md](https://b.com)",
		];

		for (const original of testCases) {
			it(`round-trips: ${original.slice(0, 40)}...`, () => {
				const { safeText, protectedItems } =
					protectMarkdownSyntax(original);
				const restored = restoreProtectedContent(
					safeText,
					protectedItems,
				);
				expect(restored).toBe(original);
			});
		}
	});
});
