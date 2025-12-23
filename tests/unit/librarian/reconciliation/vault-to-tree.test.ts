import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { translateVaultAction } from "../../../../src/commanders/librarian/reconciliation/vault-to-tree";
import { TreeActionType } from "../../../../src/commanders/librarian/types/literals";
import { TreeNodeStatus, TreeNodeType } from "../../../../src/commanders/librarian/types/tree-node";
import * as globalState from "../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../src/global-state/parsed-settings";
import { SplitPathType } from "../../../../src/obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../../src/obsidian-vault-action-manager/types/vault-action";

// Default settings for tests
const defaultSettings: ParsedUserSettings = {
	apiProvider: "google",
	googleApiKey: "",
	maxSectionDepth: 4,
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

describe("translateVaultAction", () => {
	describe("CreateFolder → CreateNode(Section)", () => {
		it("creates section at correct path", () => {
			const action: VaultAction = {
				payload: {
					splitPath: {
						basename: "MyFolder",
						pathParts: ["Library", "Parent"],
						type: "Folder",
					},
				},
				type: "CreateFolder",
			};

			const result = translateVaultAction(action);

			expect(result).toEqual({
				payload: {
					coreName: "MyFolder",
					coreNameChainToParent: ["Parent"],
					nodeType: TreeNodeType.Section,
					status: TreeNodeStatus.NotStarted,
				},
				type: TreeActionType.CreateNode,
			});
		});

		it("handles root-level folder", () => {
			const action: VaultAction = {
				payload: {
					splitPath: {
						basename: "TopLevel",
						pathParts: ["Library"],
						type: "Folder",
					},
				},
				type: "CreateFolder",
			};

			const result = translateVaultAction(action);

			expect(result?.payload).toMatchObject({
				coreName: "TopLevel",
				coreNameChainToParent: [],
			});
		});
	});

	describe("UpsertMdFile → CreateNode(Scroll)", () => {
		it("creates scroll at correct path", () => {
			const action: VaultAction = {
				payload: {
					splitPath: {
						basename: "Note",
						extension: "md",
						pathParts: ["Library", "A", "B"],
						type: "MdFile",
					},
				},
				type: "UpsertMdFile",
			};

			const result = translateVaultAction(action);

			expect(result).toEqual({
				payload: {
					coreName: "Note",
					coreNameChainToParent: ["A", "B"],
					extension: "md",
					nodeType: TreeNodeType.Scroll,
					status: TreeNodeStatus.NotStarted,
				},
				type: TreeActionType.CreateNode,
			});
		});
	});

	describe("CreateFile → CreateNode(File)", () => {
		it("creates file node", () => {
			const action: VaultAction = {
				payload: {
					splitPath: {
						basename: "doc",
						extension: "pdf",
						pathParts: ["Library", "A"],
						type: "File",
					},
				},
				type: "CreateFile",
			};

			const result = translateVaultAction(action);

			expect(result).toEqual({
				payload: {
					coreName: "doc",
					coreNameChainToParent: ["A"],
					extension: "pdf",
					nodeType: TreeNodeType.File,
					status: TreeNodeStatus.Unknown,
				},
				type: TreeActionType.CreateNode,
			});
		});
	});

	describe("Trash* → DeleteNode", () => {
		it("TrashFolder creates delete action", () => {
			const action: VaultAction = {
				payload: {
					splitPath: {
						basename: "ToDelete",
						pathParts: ["Library", "Parent"],
						type: "Folder",
					},
				},
				type: "TrashFolder",
			};

			const result = translateVaultAction(action);

			expect(result).toEqual({
				payload: {
					coreNameChain: ["Parent", "ToDelete"],
				},
				type: TreeActionType.DeleteNode,
			});
		});

		it("TrashMdFile creates delete action", () => {
			const action: VaultAction = {
				payload: {
					splitPath: {
						basename: "Note",
						extension: "md",
						pathParts: ["Library", "A"],
						type: "MdFile",
					},
				},
				type: "TrashMdFile",
			};

			const result = translateVaultAction(action);

			expect(result).toEqual({
				payload: {
					coreNameChain: ["A", "Note"],
				},
				type: TreeActionType.DeleteNode,
			});
		});
	});

	describe("Rename* same folder → ChangeNodeName", () => {
		it("RenameMdFile in same folder", () => {
			const action: VaultAction = {
				payload: {
					from: {
						basename: "OldName",
						extension: "md",
						pathParts: ["Library", "A"],
						type: "MdFile",
					},
					to: {
						basename: "NewName",
						extension: "md",
						pathParts: ["Library", "A"],
						type: "MdFile",
					},
				},
				type: "RenameMdFile",
			};

			const result = translateVaultAction(action);

			expect(result).toEqual({
				payload: {
					coreNameChain: ["A", "OldName"],
					newCoreName: "NewName",
				},
				type: TreeActionType.ChangeNodeName,
			});
		});

		it("RenameFolder in same parent", () => {
			const action: VaultAction = {
				payload: {
					from: {
						basename: "OldFolder",
						pathParts: ["Library", "Parent"],
						type: "Folder",
					},
					to: {
						basename: "NewFolder",
						pathParts: ["Library", "Parent"],
						type: "Folder",
					},
				},
				type: "RenameFolder",
			};

			const result = translateVaultAction(action);

			expect(result).toEqual({
				payload: {
					coreNameChain: ["Parent", "OldFolder"],
					newCoreName: "NewFolder",
				},
				type: TreeActionType.ChangeNodeName,
			});
		});
	});

	describe("Rename* diff folder → MoveNode", () => {
		it("RenameMdFile to different folder", () => {
			const action: VaultAction = {
				payload: {
					from: {
						basename: "Note",
						extension: "md",
						pathParts: ["Library", "A"],
						type: "MdFile",
					},
					to: {
						basename: "Note",
						extension: "md",
						pathParts: ["Library", "B", "C"],
						type: "MdFile",
					},
				},
				type: "RenameMdFile",
			};

			const result = translateVaultAction(action);

			expect(result).toEqual({
				payload: {
					coreNameChain: ["A", "Note"],
					newCoreNameChainToParent: ["B", "C"],
				},
				type: TreeActionType.MoveNode,
			});
		});

		it("RenameFolder to different parent", () => {
			const action: VaultAction = {
				payload: {
					from: {
						basename: "Folder",
						pathParts: ["Library", "A"],
						type: "Folder",
					},
					to: {
						basename: "Folder",
						pathParts: ["Library", "B"],
						type: "Folder",
					},
				},
				type: "RenameFolder",
			};

			const result = translateVaultAction(action);

			expect(result).toEqual({
				payload: {
					coreNameChain: ["A", "Folder"],
					newCoreNameChainToParent: ["B"],
				},
				type: TreeActionType.MoveNode,
			});
		});
	});

	describe("Content operations → null", () => {
		it("ProcessMdFile returns null", () => {
			const action: VaultAction = {
				payload: {
					splitPath: {
						basename: "Note",
						extension: "md",
						pathParts: ["Library"],
						type: "MdFile",
					},
					transform: (c) => c,
				},
				type: "ProcessMdFile",
			};

			const result = translateVaultAction(action);

			expect(result).toBeNull();
		});

		it("ReplaceContentMdFile returns null", () => {
			const action: VaultAction = {
				payload: {
					content: "new content",
					splitPath: {
						basename: "Note",
						extension: "md",
						pathParts: ["Library"],
						type: "MdFile",
					},
				},
				type: "ReplaceContentMdFile",
			};

			const result = translateVaultAction(action);

			expect(result).toBeNull();
		});
	});
});
