/**
 * Tests for ActionHelpers module.
 * Ensures the action helper functions work correctly.
 */

import { describe, expect, it } from "bun:test";
import {
	ActionHelpers,
	actionsSharePath,
	asFileAction,
	asFolderAction,
	asMdFileAction,
	asRenameAction,
	getActionKey,
	getActionPath,
	getActionSplitPath,
	getParentPathParts,
	getPathDepth,
	getRenameTargetPath,
	isCreateAction,
	isFileAction,
	isFolderAction,
	isMdFileAction,
	isProcessAction,
	isRenameAction,
	isTrashAction,
} from "../../../src/managers/obsidian/vault-action-manager/helpers/action-helpers";
import type { SplitPathToFile, SplitPathToFolder, SplitPathToMdFile } from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { type VaultAction, VaultActionKind } from "../../../src/managers/obsidian/vault-action-manager/types/vault-action";

// ─── Test Helpers ───

const folder = (basename: string, pathParts: string[] = []): SplitPathToFolder => ({
	basename,
	kind: "Folder",
	pathParts,
});

const mdFile = (basename: string, pathParts: string[] = []): SplitPathToMdFile => ({
	basename,
	extension: "md",
	kind: "MdFile",
	pathParts,
});

const file = (basename: string, extension: string, pathParts: string[] = []): SplitPathToFile => ({
	basename,
	extension,
	kind: "File",
	pathParts,
});

