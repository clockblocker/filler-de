import { describe, expect, it } from "bun:test";
import { markdownHelper } from "../../../src/stateless-helpers/markdown-strip";

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

	// New formatting tests
	it("strips underscore bold __text__", () => {
		expect(markdownHelper.stripAll("__bold__ text")).toBe("bold text");
	});

	it("strips italic *text*", () => {
		expect(markdownHelper.stripAll("*italic* text")).toBe("italic text");
	});

	it("strips italic _text_", () => {
		expect(markdownHelper.stripAll("_italic_ text")).toBe("italic text");
	});

	it("strips bold+italic ***text***", () => {
		expect(markdownHelper.stripAll("***bolditalic*** text")).toBe("bolditalic text");
	});

	it("strips strikethrough ~~text~~", () => {
		expect(markdownHelper.stripAll("~~struck~~ text")).toBe("struck text");
	});

	it("strips inline code `text`", () => {
		expect(markdownHelper.stripAll("`code` text")).toBe("code text");
	});

	it("strips highlight ==text==", () => {
		expect(markdownHelper.stripAll("==highlight== text")).toBe("highlight text");
	});

	it("removes comments %%text%%", () => {
		expect(markdownHelper.stripAll("visible %%hidden%% text")).toBe("visible  text");
	});

	it("strips external links [text](url)", () => {
		expect(markdownHelper.stripAll("[link](https://example.com) text")).toBe("link text");
	});

	it("strips embeds ![[file]]", () => {
		expect(markdownHelper.stripAll("![[image.png]] text")).toBe("image.png text");
	});

	it("strips HTML <u> tags", () => {
		expect(markdownHelper.stripAll("<u>underlined</u> text")).toBe("underlined text");
	});

	it("strips HTML <sup> tags", () => {
		expect(markdownHelper.stripAll("x<sup>2</sup> text")).toBe("x2 text");
	});

	it("strips HTML <sub> tags", () => {
		expect(markdownHelper.stripAll("H<sub>2</sub>O")).toBe("H2O");
	});

	it("handles complex mixed formatting", () => {
		const input = "**bold** *italic* ~~struck~~ `code` ==hi== [[link]] [ext](url) ^ref";
		const result = markdownHelper.stripAll(input);
		expect(result).toBe("bold italic struck code hi link ext");
	});

	it("handles nested-like formatting correctly", () => {
		// ***bolditalic*** should become bolditalic, not *bolditalic*
		expect(markdownHelper.stripAll("***text***")).toBe("text");
	});

	it("preserves tags", () => {
		expect(markdownHelper.stripAll("#tag **bold**")).toBe("#tag bold");
	});
});
