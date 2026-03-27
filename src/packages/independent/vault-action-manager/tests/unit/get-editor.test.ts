import { describe, expect, it } from "bun:test";
import { getEditor } from "../../src/helpers/get-editor";

describe("getEditor", () => {
	it("returns ok when an active markdown view has a file", () => {
		const editor = { replaceSelection: () => {} };
		const app = {
			workspace: {
				getActiveViewOfType: () => ({
					editor,
					file: { path: "Library/note.md" },
				}),
			},
		};

		const result = getEditor(app as never);

		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toBe(editor);
		}
	});

	it("returns err when there is no active editor", () => {
		const app = {
			workspace: {
				getActiveViewOfType: () => null,
			},
		};

		const result = getEditor(app as never);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toBe("Failed to get editor");
		}
	});

	it("returns err when obsidian access throws", () => {
		const app = {
			workspace: {
				getActiveViewOfType: () => {
					throw new Error("boom");
				},
			},
		};

		const result = getEditor(app as never);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toBe("Failed to get editor: boom");
		}
	});
});
