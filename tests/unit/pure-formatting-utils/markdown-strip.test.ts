import { describe, expect, it } from "bun:test";
import { markdown } from "../../../src/stateless-services/pure-formatting-utils";

describe("markdown.stripBold", () => {
	it("removes bold markers", () => {
		expect(markdown.stripBold("**bold** text")).toBe("bold text");
		expect(markdown.stripBold("some **bold** here")).toBe("some bold here");
	});

	it("handles multiple bold sections", () => {
		expect(markdown.stripBold("**a** and **b**")).toBe("a and b");
	});

	it("handles text without bold", () => {
		expect(markdown.stripBold("plain text")).toBe("plain text");
	});

	it("handles empty string", () => {
		expect(markdown.stripBold("")).toBe("");
	});
});

describe("markdown.stripBlockRefs", () => {
	it("removes block reference at end", () => {
		expect(markdown.stripBlockRefs("Some text ^6")).toBe("Some text");
		expect(markdown.stripBlockRefs("Some text ^abc")).toBe("Some text");
		expect(markdown.stripBlockRefs("Some text ^ABC-123")).toBe("Some text");
	});

	it("handles trailing whitespace", () => {
		expect(markdown.stripBlockRefs("Some text ^6  ")).toBe("Some text");
	});

	it("preserves text without block refs", () => {
		expect(markdown.stripBlockRefs("Plain text")).toBe("Plain text");
	});

	it("does not remove block refs in middle of text", () => {
		expect(markdown.stripBlockRefs("Some ^6 text")).toBe("Some ^6 text");
	});

	it("handles empty string", () => {
		expect(markdown.stripBlockRefs("")).toBe("");
	});
});

describe("markdown.replaceWikilinks", () => {
	it("replaces simple wikilink with target", () => {
		expect(markdown.replaceWikilinks("Text [[schönen]] here")).toBe(
			"Text schönen here",
		);
	});

	it("replaces wikilink with alias using alias", () => {
		expect(markdown.replaceWikilinks("Text [[schön|schönen]] here")).toBe(
			"Text schönen here",
		);
	});

	it("handles multiple wikilinks", () => {
		expect(markdown.replaceWikilinks("[[foo]] and [[bar|baz]]")).toBe(
			"foo and baz",
		);
	});

	it("preserves text without wikilinks", () => {
		expect(markdown.replaceWikilinks("plain text")).toBe("plain text");
	});

	it("handles empty string", () => {
		expect(markdown.replaceWikilinks("")).toBe("");
	});
});

describe("markdown.stripAll", () => {
	it("strips bold, block refs, and replaces wikilinks", () => {
		const input = "**Bold** text with [[schönen]] ^6";
		const result = markdown.stripAll(input);
		expect(result).toBe("Bold text with schönen");
	});

	it("handles wikilinks with aliases", () => {
		const input = "Text [[schön|schönen]] here ^abc";
		const result = markdown.stripAll(input);
		expect(result).toBe("Text schönen here");
	});

	it("handles multiple formatting elements", () => {
		const input = "**A** [[b|c]] **d** [[e]] ^123";
		const result = markdown.stripAll(input);
		expect(result).toBe("A c d e");
	});

	it("handles plain text", () => {
		expect(markdown.stripAll("plain text")).toBe("plain text");
	});

	it("handles empty string", () => {
		expect(markdown.stripAll("")).toBe("");
	});
});
