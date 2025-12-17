import type { TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import { TreeNodeStatus, TreeNodeType } from "../../../../src/commanders/librarian/types/tree-node";
import { splitPathToLeaf } from "../../../../src/commanders/librarian/utils/split-path-to-leaf";
import type {
	SplitPathToFileWithTRef,
	SplitPathToMdFileWithTRef,
} from "../../../../src/obsidian-vault-action-manager/types/split-path";

const fakeTFile = null as unknown as TFile;

describe("splitPathToLeaf", () => {
	describe("MdFile → ScrollNode", () => {
		it("converts MdFile to ScrollNode with correct coreNameChainToParent", () => {
			const input: SplitPathToMdFileWithTRef = {
				basename: "Note-child-parent",
				extension: "md",
				pathParts: ["Library", "parent", "child"],
				tRef: fakeTFile,
				type: "MdFile",
			};

			const result = splitPathToLeaf(input, "Library", "-");

			expect(result).toEqual({
				coreName: "Note",
				coreNameChainToParent: ["parent", "child"],
				status: TreeNodeStatus.NotStarted,
				tRef: fakeTFile,
				type: TreeNodeType.Scroll,
			});
		});

		it("strips root folder from pathParts", () => {
			const input: SplitPathToMdFileWithTRef = {
				basename: "E1-S1-Avarar",
				extension: "md",
				pathParts: ["Library", "Avarar", "S1"],
				tRef: fakeTFile,
				type: "MdFile",
			};

			const result = splitPathToLeaf(input, "Library", "-");

			expect(result.coreNameChainToParent).toEqual(["Avarar", "S1"]);
		});

		it("handles root-level file (no parent folders)", () => {
			const input: SplitPathToMdFileWithTRef = {
				basename: "RootNote",
				extension: "md",
				pathParts: ["Library"],
				tRef: fakeTFile,
				type: "MdFile",
			};

			const result = splitPathToLeaf(input, "Library", "-");

			expect(result.coreNameChainToParent).toEqual([]);
			expect(result.coreName).toBe("RootNote");
		});

		it("keeps pathParts if root folder name doesn't match", () => {
			const input: SplitPathToMdFileWithTRef = {
				basename: "Note",
				extension: "md",
				pathParts: ["Other", "folder"],
				tRef: fakeTFile,
				type: "MdFile",
			};

			const result = splitPathToLeaf(input, "Library", "-");

			expect(result.coreNameChainToParent).toEqual(["Other", "folder"]);
		});
	});

	describe("File → FileNode", () => {
		it("converts File to FileNode with Unknown status", () => {
			const input: SplitPathToFileWithTRef = {
				basename: "document-2025-Pekar",
				extension: "pdf",
				pathParts: ["Library", "doc", "Pekar", "2025"],
				tRef: fakeTFile,
				type: "File",
			};

			const result = splitPathToLeaf(input, "Library", "-");

			expect(result).toEqual({
				coreName: "document",
				coreNameChainToParent: ["doc", "Pekar", "2025"],
				status: TreeNodeStatus.Unknown,
				tRef: fakeTFile,
				type: TreeNodeType.File,
			});
		});
	});

	describe("basename parsing", () => {
		it("extracts coreName before first delimiter", () => {
			const input: SplitPathToMdFileWithTRef = {
				basename: "The_Title-folder1-folder2",
				extension: "md",
				pathParts: ["Library"],
				tRef: fakeTFile,
				type: "MdFile",
			};

			const result = splitPathToLeaf(input, "Library", "-");

			expect(result.coreName).toBe("The_Title");
		});

		it("uses full basename when no delimiter", () => {
			const input: SplitPathToMdFileWithTRef = {
				basename: "SimpleNote",
				extension: "md",
				pathParts: ["Library"],
				tRef: fakeTFile,
				type: "MdFile",
			};

			const result = splitPathToLeaf(input, "Library", "-");

			expect(result.coreName).toBe("SimpleNote");
		});

		it("respects custom delimiter", () => {
			const input: SplitPathToMdFileWithTRef = {
				basename: "Note_suffix1_suffix2",
				extension: "md",
				pathParts: ["Library"],
				tRef: fakeTFile,
				type: "MdFile",
			};

			const result = splitPathToLeaf(input, "Library", "_");

			expect(result.coreName).toBe("Note");
		});
	});
});
