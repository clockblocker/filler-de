import { describe, expect, it } from "vitest";
import {
	type TranslationContext,
	translateVaultAction,
} from "../../../../src/commanders/librarian/reconciliation/vault-to-tree";
import { TreeActionType } from "../../../../src/commanders/librarian/types/literals";
import { TreeNodeStatus, TreeNodeType } from "../../../../src/commanders/librarian/types/tree-node";
import type { VaultAction } from "../../../../src/obsidian-vault-action-manager/types/vault-action";

const defaultContext: TranslationContext = {
	libraryRoot: "Library",
	suffixDelimiter: "-",
};

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

			const result = translateVaultAction(action, defaultContext);

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

			const result = translateVaultAction(action, defaultContext);

			expect(result?.payload).toMatchObject({
				coreName: "TopLevel",
				coreNameChainToParent: [],
			});
		});
	});

	describe("CreateMdFile → CreateNode(Scroll)", () => {
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
				type: "CreateMdFile",
			};

			const result = translateVaultAction(action, defaultContext);

			expect(result).toEqual({
				payload: {
					coreName: "Note",
					coreNameChainToParent: ["A", "B"],
					nodeType: TreeNodeType.Scroll,
					status: TreeNodeStatus.NotStarted,
					extension: "md",
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

			const result = translateVaultAction(action, defaultContext);

			expect(result).toEqual({
				payload: {
					coreName: "doc",
					coreNameChainToParent: ["A"],
					nodeType: TreeNodeType.File,
					status: TreeNodeStatus.Unknown,
					extension: "pdf",
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

			const result = translateVaultAction(action, defaultContext);

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

			const result = translateVaultAction(action, defaultContext);

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

			const result = translateVaultAction(action, defaultContext);

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

			const result = translateVaultAction(action, defaultContext);

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

			const result = translateVaultAction(action, defaultContext);

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

			const result = translateVaultAction(action, defaultContext);

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

			const result = translateVaultAction(action, defaultContext);

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

			const result = translateVaultAction(action, defaultContext);

			expect(result).toBeNull();
		});
	});
});