describe("ActionHelpers", () => {
	describe("Classification Functions", () => {
		describe("isCreateAction", () => {
			it("returns true for CreateFolder", () => {
				const action: VaultAction = {
					kind: VaultActionKind.CreateFolder,
					payload: { splitPath: folder("test") },
				};
				expect(isCreateAction(action)).toBe(true);
			});

			it("returns true for CreateFile", () => {
				const action: VaultAction = {
					kind: VaultActionKind.CreateFile,
					payload: { splitPath: file("img", "png") },
				};
				expect(isCreateAction(action)).toBe(true);
			});

			it("returns true for UpsertMdFile", () => {
				const action: VaultAction = {
					kind: VaultActionKind.UpsertMdFile,
					payload: { splitPath: mdFile("note"), content: "" },
				};
				expect(isCreateAction(action)).toBe(true);
			});

			it("returns false for other actions", () => {
				const action: VaultAction = {
					kind: VaultActionKind.TrashFolder,
					payload: { splitPath: folder("test") },
				};
				expect(isCreateAction(action)).toBe(false);
			});
		});

		describe("isRenameAction", () => {
			it("returns true for RenameFolder", () => {
				const action: VaultAction = {
					kind: VaultActionKind.RenameFolder,
					payload: { from: folder("a"), to: folder("b") },
				};
				expect(isRenameAction(action)).toBe(true);
			});

			it("returns true for RenameMdFile", () => {
				const action: VaultAction = {
					kind: VaultActionKind.RenameMdFile,
					payload: { from: mdFile("a"), to: mdFile("b") },
				};
				expect(isRenameAction(action)).toBe(true);
			});

			it("returns true for RenameFile", () => {
				const action: VaultAction = {
					kind: VaultActionKind.RenameFile,
					payload: { from: file("a", "png"), to: file("b", "png") },
				};
				expect(isRenameAction(action)).toBe(true);
			});
		});

		describe("isTrashAction", () => {
			it("returns true for TrashFolder", () => {
				const action: VaultAction = {
					kind: VaultActionKind.TrashFolder,
					payload: { splitPath: folder("test") },
				};
				expect(isTrashAction(action)).toBe(true);
			});

			it("returns true for TrashFile", () => {
				const action: VaultAction = {
					kind: VaultActionKind.TrashFile,
					payload: { splitPath: file("img", "png") },
				};
				expect(isTrashAction(action)).toBe(true);
			});

			it("returns true for TrashMdFile", () => {
				const action: VaultAction = {
					kind: VaultActionKind.TrashMdFile,
					payload: { splitPath: mdFile("note") },
				};
				expect(isTrashAction(action)).toBe(true);
			});
		});

		describe("isProcessAction", () => {
			it("returns true for ProcessMdFile", () => {
				const action: VaultAction = {
					kind: VaultActionKind.ProcessMdFile,
					payload: { splitPath: mdFile("note"), transform: (c) => c },
				};
				expect(isProcessAction(action)).toBe(true);
			});

			it("returns false for UpsertMdFile", () => {
				const action: VaultAction = {
					kind: VaultActionKind.UpsertMdFile,
					payload: { splitPath: mdFile("note"), content: "" },
				};
				expect(isProcessAction(action)).toBe(false);
			});
		});

		describe("isFolderAction", () => {
			it("returns true for folder actions", () => {
				expect(isFolderAction({
					kind: VaultActionKind.CreateFolder,
					payload: { splitPath: folder("test") },
				})).toBe(true);
				expect(isFolderAction({
					kind: VaultActionKind.RenameFolder,
					payload: { from: folder("a"), to: folder("b") },
				})).toBe(true);
				expect(isFolderAction({
					kind: VaultActionKind.TrashFolder,
					payload: { splitPath: folder("test") },
				})).toBe(true);
			});

			it("returns false for file actions", () => {
				expect(isFolderAction({
					kind: VaultActionKind.UpsertMdFile,
					payload: { splitPath: mdFile("note"), content: "" },
				})).toBe(false);
			});
		});

		describe("isMdFileAction", () => {
			it("returns true for md file actions", () => {
				expect(isMdFileAction({
					kind: VaultActionKind.UpsertMdFile,
					payload: { splitPath: mdFile("note"), content: "" },
				})).toBe(true);
				expect(isMdFileAction({
					kind: VaultActionKind.ProcessMdFile,
					payload: { splitPath: mdFile("note"), transform: (c) => c },
				})).toBe(true);
			});
		});

		describe("isFileAction", () => {
			it("returns true for non-md file actions", () => {
				expect(isFileAction({
					kind: VaultActionKind.CreateFile,
					payload: { splitPath: file("img", "png") },
				})).toBe(true);
				expect(isFileAction({
					kind: VaultActionKind.RenameFile,
					payload: { from: file("a", "png"), to: file("b", "png") },
				})).toBe(true);
			});
		});
	});

	describe("Path Extraction", () => {
		describe("getActionPath", () => {
			it("extracts path from CreateFolder", () => {
				const action: VaultAction = {
					kind: VaultActionKind.CreateFolder,
					payload: { splitPath: folder("test", ["parent"]) },
				};
				expect(getActionPath(action)).toEqual(["parent", "test"]);
			});

			it("extracts path from UpsertMdFile", () => {
				const action: VaultAction = {
					kind: VaultActionKind.UpsertMdFile,
					payload: { splitPath: mdFile("note", ["docs"]), content: "" },
				};
				expect(getActionPath(action)).toEqual(["docs", "note.md"]);
			});

			it("extracts from path for RenameMdFile", () => {
				const action: VaultAction = {
					kind: VaultActionKind.RenameMdFile,
					payload: { from: mdFile("old", ["docs"]), to: mdFile("new", ["docs"]) },
				};
				expect(getActionPath(action)).toEqual(["docs", "old.md"]);
			});

			it("extracts path from CreateFile with extension", () => {
				const action: VaultAction = {
					kind: VaultActionKind.CreateFile,
					payload: { splitPath: file("image", "png", ["assets"]) },
				};
				expect(getActionPath(action)).toEqual(["assets", "image.png"]);
			});
		});

		describe("getRenameTargetPath", () => {
			it("returns to path for rename actions", () => {
				const action: VaultAction = {
					kind: VaultActionKind.RenameMdFile,
					payload: { from: mdFile("old", ["docs"]), to: mdFile("new", ["other"]) },
				};
				expect(getRenameTargetPath(action)).toEqual(["other", "new.md"]);
			});

			it("returns undefined for non-rename actions", () => {
				const action: VaultAction = {
					kind: VaultActionKind.CreateFolder,
					payload: { splitPath: folder("test") },
				};
				expect(getRenameTargetPath(action)).toBeUndefined();
			});
		});

		describe("getActionSplitPath", () => {
			it("returns splitPath for simple actions", () => {
				const splitPath = folder("test", ["parent"]);
				const action: VaultAction = {
					kind: VaultActionKind.CreateFolder,
					payload: { splitPath },
				};
				expect(getActionSplitPath(action)).toBe(splitPath);
			});

			it("returns from path for rename actions", () => {
				const from = mdFile("old", ["docs"]);
				const action: VaultAction = {
					kind: VaultActionKind.RenameMdFile,
					payload: { from, to: mdFile("new", ["docs"]) },
				};
				expect(getActionSplitPath(action)).toBe(from);
			});
		});

		describe("getParentPathParts", () => {
			it("returns pathParts from split path", () => {
				const action: VaultAction = {
					kind: VaultActionKind.UpsertMdFile,
					payload: { splitPath: mdFile("note", ["docs", "subdir"]), content: "" },
				};
				expect(getParentPathParts(action)).toEqual(["docs", "subdir"]);
			});
		});

		describe("getPathDepth", () => {
			it("counts path segments", () => {
				const action: VaultAction = {
					kind: VaultActionKind.CreateFolder,
					payload: { splitPath: folder("deep", ["a", "b", "c"]) },
				};
				expect(getPathDepth(action)).toBe(4); // a, b, c, deep
			});
		});
	});

	describe("Action Identification", () => {
		describe("getActionKey", () => {
			it("creates unique key from kind and path", () => {
				const action: VaultAction = {
					kind: VaultActionKind.CreateFolder,
					payload: { splitPath: folder("test", ["parent"]) },
				};
				expect(getActionKey(action)).toBe("CreateFolder:parent/test");
			});
		});

		describe("actionsSharePath", () => {
			it("returns true for same path", () => {
				const a: VaultAction = {
					kind: VaultActionKind.CreateFolder,
					payload: { splitPath: folder("test", ["parent"]) },
				};
				const b: VaultAction = {
					kind: VaultActionKind.TrashFolder,
					payload: { splitPath: folder("test", ["parent"]) },
				};
				expect(actionsSharePath(a, b)).toBe(true);
			});

			it("returns false for different paths", () => {
				const a: VaultAction = {
					kind: VaultActionKind.CreateFolder,
					payload: { splitPath: folder("test1", ["parent"]) },
				};
				const b: VaultAction = {
					kind: VaultActionKind.CreateFolder,
					payload: { splitPath: folder("test2", ["parent"]) },
				};
				expect(actionsSharePath(a, b)).toBe(false);
			});
		});
	});

	describe("Type Narrowing", () => {
		describe("asFolderAction", () => {
			it("returns action for folder actions", () => {
				const action: VaultAction = {
					kind: VaultActionKind.CreateFolder,
					payload: { splitPath: folder("test") },
				};
				expect(asFolderAction(action)).toBe(action);
			});

			it("returns undefined for non-folder actions", () => {
				const action: VaultAction = {
					kind: VaultActionKind.UpsertMdFile,
					payload: { splitPath: mdFile("note"), content: "" },
				};
				expect(asFolderAction(action)).toBeUndefined();
			});
		});

		describe("asMdFileAction", () => {
			it("returns action for md file actions", () => {
				const action: VaultAction = {
					kind: VaultActionKind.ProcessMdFile,
					payload: { splitPath: mdFile("note"), transform: (c) => c },
				};
				expect(asMdFileAction(action)).toBe(action);
			});
		});

		describe("asFileAction", () => {
			it("returns action for file actions", () => {
				const action: VaultAction = {
					kind: VaultActionKind.CreateFile,
					payload: { splitPath: file("img", "png") },
				};
				expect(asFileAction(action)).toBe(action);
			});
		});

		describe("asRenameAction", () => {
			it("returns action for rename actions", () => {
				const action: VaultAction = {
					kind: VaultActionKind.RenameFolder,
					payload: { from: folder("a"), to: folder("b") },
				};
				expect(asRenameAction(action)).toBe(action);
			});
		});
	});

	describe("Namespace Export", () => {
		it("exports all functions", () => {
			expect(ActionHelpers.isCreateAction).toBeDefined();
			expect(ActionHelpers.isRenameAction).toBeDefined();
			expect(ActionHelpers.isTrashAction).toBeDefined();
			expect(ActionHelpers.isProcessAction).toBeDefined();
			expect(ActionHelpers.isFolderAction).toBeDefined();
			expect(ActionHelpers.isMdFileAction).toBeDefined();
			expect(ActionHelpers.isFileAction).toBeDefined();
			expect(ActionHelpers.getActionPath).toBeDefined();
			expect(ActionHelpers.getRenameTargetPath).toBeDefined();
			expect(ActionHelpers.getActionSplitPath).toBeDefined();
			expect(ActionHelpers.getParentPathParts).toBeDefined();
			expect(ActionHelpers.getPathDepth).toBeDefined();
			expect(ActionHelpers.getActionKey).toBeDefined();
			expect(ActionHelpers.actionsSharePath).toBeDefined();
			expect(ActionHelpers.asFolderAction).toBeDefined();
			expect(ActionHelpers.asMdFileAction).toBeDefined();
			expect(ActionHelpers.asFileAction).toBeDefined();
			expect(ActionHelpers.asRenameAction).toBeDefined();
		});
	});
});
