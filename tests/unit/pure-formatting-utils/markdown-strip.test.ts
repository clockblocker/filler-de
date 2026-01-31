import { describe, expect, it } from "bun:test";
import { markdownHelper } from "../../../src/stateless-helpers/markdown-strip";

describe("markdown.stripBold", () => {
	it("removes bold markers", () => {
		expect(markdownHelper.stripBold("**bold** text")).toBe("bold text");
		expect(markdownHelper.stripBold("some **bold** here")).toBe("some bold here");
	});

	it("handles multiple bold sections", () => {
		expect(markdownHelper.stripBold("**a** and **b**")).toBe("a and b");
	});

	it("handles text without bold", () => {
		expect(markdownHelper.stripBold("plain text")).toBe("plain text");
	});

	it("handles empty string", () => {
		expect(markdownHelper.stripBold("")).toBe("");
	});
});

describe("markdown.stripBlockRefs", () => {
	it("removes block reference at end", () => {
		expect(markdownHelper.stripBlockRefs("Some text ^6")).toBe("Some text");
		expect(markdownHelper.stripBlockRefs("Some text ^abc")).toBe("Some text");
		expect(markdownHelper.stripBlockRefs("Some text ^ABC-123")).toBe("Some text");
	});

	it("handles trailing whitespace", () => {
		expect(markdownHelper.stripBlockRefs("Some text ^6  ")).toBe("Some text");
	});

	it("preserves text without block refs", () => {
		expect(markdownHelper.stripBlockRefs("Plain text")).toBe("Plain text");
	});

	it("does not remove block refs in middle of text", () => {
		expect(markdownHelper.stripBlockRefs("Some ^6 text")).toBe("Some ^6 text");
	});

	it("handles empty string", () => {
		expect(markdownHelper.stripBlockRefs("")).toBe("");
	});
});

describe("markdown.replaceWikilinks", () => {
	it("replaces simple wikilink with target", () => {
		expect(markdownHelper.replaceWikilinks("Text [[schönen]] here")).toBe(
			"Text schönen here",
		);
	});

	it("replaces wikilink with alias using alias", () => {
		expect(markdownHelper.replaceWikilinks("Text [[schön|schönen]] here")).toBe(
			"Text schönen here",
		);
	});

	it("handles multiple wikilinks", () => {
		expect(markdownHelper.replaceWikilinks("[[foo]] and [[bar|baz]]")).toBe(
			"foo and baz",
		);
	});

	it("preserves text without wikilinks", () => {
		expect(markdownHelper.replaceWikilinks("plain text")).toBe("plain text");
	});

	it("handles empty string", () => {
		expect(markdownHelper.replaceWikilinks("")).toBe("");
	});
});

describe("markdown.stripAll", () => {
	it("strips bold, block refs, and replaces wikilinks", () => {
		const input = "**Bold** text with [[schönen]] ^6";
		const result = markdownHelper.stripAll(input);
		expect(result).toBe("Bold text with schönen");
	});

	it("handles wikilinks with aliases", () => {
		const input = "Text [[schön|schönen]] here ^abc";
		const result = markdownHelper.stripAll(input);
		expect(result).toBe("Text schönen here");
	});

	it("handles multiple formatting elements", () => {
		const input = "**A** [[b|c]] **d** [[e]] ^123";
		const result = markdownHelper.stripAll(input);
		expect(result).toBe("A c d e");
	});

	it("handles plain text", () => {
		expect(markdownHelper.stripAll("plain text")).toBe("plain text");
	});

	it("handles empty string", () => {
		expect(markdownHelper.stripAll("")).toBe("");
	});
});
