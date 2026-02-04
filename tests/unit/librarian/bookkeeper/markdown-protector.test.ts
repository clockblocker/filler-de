import { describe, expect, it } from "bun:test";
import {
	protectMarkdownSyntax,
	restoreProtectedContent,
} from "../../../../src/commanders/librarian/bookkeeper/segmenter/stream/markdown-protector";

describe("markdown-protector", () => {
	describe("protectMarkdownSyntax", () => {
		describe("German abbreviations", () => {
			it("protects z.B. (without space)", () => {
				const text = "Er hat Wünsche, z.B. zu lesen.";
				const result = protectMarkdownSyntax(text);

				expect(result.protectedItems).toHaveLength(1);
				expect(result.protectedItems[0]?.original).toBe("z.B.");
				expect(result.safeText).not.toContain("z.B.");
			});

			it("protects z. B. (with space)", () => {
				const text = "Er hat Wünsche, z. B. zu lesen.";
				const result = protectMarkdownSyntax(text);

				expect(result.protectedItems).toHaveLength(1);
				expect(result.protectedItems[0]?.original).toBe("z. B.");
				expect(result.safeText).not.toContain("z. B.");
			});

			it("protects d.h. and d. h.", () => {
				const text = "Das ist wichtig, d.h. man muss aufpassen.";
				const result = protectMarkdownSyntax(text);

				expect(result.protectedItems).toHaveLength(1);
				expect(result.protectedItems[0]?.original).toBe("d.h.");
			});

			it("protects u.a. (unter anderem)", () => {
				const text = "Er spricht u.a. Deutsch und Englisch.";
				const result = protectMarkdownSyntax(text);

				expect(result.protectedItems).toHaveLength(1);
				expect(result.protectedItems[0]?.original).toBe("u.a.");
			});

			it("protects s.o. and s.u. (see above/below)", () => {
				const text = "Siehe s.o. für Details und s.u. für Beispiele.";
				const result = protectMarkdownSyntax(text);

				expect(result.protectedItems).toHaveLength(2);
				expect(result.protectedItems[0]?.original).toBe("s.o.");
				expect(result.protectedItems[1]?.original).toBe("s.u.");
			});

			it("protects usw. (und so weiter)", () => {
				const text = "Äpfel, Birnen, Bananen usw. sind Obst.";
				const result = protectMarkdownSyntax(text);

				expect(result.protectedItems).toHaveLength(1);
				expect(result.protectedItems[0]?.original).toBe("usw.");
			});

			it("protects bzw. (beziehungsweise)", () => {
				const text = "Rot bzw. blau sind Farben.";
				const result = protectMarkdownSyntax(text);

				expect(result.protectedItems).toHaveLength(1);
				expect(result.protectedItems[0]?.original).toBe("bzw.");
			});

			it("protects ca. (circa)", () => {
				const text = "Das kostet ca. 50 Euro.";
				const result = protectMarkdownSyntax(text);

				expect(result.protectedItems).toHaveLength(1);
				expect(result.protectedItems[0]?.original).toBe("ca.");
			});

			it("protects Nr., Dr., Prof.", () => {
				const text = "Nr. 5 wurde von Dr. Müller und Prof. Schmidt verfasst.";
				const result = protectMarkdownSyntax(text);

				expect(result.protectedItems).toHaveLength(3);
				expect(result.protectedItems.map((p) => p.original)).toEqual([
					"Nr.",
					"Dr.",
					"Prof.",
				]);
			});

			it("protects Mio. and Mrd.", () => {
				const text = "Das Projekt kostet 5 Mio. bzw. 2 Mrd. Euro.";
				const result = protectMarkdownSyntax(text);

				// Mio., bzw., Mrd.
				expect(result.protectedItems).toHaveLength(3);
				expect(result.protectedItems.map((p) => p.original)).toContain(
					"Mio.",
				);
				expect(result.protectedItems.map((p) => p.original)).toContain(
					"Mrd.",
				);
			});

			it("handles multiple abbreviations in one sentence", () => {
				const text =
					"Außerdem hat er zahlreiche Wünsche, z. B. zu lesen, d.h. Bücher usw.";
				const result = protectMarkdownSyntax(text);

				expect(result.protectedItems).toHaveLength(3);
				expect(result.protectedItems.map((p) => p.original)).toEqual([
					"z. B.",
					"d.h.",
					"usw.",
				]);
			});

			it("round-trips abbreviations correctly", () => {
				const original =
					"Außerdem hat er zahlreiche Wünsche, z. B. zu lesen.";
				const { safeText, protectedItems } =
					protectMarkdownSyntax(original);
				const restored = restoreProtectedContent(
					safeText,
					protectedItems,
				);
				expect(restored).toBe(original);
			});
		});

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
