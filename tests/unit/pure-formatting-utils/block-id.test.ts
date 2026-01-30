import { describe, expect, it } from "bun:test";
import { blockIdHelper } from "../../../src/stateless-helpers/block-id";

describe("blockIdHelper.extractFromLine", () => {
	it("extracts numeric block ID at end of line", () => {
		expect(blockIdHelper.extractFromLine("Some text ^6")).toBe("6");
		expect(blockIdHelper.extractFromLine("Some text ^123")).toBe("123");
	});

	it("extracts alphanumeric block ID", () => {
		expect(blockIdHelper.extractFromLine("Some text ^abc")).toBe("abc");
		expect(blockIdHelper.extractFromLine("Some text ^abc123")).toBe("abc123");
		expect(blockIdHelper.extractFromLine("Some text ^ABC-123")).toBe("ABC-123");
	});

	it("handles trailing whitespace", () => {
		expect(blockIdHelper.extractFromLine("Some text ^6  ")).toBe("6");
		expect(blockIdHelper.extractFromLine("Some text ^abc  ")).toBe("abc");
	});

	it("returns null for lines without block ID", () => {
		expect(blockIdHelper.extractFromLine("Some text")).toBeNull();
		expect(blockIdHelper.extractFromLine("Some text with [[wikilink]]")).toBeNull();
	});

	it("returns null for block ID without leading space", () => {
		expect(blockIdHelper.extractFromLine("text^6")).toBeNull();
	});

	it("returns null for block ID not at end of line", () => {
		expect(blockIdHelper.extractFromLine("Some ^6 text")).toBeNull();
	});

	it("handles lines with wikilinks and block IDs", () => {
		expect(blockIdHelper.extractFromLine("Text with [[schönen]] ^6")).toBe("6");
		expect(blockIdHelper.extractFromLine("Text with [[schön|schönen]] ^abc")).toBe(
			"abc",
		);
	});

	it("handles empty string", () => {
		expect(blockIdHelper.extractFromLine("")).toBeNull();
	});
});

describe("blockIdHelper.extractNumeric", () => {
	it("extracts numeric block ID at end of line", () => {
		expect(blockIdHelper.extractNumeric("Some text ^6")).toBe("6");
		expect(blockIdHelper.extractNumeric("Some text ^123")).toBe("123");
	});

	it("returns null for alphanumeric block IDs", () => {
		expect(blockIdHelper.extractNumeric("Some text ^abc")).toBeNull();
		expect(blockIdHelper.extractNumeric("Some text ^abc123")).toBeNull();
	});

	it("handles trailing whitespace", () => {
		expect(blockIdHelper.extractNumeric("Some text ^6  ")).toBe("6");
	});

	it("returns null for lines without block ID", () => {
		expect(blockIdHelper.extractNumeric("Some text")).toBeNull();
	});
});

describe("blockIdHelper.findHighestNumber", () => {
	it("finds highest block number in content", () => {
		const content = "Line 1 ^0\nLine 2 ^5\nLine 3 ^2\n";
		expect(blockIdHelper.findHighestNumber(content)).toBe(5);
	});

	it("returns -1 for content without block IDs", () => {
		expect(blockIdHelper.findHighestNumber("Plain text")).toBe(-1);
	});

	it("handles single block ID", () => {
		expect(blockIdHelper.findHighestNumber("Line ^42\n")).toBe(42);
	});

	it("handles block ID at end of content", () => {
		expect(blockIdHelper.findHighestNumber("Line ^10")).toBe(10);
	});
});

describe("blockIdHelper.formatEmbed", () => {
	it("formats block embed wikilink", () => {
		expect(blockIdHelper.formatEmbed("filename", "6")).toBe("![[filename#^6|^]]");
		expect(blockIdHelper.formatEmbed("my-note", "abc")).toBe("![[my-note#^abc|^]]");
	});
});

describe("blockIdHelper.matchesPattern", () => {
	it("returns match info when pattern found", () => {
		const result = blockIdHelper.matchesPattern("Some text ^abc");
		expect(result).not.toBeNull();
		expect(result?.id).toBe("abc");
		expect(result?.index).toBe(9);
	});

	it("returns null when no pattern found", () => {
		expect(blockIdHelper.matchesPattern("Some text")).toBeNull();
		expect(blockIdHelper.matchesPattern("text^6")).toBeNull();
	});
});
