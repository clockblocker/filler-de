import { describe, expect, it } from "bun:test";
import { type ParsedWikilink, wikilinkHelper } from "../../../src/stateless-services/pure-formatting-utils";

describe("wikilinkHelper.parse", () => {
	it("parses simple wikilink", () => {
		const result = wikilinkHelper.parse("Text with [[schönen]] here");
		expect(result).toEqual([
			{
				alias: null,
				fullMatch: "[[schönen]]",
				surface: "schönen",
				target: "schönen",
			},
		]);
	});

	it("parses wikilink with alias", () => {
		const result = wikilinkHelper.parse("Text with [[schön|schönen]] here");
		expect(result).toEqual([
			{
				alias: "schönen",
				fullMatch: "[[schön|schönen]]",
				surface: "schönen",
				target: "schön",
			},
		]);
	});

	it("parses multiple wikilinks", () => {
		const result = wikilinkHelper.parse("[[foo]] and [[bar|baz]]");
		expect(result).toHaveLength(2);
		expect(result[0]!.target).toBe("foo");
		expect(result[1]!.target).toBe("bar");
		expect(result[1]!.alias).toBe("baz");
	});

	it("returns empty array for text without wikilinks", () => {
		const result = wikilinkHelper.parse("Plain text without links");
		expect(result).toEqual([]);
	});

	it("handles wikilinks with special characters", () => {
		const result = wikilinkHelper.parse("[[über-weg]]");
		expect(result[0]!.target).toBe("über-weg");
	});

	it("handles empty string", () => {
		expect(wikilinkHelper.parse("")).toEqual([]);
	});
});

describe("wikilinkHelper.findByTarget", () => {
	it("finds wikilink by target (no alias)", () => {
		const result = wikilinkHelper.findByTarget(
			"Text with [[schönen]] here",
			"schönen",
		);
		expect(result).not.toBeNull();
		expect(result?.target).toBe("schönen");
		expect(result?.surface).toBe("schönen");
	});

	it("finds wikilink by target when alias exists", () => {
		const result = wikilinkHelper.findByTarget(
			"Text with [[schön|schönen]] here",
			"schön",
		);
		expect(result).not.toBeNull();
		expect(result?.target).toBe("schön");
		expect(result?.alias).toBe("schönen");
		expect(result?.surface).toBe("schönen");
	});

	it("returns null when target not found", () => {
		const result = wikilinkHelper.findByTarget("Text with [[foo]] here", "bar");
		expect(result).toBeNull();
	});

	it("finds correct wikilink among multiple", () => {
		const result = wikilinkHelper.findByTarget("[[foo]] and [[bar]] and [[baz]]", "bar");
		expect(result).not.toBeNull();
		expect(result?.target).toBe("bar");
	});

	it("returns null for empty text", () => {
		expect(wikilinkHelper.findByTarget("", "foo")).toBeNull();
	});

	it("handles case-sensitive matching", () => {
		const result = wikilinkHelper.findByTarget("[[Foo]]", "foo");
		expect(result).toBeNull();
	});
});

describe("wikilinkHelper.matchesPattern", () => {
	it("returns parsed wikilinks (alias for parse)", () => {
		const result = wikilinkHelper.matchesPattern("[[foo]] and [[bar]]");
		expect(result).toHaveLength(2);
	});

	it("returns empty array for text without wikilinks", () => {
		expect(wikilinkHelper.matchesPattern("plain text")).toEqual([]);
	});
});

describe("wikilinkHelper.createMatcher", () => {
	it("iterates through wikilinks", () => {
		const nextMatch = wikilinkHelper.createMatcher("[[foo]] and [[bar|baz]]");

		const first = nextMatch();
		expect(first).not.toBeNull();
		expect(first?.target).toBe("foo");
		expect(first?.alias).toBeUndefined();

		const second = nextMatch();
		expect(second).not.toBeNull();
		expect(second?.target).toBe("bar");
		expect(second?.alias).toBe("baz");

		const third = nextMatch();
		expect(third).toBeNull();
	});

	it("returns null immediately for text without wikilinks", () => {
		const nextMatch = wikilinkHelper.createMatcher("plain text");
		expect(nextMatch()).toBeNull();
	});
});
