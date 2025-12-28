import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { resolveRuntimeIntent } from "../../../../src/commanders/librarian-old/healing/intent-resolver";
import { RuntimeSubtype } from "../../../../src/commanders/librarin-shared/types/literals";
import * as globalState from "../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../src/global-state/parsed-settings";
import type { SplitPathToMdFile } from "../../../../src/obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../../src/obsidian-vault-action-manager/types/split-path";

// Default settings for tests
const defaultSettings: ParsedUserSettings = {
	apiProvider: "google",
	googleApiKey: "",
	maxSectionDepth: 6,
	splitPathToLibraryRoot: {
		basename: "Library",
		pathParts: [],
		type: SplitPathType.Folder,
	},
	suffixDelimiter: "-",
};

// Shared mocking setup for all tests
let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = spyOn(globalState, "getParsedUserSettings").mockReturnValue({
		...defaultSettings,
	});
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

function mdFile(pathParts: string[], basename: string): SplitPathToMdFile {
	return {
		basename,
		extension: "md",
		pathParts,
		type: "MdFile",
	};
}

describe("resolveRuntimeIntent", () => {
	describe("BasenameOnly - user wants to move", () => {
		it("returns move intent when suffix indicates different location", () => {
			// User renamed Library/A/note-A.md to Library/A/note-B-A.md
			// Intention: move to Library/A/B/
			const oldPath = mdFile(["Library", "A"], "note-A");
			const newPath = mdFile(["Library", "A"], "note-B-A");

			const result = resolveRuntimeIntent(
				oldPath,
				newPath,
				RuntimeSubtype.BasenameOnly,
			);

			expect(result).not.toBeNull();
			expect(result?.to.pathParts).toEqual(["Library", "A", "B"]);
			expect(result?.to.basename).toBe("note-B-A");
		});

		it("returns null when suffix already matches location", () => {
			// User renamed but suffix matches current path
			const oldPath = mdFile(["Library", "A"], "note-X");
			const newPath = mdFile(["Library", "A"], "note-A");

			const result = resolveRuntimeIntent(
				oldPath,
				newPath,
				RuntimeSubtype.BasenameOnly,
			);

			expect(result).toBeNull();
		});

		it("handles deep nesting", () => {
			// Library/A/note.md renamed to Library/A/note-C-B-A.md
			// Should move to Library/A/B/C/
			const oldPath = mdFile(["Library", "A"], "note");
			const newPath = mdFile(["Library", "A"], "note-C-B-A");

			const result = resolveRuntimeIntent(
				oldPath,
				newPath,
				RuntimeSubtype.BasenameOnly,
			);

			expect(result).not.toBeNull();
			expect(result?.to.pathParts).toEqual(["Library", "A", "B", "C"]);
		});

		it("adds suffix when user renames to name without suffix", () => {
			// User renamed Library/A/B/Untitled.md to Library/A/B/Note.md (no suffix)
			// Should add suffix to match location: Note-B-A.md
			const oldPath = mdFile(["Library", "A", "B"], "Untitled");
			const newPath = mdFile(["Library", "A", "B"], "Note");

			const result = resolveRuntimeIntent(
				oldPath,
				newPath,
				RuntimeSubtype.BasenameOnly,
			);

			expect(result).not.toBeNull();
			expect(result?.to.pathParts).toEqual(["Library", "A", "B"]); // stays in same folder
			expect(result?.to.basename).toBe("Note-B-A"); // suffix added
		});

		it("returns null when at root and renamed without suffix", () => {
			// User renamed Library/Untitled.md to Library/Note.md (no suffix)
			// At root, no suffix needed - no action
			const oldPath = mdFile(["Library"], "Untitled");
			const newPath = mdFile(["Library"], "Note");

			const result = resolveRuntimeIntent(
				oldPath,
				newPath,
				RuntimeSubtype.BasenameOnly,
			);

			expect(result).toBeNull();
		});
	});

	describe("PathOnly - user moved file", () => {
		it("returns rename intent to fix suffix", () => {
			// User moved Library/A/note-A.md to Library/B/note-A.md
			// Need to fix suffix to note-B
			const oldPath = mdFile(["Library", "A"], "note-A");
			const newPath = mdFile(["Library", "B"], "note-A");

			const result = resolveRuntimeIntent(
				oldPath,
				newPath,
				RuntimeSubtype.PathOnly,
			);

			expect(result).not.toBeNull();
			expect(result?.to.pathParts).toEqual(["Library", "B"]);
			expect(result?.to.basename).toBe("note-B");
		});

		it("returns null when suffix already correct", () => {
			// File moved and suffix already matches
			const oldPath = mdFile(["Library", "A"], "note-A");
			const newPath = mdFile(["Library", "B"], "note-B");

			const result = resolveRuntimeIntent(
				oldPath,
				newPath,
				RuntimeSubtype.PathOnly,
			);

			expect(result).toBeNull();
		});

		it("handles move to deeper location", () => {
			// Library/note.md moved to Library/A/B/note.md
			// Need suffix note-B-A
			const oldPath = mdFile(["Library"], "note");
			const newPath = mdFile(["Library", "A", "B"], "note");

			const result = resolveRuntimeIntent(
				oldPath,
				newPath,
				RuntimeSubtype.PathOnly,
			);

			expect(result).not.toBeNull();
			expect(result?.to.basename).toBe("note-B-A");
		});

		it("handles move to root", () => {
			// Library/A/B/note-B-A.md moved to Library/note-B-A.md
			// Need suffix (empty) → just nodeName
			const oldPath = mdFile(["Library", "A", "B"], "note-B-A");
			const newPath = mdFile(["Library"], "note-B-A");

			const result = resolveRuntimeIntent(
				oldPath,
				newPath,
				RuntimeSubtype.PathOnly,
			);

			expect(result).not.toBeNull();
			expect(result?.to.basename).toBe("note");
		});
	});

	describe("Both - path wins", () => {
		it("fixes suffix to match new path", () => {
			// User changed both: Library/A/old-A.md to Library/B/new-X.md
			// Path wins → fix suffix to match B
			const oldPath = mdFile(["Library", "A"], "old-A");
			const newPath = mdFile(["Library", "B"], "new-X");

			const result = resolveRuntimeIntent(
				oldPath,
				newPath,
				RuntimeSubtype.Both,
			);

			expect(result).not.toBeNull();
			expect(result?.to.pathParts).toEqual(["Library", "B"]);
			expect(result?.to.basename).toBe("new-B");
		});

		it("returns null when suffix already correct", () => {
			const oldPath = mdFile(["Library", "A"], "old-A");
			const newPath = mdFile(["Library", "B"], "new-B");

			const result = resolveRuntimeIntent(
				oldPath,
				newPath,
				RuntimeSubtype.Both,
			);

			expect(result).toBeNull();
		});
	});

	describe("PathOnly with suffixed folder (folder rename)", () => {
		it("expands suffixed folder and moves file", () => {
			// Folder renamed: Library/X → Library/X-Y
			// File event: Library/X/note-X.md → Library/X-Y/note-X.md
			// Expected: move to Library/X/Y/note-X-Y.md
			const oldPath = mdFile(["Library", "X"], "note-X");
			const newPath = mdFile(["Library", "X-Y"], "note-X");

			const result = resolveRuntimeIntent(
				oldPath,
				newPath,
				RuntimeSubtype.PathOnly,
			);

			expect(result).not.toBeNull();
			expect(result?.to.pathParts).toEqual(["Library", "X", "Y"]);
			expect(result?.to.basename).toBe("note-Y-X");
		});

		it("handles nested suffixed folders", () => {
			// Library/A/B/note-B-A.md → Library/A/B-C/note-B-A.md
			// Expected: Library/A/B/C/note-C-B-A.md
			const oldPath = mdFile(["Library", "A", "B"], "note-B-A");
			const newPath = mdFile(["Library", "A", "B-C"], "note-B-A");

			const result = resolveRuntimeIntent(
				oldPath,
				newPath,
				RuntimeSubtype.PathOnly,
			);

			expect(result).not.toBeNull();
			expect(result?.to.pathParts).toEqual(["Library", "A", "B", "C"]);
			expect(result?.to.basename).toBe("note-C-B-A");
		});

		it("handles multiple dashes in folder name", () => {
			// Library/X/note-X.md → Library/X-Y-Z/note-X.md
			// Expected: Library/X/Y/Z/note-Z-Y-X.md
			const oldPath = mdFile(["Library", "X"], "note-X");
			const newPath = mdFile(["Library", "X-Y-Z"], "note-X");

			const result = resolveRuntimeIntent(
				oldPath,
				newPath,
				RuntimeSubtype.PathOnly,
			);

			expect(result).not.toBeNull();
			expect(result?.to.pathParts).toEqual(["Library", "X", "Y", "Z"]);
			expect(result?.to.basename).toBe("note-Z-Y-X");
		});
	});
});
