import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { TreeNodeStatus, TreeNodeType } from "../../../../src/commanders/librarian/types/tree-node";
import { splitPathToLeafDeprecated } from "../../../../src/commanders/librarian/utils/split-path-to-leaf";
import * as globalState from "../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../src/global-state/parsed-settings";
import type {
	SplitPathToFile,
	SplitPathToMdFile,
} from "../../../../src/obsidian-vault-action-manager/types/split-path";
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

describe("splitPathToLeaf", () => {
	describe("MdFile → ScrollNode", () => {
		it("converts MdFile to ScrollNode with correct coreNameChainToParent", () => {
			const input: SplitPathToMdFile = {
				basename: "Note-child-parent",
				extension: "md",
				pathParts: ["Library", "parent", "child"],
				type: "MdFile",
			};

			const result = splitPathToLeafDeprecated(input);

			expect(result).toEqual({
				coreName: "Note",
				coreNameChainToParent: ["parent", "child"],
				extension: "md",
				status: TreeNodeStatus.NotStarted,
				type: TreeNodeType.Scroll,
			});
		});

		it("strips root folder from pathParts", () => {
			const input: SplitPathToMdFile = {
				basename: "E1-S1-Avarar",
				extension: "md",
				pathParts: ["Library", "Avarar", "S1"],
				type: "MdFile",
			};

			const result = splitPathToLeafDeprecated(input);

			expect(result.coreNameChainToParent).toEqual(["Avarar", "S1"]);
		});

		it("handles root-level file (no parent folders)", () => {
			const input: SplitPathToMdFile = {
				basename: "RootNote",
				extension: "md",
				pathParts: ["Library"],
				type: "MdFile",
			};

			const result = splitPathToLeafDeprecated(input);

			expect(result.coreNameChainToParent).toEqual([]);
			expect(result.coreName).toBe("RootNote");
		});

		it("keeps pathParts if root folder name doesn't match", () => {
			const input: SplitPathToMdFile = {
				basename: "Note",
				extension: "md",
				pathParts: ["Other", "folder"],
				type: "MdFile",
			};

			const result = splitPathToLeafDeprecated(input);

			expect(result.coreNameChainToParent).toEqual(["Other", "folder"]);
		});
	});

	describe("File → FileNode", () => {
		it("converts File to FileNode with Unknown status", () => {
			const input: SplitPathToFile = {
				basename: "document-2025-Pekar",
				extension: "pdf",
				pathParts: ["Library", "doc", "Pekar", "2025"],
				type: "File",
			};

			const result = splitPathToLeafDeprecated(input);

			expect(result).toEqual({
				coreName: "document",
				coreNameChainToParent: ["doc", "Pekar", "2025"],
				extension: "pdf",
				status: TreeNodeStatus.Unknown,
				type: TreeNodeType.File,
			});
		});
	});

	describe("basename parsing", () => {
		it("extracts coreName before first delimiter", () => {
			const input: SplitPathToMdFile = {
				basename: "The_Title-folder1-folder2",
				extension: "md",
				pathParts: ["Library"],
				type: "MdFile",
			};

			const result = splitPathToLeafDeprecated(input);

			expect(result.coreName).toBe("The_Title");
		});

		it("uses full basename when no delimiter", () => {
			const input: SplitPathToMdFile = {
				basename: "SimpleNote",
				extension: "md",
				pathParts: ["Library"],
				type: "MdFile",
			};

			const result = splitPathToLeafDeprecated(input);

			expect(result.coreName).toBe("SimpleNote");
		});

		it("respects custom delimiter", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				suffixDelimiter: "_",
			});
			const input: SplitPathToMdFile = {
				basename: "Note_suffix1_suffix2",
				extension: "md",
				pathParts: ["Library"],
				type: "MdFile",
			};

			const result = splitPathToLeafDeprecated(input);

			expect(result.coreName).toBe("Note");
		});
	});
});
