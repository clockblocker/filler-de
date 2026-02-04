import { describe, expect, it } from "bun:test";
import { extractLine } from "../../../../src/managers/obsidian/vault-action-manager/file-services/active-view/selection-service";

describe("extractLine", () => {
	it("extracts line at document start", () => {
		expect(extractLine("first\nsecond", 0)).toBe("first");
	});

	it("extracts line containing position in middle", () => {
		// Position 8 is at 'i' in "middle" (indices: 0-5="first\n", 6-11="middle")
		expect(extractLine("first\nmiddle\nlast", 8)).toBe("middle");
	});

	it("extracts line at document end", () => {
		// Position 8 is at 's' in "last"
		expect(extractLine("first\nlast", 8)).toBe("last");
	});

	it("handles single-line document", () => {
		expect(extractLine("only line", 5)).toBe("only line");
	});

	it("handles position right after newline", () => {
		// Position 2 is at 'b' in "b" (indices: 0='a', 1='\n', 2='b')
		expect(extractLine("a\nb", 2)).toBe("b");
	});

	it("handles empty document", () => {
		expect(extractLine("", 0)).toBe("");
	});

	it("handles position at newline character", () => {
		// Position 1 in "a\nb" is at the \n itself
		// content = "a\nb", position = 1 (the \n itself)
		// lastIndexOf("\n", 1) searches backwards from position 1, finds \n at index 1
		// start = 1 + 1 = 2
		// indexOf("\n", 1) searches forward from position 1, finds \n at index 1
		// end = 1
		// slice(2, 1) = "" (empty because start > end)
		// This is an edge case - position exactly at newline returns empty string
		expect(extractLine("a\nb", 1)).toBe("");
	});

	it("handles line with only whitespace", () => {
		// "a\n   \nb" - position 3 is in the middle of whitespace line
		// indices: 0='a', 1='\n', 2=' ', 3=' ', 4=' ', 5='\n', 6='b'
		expect(extractLine("a\n   \nb", 3)).toBe("   ");
	});

	it("handles position at start of middle line", () => {
		// Position at very start of second line
		expect(extractLine("aaa\nbbb\nccc", 4)).toBe("bbb");
	});

	it("handles position at end of middle line", () => {
		// Position at last char of second line (before newline)
		// indices: 0-2="aaa", 3='\n', 4-6="bbb", 7='\n', 8-10="ccc"
		expect(extractLine("aaa\nbbb\nccc", 6)).toBe("bbb");
	});

	it("handles empty lines in document", () => {
		// "a\n\nb" - position 2 is the empty line between a and b
		// indices: 0='a', 1='\n', 2='\n', 3='b'
		expect(extractLine("a\n\nb", 2)).toBe("");
	});

	it("handles position at last character of document", () => {
		const content = "hello\nworld";
		const lastPos = content.length - 1; // position of 'd'
		expect(extractLine(content, lastPos)).toBe("world");
	});

	it("handles position beyond document length gracefully", () => {
		// This tests defensive behavior - position beyond content
		// lastIndexOf and indexOf should still work
		const content = "short";
		expect(extractLine(content, 100)).toBe("short");
	});
});
