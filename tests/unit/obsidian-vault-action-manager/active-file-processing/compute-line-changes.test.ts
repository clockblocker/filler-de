import { describe, expect, it } from "bun:test";
import { computeLineChanges } from "../../../../src/managers/obsidian/vault-action-manager/file-services/active-view/writer/compute-line-changes";

describe("computeLineChanges", () => {
	describe("no-op scenarios", () => {
		it("returns empty array when before === after", () => {
			expect(computeLineChanges("hello", "hello")).toEqual([]);
		});

		it("returns empty array for identical multi-line content", () => {
			expect(computeLineChanges("a\nb\nc", "a\nb\nc")).toEqual([]);
		});
	});

	describe("single line modifications", () => {
		it("replaces middle line", () => {
			const changes = computeLineChanges("a\nb\nc", "a\nX\nc");
			expect(changes).toEqual([
				{ from: { ch: 0, line: 1 }, text: "X", to: { ch: 1, line: 1 } },
			]);
		});

		it("replaces first line", () => {
			const changes = computeLineChanges("old\nkeep", "NEW\nkeep");
			expect(changes).toEqual([
				{ from: { ch: 0, line: 0 }, text: "NEW", to: { ch: 3, line: 0 } },
			]);
		});

		it("replaces last line", () => {
			const changes = computeLineChanges("keep\nold", "keep\nNEW");
			expect(changes).toEqual([
				{ from: { ch: 0, line: 1 }, text: "NEW", to: { ch: 3, line: 1 } },
			]);
		});

		it("replaces only line in single-line document", () => {
			const changes = computeLineChanges("old", "new");
			expect(changes).toEqual([
				{ from: { ch: 0, line: 0 }, text: "new", to: { ch: 3, line: 0 } },
			]);
		});

		it("handles line with different length (shorter to longer)", () => {
			const changes = computeLineChanges("short", "much longer text");
			expect(changes).toEqual([
				{ from: { ch: 0, line: 0 }, text: "much longer text", to: { ch: 5, line: 0 } },
			]);
		});

		it("handles line with different length (longer to shorter)", () => {
			const changes = computeLineChanges("much longer text", "short");
			expect(changes).toEqual([
				{ from: { ch: 0, line: 0 }, text: "short", to: { ch: 16, line: 0 } },
			]);
		});
	});

	describe("line deletion at end", () => {
		it("deletes single line from end", () => {
			const changes = computeLineChanges("a\nb\nc", "a\nb");
			// Deletes from line 2 to end of document
			expect(changes).toEqual([
				{ from: { ch: 0, line: 2 }, text: "", to: { ch: 1, line: 2 } },
			]);
		});

		it("deletes multiple lines from end", () => {
			const changes = computeLineChanges("a\nb\nc\nd", "a");
			// Deletes from line 1 (b) to end of document (line 3, char 1)
			expect(changes).toEqual([
				{ from: { ch: 0, line: 1 }, text: "", to: { ch: 1, line: 3 } },
			]);
		});

		it("deletes all but first line", () => {
			const changes = computeLineChanges("keep\ndel1\ndel2", "keep");
			expect(changes).toEqual([
				{ from: { ch: 0, line: 1 }, text: "", to: { ch: 4, line: 2 } },
			]);
		});

		it("transforms to empty string", () => {
			const changes = computeLineChanges("content", "");
			expect(changes).toEqual([
				{ from: { ch: 0, line: 0 }, text: "", to: { ch: 7, line: 0 } },
			]);
		});

		it("deletes from multi-line to empty", () => {
			const changes = computeLineChanges("a\nb\nc", "");
			// First line replacement to empty, then deletion of remaining lines
			expect(changes).toEqual([
				{ from: { ch: 0, line: 0 }, text: "", to: { ch: 1, line: 0 } },
				{ from: { ch: 0, line: 1 }, text: "", to: { ch: 1, line: 2 } },
			]);
		});
	});

	describe("line addition at end", () => {
		it("adds single line to end", () => {
			const changes = computeLineChanges("a", "a\nb");
			expect(changes).toEqual([{ from: { ch: 1, line: 0 }, text: "\nb" }]);
		});

		it("adds multiple lines to end", () => {
			const changes = computeLineChanges("a", "a\nb\nc\nd");
			expect(changes).toEqual([{ from: { ch: 1, line: 0 }, text: "\nb\nc\nd" }]);
		});

		it("adds to empty document (go-back link case)", () => {
			// CRITICAL: This is the go-back link insertion case
			const changes = computeLineChanges("", "[[link]]");
			// Empty doc has one line with length 0
			expect(changes).toEqual([
				{ from: { ch: 0, line: 0 }, text: "[[link]]", to: { ch: 0, line: 0 } },
			]);
		});

		it("adds multiple lines to empty document", () => {
			const changes = computeLineChanges("", "line1\nline2");
			// First: replace empty line with "line1"
			// Second: append "\nline2"
			expect(changes).toEqual([
				{ from: { ch: 0, line: 0 }, text: "line1", to: { ch: 0, line: 0 } },
				{ from: { ch: 0, line: 0 }, text: "\nline2" },
			]);
		});
	});

	describe("mixed operations", () => {
		it("replaces and adds lines", () => {
			const changes = computeLineChanges("old1\nold2", "new1\nnew2\nnew3");
			// Lines 0,1: replace
			// After line 1: append new3
			expect(changes).toEqual([
				{ from: { ch: 0, line: 0 }, text: "new1", to: { ch: 4, line: 0 } },
				{ from: { ch: 0, line: 1 }, text: "new2", to: { ch: 4, line: 1 } },
				{ from: { ch: 4, line: 1 }, text: "\nnew3" },
			]);
		});

		it("replaces and deletes lines", () => {
			const changes = computeLineChanges("a\nb\nc\nd", "A\nB");
			// Lines 0,1: replace
			// Lines 2,3: delete
			expect(changes).toEqual([
				{ from: { ch: 0, line: 0 }, text: "A", to: { ch: 1, line: 0 } },
				{ from: { ch: 0, line: 1 }, text: "B", to: { ch: 1, line: 1 } },
				{ from: { ch: 0, line: 2 }, text: "", to: { ch: 1, line: 3 } },
			]);
		});

		it("interleaves unchanged and changed lines", () => {
			const changes = computeLineChanges(
				"keep1\nchange\nkeep2\ndelete",
				"keep1\nCHANGED\nkeep2",
			);
			// Only line 1 changed, line 3 deleted
			expect(changes).toHaveLength(2);
			expect(changes[0]).toEqual({
				from: { ch: 0, line: 1 },
				text: "CHANGED",
				to: { ch: 6, line: 1 },
			});
			expect(changes[1]).toEqual({
				from: { ch: 0, line: 3 },
				text: "",
				to: { ch: 6, line: 3 },
			});
		});
	});

	describe("edge cases with empty lines", () => {
		it("handles trailing newline (3 lines when split)", () => {
			// "a\nb\n" splits to ["a", "b", ""]
			const changes = computeLineChanges("a\nb\n", "a\nb\nc");
			// Third line changes from "" to "c"
			expect(changes).toEqual([
				{ from: { ch: 0, line: 2 }, text: "c", to: { ch: 0, line: 2 } },
			]);
		});

		it("handles multiple consecutive empty lines", () => {
			const changes = computeLineChanges("a\n\n\nb", "a\nX\n\nb");
			// Line 1 changes from "" to "X"
			expect(changes).toEqual([
				{ from: { ch: 0, line: 1 }, text: "X", to: { ch: 0, line: 1 } },
			]);
		});

		it("removes trailing newline", () => {
			const changes = computeLineChanges("a\nb\n", "a\nb");
			// Empty third line deleted
			expect(changes).toEqual([
				{ from: { ch: 0, line: 2 }, text: "", to: { ch: 0, line: 2 } },
			]);
		});

		it("adds trailing newline", () => {
			const changes = computeLineChanges("a\nb", "a\nb\n");
			// Empty line added at end
			expect(changes).toEqual([{ from: { ch: 1, line: 1 }, text: "\n" }]);
		});
	});

	describe("CRLF quirk documentation", () => {
		it("splits only on \\n leaving \\r in content", () => {
			// "a\r\nb" splits to ["a\r", "b"] (NOT ["a", "b"])
			// This documents current behavior - line content includes \r
			const changes = computeLineChanges("a\r\nb", "a\r\nX");
			// Line 1 changes from "b" to "X"
			expect(changes).toEqual([
				{ from: { ch: 0, line: 1 }, text: "X", to: { ch: 1, line: 1 } },
			]);
		});
	});

	describe("realistic use cases", () => {
		it("inserting go-back link at start of file", () => {
			const before = "# Title\n\nSome content";
			const after = "[[← Parent]]\n\n# Title\n\nSome content";
			const changes = computeLineChanges(before, after);
			// First line "# Title" -> "[[← Parent]]"
			// Second line "" -> ""
			// Third line "Some content" -> "# Title"
			// Then append "\n\nSome content"
			expect(changes.length).toBeGreaterThan(0);
		});

		it("updating checkbox status", () => {
			const before = "- [ ] Task 1\n- [x] Task 2";
			const after = "- [x] Task 1\n- [x] Task 2";
			const changes = computeLineChanges(before, after);
			expect(changes).toEqual([
				{ from: { ch: 0, line: 0 }, text: "- [x] Task 1", to: { ch: 12, line: 0 } },
			]);
		});

		it("appending content to file", () => {
			const before = "Line 1\nLine 2";
			const after = "Line 1\nLine 2\nLine 3\nLine 4";
			const changes = computeLineChanges(before, after);
			expect(changes).toEqual([{ from: { ch: 6, line: 1 }, text: "\nLine 3\nLine 4" }]);
		});
	});
});
