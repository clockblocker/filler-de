import { describe, expect, it } from "bun:test";
import {
	extractBlockIdFromLine,
	extractNumericBlockId,
	findHighestBlockNumber,
} from "../../../src/pure-formatting-utils";

describe("extractBlockIdFromLine", () => {
	it("extracts numeric block ID at end of line", () => {
		expect(extractBlockIdFromLine("Some text ^6")).toBe("6");
		expect(extractBlockIdFromLine("Some text ^123")).toBe("123");
	});

	it("extracts alphanumeric block ID", () => {
		expect(extractBlockIdFromLine("Some text ^abc")).toBe("abc");
		expect(extractBlockIdFromLine("Some text ^abc123")).toBe("abc123");
		expect(extractBlockIdFromLine("Some text ^ABC-123")).toBe("ABC-123");
	});

	it("handles trailing whitespace", () => {
		expect(extractBlockIdFromLine("Some text ^6  ")).toBe("6");
		expect(extractBlockIdFromLine("Some text ^abc  ")).toBe("abc");
	});

	it("returns null for lines without block ID", () => {
		expect(extractBlockIdFromLine("Some text")).toBeNull();
		expect(extractBlockIdFromLine("Some text with [[wikilink]]")).toBeNull();
	});

	it("returns null for block ID without leading space", () => {
		expect(extractBlockIdFromLine("text^6")).toBeNull();
	});

	it("returns null for block ID not at end of line", () => {
		expect(extractBlockIdFromLine("Some ^6 text")).toBeNull();
	});

	it("handles lines with wikilinks and block IDs", () => {
		expect(extractBlockIdFromLine("Text with [[schönen]] ^6")).toBe("6");
		expect(extractBlockIdFromLine("Text with [[schön|schönen]] ^abc")).toBe(
			"abc",
		);
	});

	it("handles empty string", () => {
		expect(extractBlockIdFromLine("")).toBeNull();
	});
});

describe("extractNumericBlockId", () => {
	it("extracts numeric block ID at end of line", () => {
		expect(extractNumericBlockId("Some text ^6")).toBe("6");
		expect(extractNumericBlockId("Some text ^123")).toBe("123");
	});

	it("returns null for alphanumeric block IDs", () => {
		expect(extractNumericBlockId("Some text ^abc")).toBeNull();
		expect(extractNumericBlockId("Some text ^abc123")).toBeNull();
	});

	it("handles trailing whitespace", () => {
		expect(extractNumericBlockId("Some text ^6  ")).toBe("6");
	});

	it("returns null for lines without block ID", () => {
		expect(extractNumericBlockId("Some text")).toBeNull();
	});
});

describe("findHighestBlockNumber", () => {
	it("finds highest block number in content", () => {
		const content = "Line 1 ^0\nLine 2 ^5\nLine 3 ^2\n";
		expect(findHighestBlockNumber(content)).toBe(5);
	});

	it("returns -1 for content without block IDs", () => {
		expect(findHighestBlockNumber("Plain text")).toBe(-1);
	});

	it("handles single block ID", () => {
		expect(findHighestBlockNumber("Line ^42\n")).toBe(42);
	});

	it("handles block ID at end of content", () => {
		expect(findHighestBlockNumber("Line ^10")).toBe(10);
	});
});
