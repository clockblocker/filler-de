import { describe, expect, it } from "bun:test";
import {
	replaceWikilinksWithSurface,
	stripBlockRefs,
	stripBoldMarkers,
	stripMarkdownForContext,
} from "../../../../src/commanders/textfresser/context/markdown-stripper";

describe("stripBoldMarkers", () => {
	it("removes bold markers", () => {
		expect(stripBoldMarkers("**bold** text")).toBe("bold text");
		expect(stripBoldMarkers("some **bold** here")).toBe("some bold here");
	});

	it("handles multiple bold sections", () => {
		expect(stripBoldMarkers("**a** and **b**")).toBe("a and b");
	});

	it("handles text without bold", () => {
		expect(stripBoldMarkers("plain text")).toBe("plain text");
	});

	it("handles empty string", () => {
		expect(stripBoldMarkers("")).toBe("");
	});
});

describe("stripBlockRefs", () => {
	it("removes block reference at end", () => {
		expect(stripBlockRefs("Some text ^6")).toBe("Some text");
		expect(stripBlockRefs("Some text ^abc")).toBe("Some text");
		expect(stripBlockRefs("Some text ^ABC-123")).toBe("Some text");
	});

	it("handles trailing whitespace", () => {
		expect(stripBlockRefs("Some text ^6  ")).toBe("Some text");
	});

	it("preserves text without block refs", () => {
		expect(stripBlockRefs("Plain text")).toBe("Plain text");
	});

	it("does not remove block refs in middle of text", () => {
		expect(stripBlockRefs("Some ^6 text")).toBe("Some ^6 text");
	});

	it("handles empty string", () => {
		expect(stripBlockRefs("")).toBe("");
	});
});

describe("replaceWikilinksWithSurface", () => {
	it("replaces simple wikilink with target", () => {
		expect(replaceWikilinksWithSurface("Text [[schönen]] here")).toBe(
			"Text schönen here",
		);
	});

	it("replaces wikilink with alias using alias", () => {
		expect(replaceWikilinksWithSurface("Text [[schön|schönen]] here")).toBe(
			"Text schönen here",
		);
	});

	it("handles multiple wikilinks", () => {
		expect(replaceWikilinksWithSurface("[[foo]] and [[bar|baz]]")).toBe(
			"foo and baz",
		);
	});

	it("preserves text without wikilinks", () => {
		expect(replaceWikilinksWithSurface("plain text")).toBe("plain text");
	});

	it("handles empty string", () => {
		expect(replaceWikilinksWithSurface("")).toBe("");
	});
});

describe("stripMarkdownForContext", () => {
	it("strips bold, block refs, and replaces wikilinks", () => {
		const input = "**Bold** text with [[schönen]] ^6";
		const result = stripMarkdownForContext(input);
		expect(result).toBe("Bold text with schönen");
	});

	it("handles wikilinks with aliases", () => {
		const input = "Text [[schön|schönen]] here ^abc";
		const result = stripMarkdownForContext(input);
		expect(result).toBe("Text schönen here");
	});

	it("handles multiple formatting elements", () => {
		const input = "**A** [[b|c]] **d** [[e]] ^123";
		const result = stripMarkdownForContext(input);
		expect(result).toBe("A c d e");
	});

	it("handles plain text", () => {
		expect(stripMarkdownForContext("plain text")).toBe("plain text");
	});

	it("handles empty string", () => {
		expect(stripMarkdownForContext("")).toBe("");
	});
});
