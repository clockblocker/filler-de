import { describe, expect, it } from "bun:test";
import { extractBlockIdFromLine } from "../../../../src/commanders/textfresser/context/block-id-extractor";

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
