import { describe, expect, it } from "bun:test";
import { alignText } from "../../../src/stateless-helpers/align-text";

describe("alignText", () => {
	it("maps every target unit to its source range, skipping dropped markup", () => {
		const source = "Er *gibt* auf.";
		const alignment = alignText(source, "Er gibt auf.");
		expect(alignment).toBeDefined();
		const word = (from: number, to: number) =>
			source.slice(alignment?.starts[from], alignment?.ends[to - 1]);
		expect(word(3, 7)).toBe("gibt");
		expect(word(8, 11)).toBe("auf");
		expect(alignment && source.slice(alignment.start, alignment.end)).toBe(
			"Er *gibt* auf.",
		);
	});

	it("finds nothing for text the source lacks", () => {
		expect(alignText("abc", "xyz")).toBeUndefined();
	});
});
