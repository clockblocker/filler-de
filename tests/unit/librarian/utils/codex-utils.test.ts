import { spyOn } from "bun:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TreeNode } from "../../../../src/commanders/librarian/types/tree-node";
import { TreeNodeStatus, TreeNodeType } from "../../../../src/commanders/librarian/types/tree-node";
import {
	addCodexPrefix,
	buildCodexBasename,
	isBasenamePrefixedAsCodex,
} from "../../../../src/commanders/librarian/utils/codex-utils";
import * as globalState from "../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../src/global-state/parsed-settings";
import type { SplitPathToFolder, SplitPathToMdFile } from "../../../../src/obsidian-vault-action-manager/types/split-path";
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

describe("codex-utils", () => {
	beforeEach(() => {
		getParsedUserSettingsSpy = spyOn(globalState, "getParsedUserSettings").mockReturnValue({
			...defaultSettings,
		});
	});

	afterEach(() => {
		getParsedUserSettingsSpy.mockRestore();
	});

	describe("isCodexBasename", () => {
		it("returns true for codex basename", () => {
			expect(isBasenamePrefixedAsCodex("__Library")).toBe(true);
			expect(isBasenamePrefixedAsCodex("__A")).toBe(true);
			expect(isBasenamePrefixedAsCodex("__Section")).toBe(true);
		});

		it("returns false for non-codex basename", () => {
			expect(isBasenamePrefixedAsCodex("Note")).toBe(false);
			expect(isBasenamePrefixedAsCodex("_Note")).toBe(false); // single underscore
			expect(isBasenamePrefixedAsCodex("My__File")).toBe(false); // __ not at start
		});
	});

	describe("withCodexPrefix", () => {
		it("adds __ prefix", () => {
			expect(addCodexPrefix("Library")).toBe("__Library");
			expect(addCodexPrefix("A")).toBe("__A");
		});
	});

	describe("buildCodexBasename", () => {
		describe("with TreeNode Section", () => {
			it("builds root codex basename (no suffix)", () => {
				const rootSection: TreeNode = {
					children: [],
					coreName: "Library",
					coreNameChainToParent: [],
					status: TreeNodeStatus.NotStarted,
					type: TreeNodeType.Section,
				};
				expect(buildCodexBasename(rootSection)).toBe("__Library");
			});

			it("builds nested codex basename with single parent", () => {
				const section: TreeNode = {
					children: [],
					coreName: "Child",
					coreNameChainToParent: ["Parent"],
					status: TreeNodeStatus.NotStarted,
					type: TreeNodeType.Section,
				};
				expect(buildCodexBasename(section)).toBe("__Child-Parent");
			});

			it("builds nested codex basename with multiple parents", () => {
				const section: TreeNode = {
					children: [],
					coreName: "Grandchild",
					coreNameChainToParent: ["Parent", "Child"],
					status: TreeNodeStatus.NotStarted,
					type: TreeNodeType.Section,
				};
				expect(buildCodexBasename(section)).toBe("__Grandchild-Child-Parent");
			});
		});

		describe("with TreeNode Scroll/File", () => {
			it("builds codex for root section when file is in root", () => {
				const scroll: TreeNode = {
					coreName: "Note",
					coreNameChainToParent: [],
					extension: "md",
					status: TreeNodeStatus.NotStarted,
					type: TreeNodeType.Scroll,
				};
				expect(buildCodexBasename(scroll)).toBe("__Library");
			});

			it("builds codex for parent section when file is nested", () => {
				const scroll: TreeNode = {
					coreName: "Note",
					coreNameChainToParent: ["Parent", "Child"],
					extension: "md",
					status: TreeNodeStatus.NotStarted,
					type: TreeNodeType.Scroll,
				};
				// Parent section is "Child" (last in chain)
				expect(buildCodexBasename(scroll)).toBe("__Child-Parent");
			});

			it("builds codex for parent section with file node", () => {
				const file: TreeNode = {
					coreName: "Image",
					coreNameChainToParent: ["Section"],
					extension: "png",
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.File,
				};
				expect(buildCodexBasename(file)).toBe("__Section");
			});
		});

		describe("with SplitPath Folder", () => {
			it("builds codex for root folder", () => {
				const folder: SplitPathToFolder = {
					basename: "Library",
					pathParts: ["Library"],
					type: SplitPathType.Folder,
				};
				expect(buildCodexBasename(folder)).toBe("__Library");
			});

			it("builds codex for nested folder", () => {
				const folder: SplitPathToFolder = {
					basename: "Child",
					pathParts: ["Library", "Parent", "Child"],
					type: SplitPathType.Folder,
				};
				expect(buildCodexBasename(folder)).toBe("__Child-Parent");
			});
		});

		describe("with SplitPath File", () => {
			it("builds codex for root section when file is in root", () => {
				const file: SplitPathToMdFile = {
					basename: "Note",
					extension: "md",
					pathParts: ["Library"],
					type: SplitPathType.MdFile,
				};
				expect(buildCodexBasename(file)).toBe("__Library");
			});

			it("builds codex for parent section when file is nested", () => {
				const file: SplitPathToMdFile = {
					basename: "Note",
					extension: "md",
					pathParts: ["Library", "Parent", "Child"],
					type: SplitPathType.MdFile,
				};
				// Parent section is "Child" (last in pathParts)
				expect(buildCodexBasename(file)).toBe("__Child-Parent");
			});
		});

		describe("with different delimiters", () => {
			it("uses custom delimiter", () => {
				getParsedUserSettingsSpy.mockReturnValue({
					...defaultSettings,
					suffixDelimiter: "_",
				});
				const section: TreeNode = {
					children: [],
					coreName: "Child",
					coreNameChainToParent: ["Parent"],
					status: TreeNodeStatus.NotStarted,
					type: TreeNodeType.Section,
				};
				expect(buildCodexBasename(section)).toBe("__Child_Parent");
			});
		});
	});
});
