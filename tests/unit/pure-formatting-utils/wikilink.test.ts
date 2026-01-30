import { describe, expect, it } from "bun:test";
import {
	type ParsedWikilink,
	findClickedWikilink,
	findWikilinkByTarget,
	parseWikilinks,
} from "../../../src/pure-formatting-utils";

describe("parseWikilinks", () => {
	it("parses simple wikilink", () => {
		const result = parseWikilinks("Text with [[schönen]] here");
		expect(result).toEqual([
			{
				fullMatch: "[[schönen]]",
				target: "schönen",
				alias: null,
				surface: "schönen",
			},
		]);
	});

	it("parses wikilink with alias", () => {
		const result = parseWikilinks("Text with [[schön|schönen]] here");
		expect(result).toEqual([
			{
				fullMatch: "[[schön|schönen]]",
				target: "schön",
				alias: "schönen",
				surface: "schönen",
			},
		]);
	});

	it("parses multiple wikilinks", () => {
		const result = parseWikilinks("[[foo]] and [[bar|baz]]");
		expect(result).toHaveLength(2);
		expect(result[0].target).toBe("foo");
		expect(result[1].target).toBe("bar");
		expect(result[1].alias).toBe("baz");
	});

	it("returns empty array for text without wikilinks", () => {
		const result = parseWikilinks("Plain text without links");
		expect(result).toEqual([]);
	});

	it("handles wikilinks with special characters", () => {
		const result = parseWikilinks("[[über-weg]]");
		expect(result[0].target).toBe("über-weg");
	});

	it("handles empty string", () => {
		expect(parseWikilinks("")).toEqual([]);
	});
});

describe("findWikilinkByTarget", () => {
	it("finds wikilink by target (no alias)", () => {
		const result = findWikilinkByTarget(
			"Text with [[schönen]] here",
			"schönen",
		);
		expect(result).not.toBeNull();
		expect(result?.target).toBe("schönen");
		expect(result?.surface).toBe("schönen");
	});

	it("finds wikilink by target when alias exists", () => {
		const result = findWikilinkByTarget(
			"Text with [[schön|schönen]] here",
			"schön",
		);
		expect(result).not.toBeNull();
		expect(result?.target).toBe("schön");
		expect(result?.alias).toBe("schönen");
		expect(result?.surface).toBe("schönen");
	});

	it("returns null when target not found", () => {
		const result = findWikilinkByTarget("Text with [[foo]] here", "bar");
		expect(result).toBeNull();
	});

	it("finds correct wikilink among multiple", () => {
		const result = findWikilinkByTarget("[[foo]] and [[bar]] and [[baz]]", "bar");
		expect(result).not.toBeNull();
		expect(result?.target).toBe("bar");
	});

	it("returns null for empty text", () => {
		expect(findWikilinkByTarget("", "foo")).toBeNull();
	});

	it("handles case-sensitive matching", () => {
		const result = findWikilinkByTarget("[[Foo]]", "foo");
		expect(result).toBeNull();
	});
});

describe("findClickedWikilink (deprecated alias)", () => {
	it("works as alias for findWikilinkByTarget", () => {
		const result = findClickedWikilink(
			"Text with [[schönen]] here",
			"schönen",
		);
		expect(result).not.toBeNull();
		expect(result?.target).toBe("schönen");
	});
});
