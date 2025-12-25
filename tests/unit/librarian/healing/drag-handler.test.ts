import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	handleDragIn,
	handleFileDragIn,
	handleFolderDragIn,
} from "../../../../src/commanders/librarian/healing/drag-handler";
import { DragInSubtype } from "../../../../src/commanders/librarian/types/literals";
import * as globalState from "../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../src/global-state/parsed-settings";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../../src/obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../../src/obsidian-vault-action-manager/types/split-path";
import { VaultActionType } from "../../../../src/obsidian-vault-action-manager/types/vault-action";

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

function file(pathParts: string[], basename: string, extension: string): SplitPathToFile {
	return {
		basename,
		extension,
		pathParts,
		type: "File",
	};
}

function folder(pathParts: string[], basename: string): SplitPathToFolder {
	return {
		basename,
		pathParts,
		type: "Folder",
	};
}

describe("handleFileDragIn", () => {
	it("moves file to suffix location", () => {
		// User drops note-B-A.md at Library root
		// Should move to Library/A/B/
		const newPath = mdFile(["Library"], "note-B-A");

		const result = handleFileDragIn(newPath);

		expect(result.actions.length).toBeGreaterThan(0);
		
		const renameAction = result.actions.find(
			(a) => a.type === VaultActionType.RenameMdFile,
		);
		expect(renameAction).toBeDefined();
		
		if (renameAction?.type === VaultActionType.RenameMdFile) {
			expect(renameAction.payload.to.pathParts).toEqual(["Library", "A", "B"]);
		}
	});

	it("creates necessary folders", () => {
		const newPath = mdFile(["Library"], "note-C-B-A");

		const result = handleFileDragIn(newPath);

		const createFolderActions = result.actions.filter(
			(a) => a.type === VaultActionType.CreateFolder,
		);
		
		// Should create A, B, C folders
		expect(createFolderActions.length).toBeGreaterThanOrEqual(1);
	});

	it("returns empty actions when already in correct location", () => {
		// File dropped exactly where suffix says it should be
		const newPath = mdFile(["Library", "A", "B"], "note-B-A");

		const result = handleFileDragIn(newPath);

		expect(result.actions).toHaveLength(0);
	});

	it("handles file without suffix (goes to root)", () => {
		// note.md with no suffix stays at root
		const newPath = mdFile(["Library"], "note");

		const result = handleFileDragIn(newPath);

		expect(result.actions).toHaveLength(0);
	});

	it("handles non-md files", () => {
		const newPath = file(["Library"], "image-B-A", "png");

		const result = handleFileDragIn(newPath);

		const renameAction = result.actions.find(
			(a) => a.type === VaultActionType.RenameFile,
		);
		expect(renameAction).toBeDefined();
	});
});

describe("handleFolderDragIn", () => {
	it("sanitizes folder name containing delimiter", () => {
		const newPath = folder(["Library"], "my-folder");

		const result = handleFolderDragIn(newPath, "Library");

		expect(result.sanitized).toBe(true);
		expect(result.actions).toHaveLength(1);
		
		const renameAction = result.actions[0];
		if (renameAction?.type === VaultActionType.RenameFolder) {
			expect(renameAction.payload.to.basename).toBe("my_folder");
		}
	});

	it("returns empty when folder name is clean", () => {
		const newPath = folder(["Library"], "myfolder");

		const result = handleFolderDragIn(newPath, "Library");

		expect(result.sanitized).toBe(false);
		expect(result.actions).toHaveLength(0);
	});

	it("handles deeply nested folder", () => {
		const newPath = folder(["Library", "A", "B"], "bad-name");

		const result = handleFolderDragIn(newPath, "Library");

		expect(result.sanitized).toBe(true);
		
		const renameAction = result.actions[0];
		if (renameAction?.type === VaultActionType.RenameFolder) {
			expect(renameAction.payload.to.basename).toBe("bad_name");
			expect(renameAction.payload.to.pathParts).toEqual(["Library", "A", "B"]);
		}
	});
});

describe("handleDragIn", () => {
	it("delegates to file handler for File subtype", () => {
		const newPath = mdFile(["Library"], "note-A");

		const result = handleDragIn(DragInSubtype.File, newPath);

		// Should have rename action to move to A/
		const renameAction = result.actions.find(
			(a) => a.type === VaultActionType.RenameMdFile,
		);
		expect(renameAction).toBeDefined();
	});

	it("delegates to folder handler for Folder subtype", () => {
		const newPath = folder(["Library"], "bad-name");

		const result = handleDragIn(DragInSubtype.Folder, newPath);

		expect(result.sanitized).toBe(true);
	});
});
