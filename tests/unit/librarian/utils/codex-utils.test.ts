import { spyOn } from "bun:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildCodexBasenameDeprecated, tryExtractingNodeNameChainToSection, tryExtractingSplitPathToParentFolderDeprecated } from "../../../../src/commanders/librarian-old/naming/interface";
import type { TreeNode } from "../../../../src/commanders/librarin-shared/types/tree-node";
import { TreeNodeStatus, TreeNodeType } from "../../../../src/commanders/librarin-shared/types/tree-node";
import * as globalState from "../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../src/global-state/parsed-settings";
import type { SplitPathToFolder } from "../../../../src/obsidian-vault-action-manager/types/split-path";
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

	describe("buildCodexBasename", () => {
		describe("with TreeNode Section", () => {
			it("builds root codex basename (no suffix)", () => {
				const rootSection: TreeNode = {
					children: [],
					nodeName: "Library",
					nodeNameChainToParent: [],
					status: TreeNodeStatus.NotStarted,
					type: TreeNodeType.Section,
				};
				expect(buildCodexBasenameDeprecated(rootSection)).toBe("__-Library");
			});

			it("builds nested codex basename with single parent", () => {
				const section: TreeNode = {
					children: [],
					nodeName: "Child",
					nodeNameChainToParent: ["Parent"],
					status: TreeNodeStatus.NotStarted,
					type: TreeNodeType.Section,
				};
				expect(buildCodexBasenameDeprecated(section)).toBe("__-Child-Parent");
			});

			it("builds nested codex basename with multiple parents", () => {
				const section: TreeNode = {
					children: [],
					nodeName: "Grandchild",
					nodeNameChainToParent: ["Parent", "Child"],
					status: TreeNodeStatus.NotStarted,
					type: TreeNodeType.Section,
				};
				expect(buildCodexBasenameDeprecated(section)).toBe("__-Grandchild-Child-Parent");
			});
		});
		
		describe("with SplitPath Folder", () => {
			it("builds codex for root folder", () => {
				const folder: SplitPathToFolder = {
					basename: "Library",
					pathParts: [],
					type: SplitPathType.Folder,
				};
				expect(buildCodexBasenameDeprecated(folder)).toBe("__-Library");
			});

			it("builds codex for nested folder", () => {
				const folder: SplitPathToFolder = {
					basename: "Child",
					pathParts: ["Library", "Parent"],
					type: SplitPathType.Folder,
				};
				expect(buildCodexBasenameDeprecated(folder)).toBe("__-Child-Parent");
			});
		});

		describe("with different delimiters", () => {
			it("uses custom delimiter", () => {
				getParsedUserSettingsSpy.mockReturnValue({
					...defaultSettings,
					suffixDelimiter: ";;",
				});
				const section: TreeNode = {
					children: [],
					nodeName: "Child",
					nodeNameChainToParent: ["Parent"],
					status: TreeNodeStatus.NotStarted,
					type: TreeNodeType.Section,
				};
				expect(buildCodexBasenameDeprecated(section)).toBe("__;;Child;;Parent");
			});
		});
	});

	describe("tryExtractingNodeNameChainToSection", () => {
		it("returns empty array for root codex", () => {
			const result = tryExtractingNodeNameChainToSection("__-Library");
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toEqual([]);
			}
		});

		it("returns chain for nested codex with single parent", () => {
			const result = tryExtractingNodeNameChainToSection("__-Child-Parent");
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toEqual(["Parent", "Child"]);
			}
		});

		it("returns chain for nested codex with multiple parents", () => {
			const result = tryExtractingNodeNameChainToSection("__-Grandchild-Child-Parent");
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toEqual(["Parent", "Child", "Grandchild"]);
			}
		});

		it("returns error for non-codex basename", () => {
			const result = tryExtractingNodeNameChainToSection("Note");
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error).toContain('Invalid codex basename: "Note"');
				expect(result.error).toContain('must start with "__"');
			}
		});

		it("handles different delimiters", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				suffixDelimiter: ";;",
			});
			const result = tryExtractingNodeNameChainToSection("__;;Child;;Parent");
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toEqual(["Parent", "Child"]);
			}
		});
	});

	describe("tryExtractingSplitPathToFolder", () => {
		it("builds SplitPath for root folder", () => {
			const result = tryExtractingSplitPathToParentFolderDeprecated("__-Library");
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toEqual({
					basename: "Library",
					pathParts: [],
					type: SplitPathType.Folder,
				});
			}
		});

		it("builds SplitPath for nested folder", () => {
			const result = tryExtractingSplitPathToParentFolderDeprecated("__-Child-Parent");
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toEqual({
					basename: "Child",
					pathParts: ["Library", "Parent"],
					type: SplitPathType.Folder,
				});
			}
		});

		it("builds SplitPath for deeply nested folder", () => {
			const result = tryExtractingSplitPathToParentFolderDeprecated("__-Grandchild-Child-Parent");
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toEqual({
					basename: "Grandchild",
					pathParts: ["Library", "Parent", "Child"],
					type: SplitPathType.Folder,
				});
			}
		});

		it("returns error for non-codex basename", () => {
			const result = tryExtractingSplitPathToParentFolderDeprecated("Note");
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error).toContain('Invalid codex basename: "Note"');
				expect(result.error).toContain('must start with "__"');
			}
		});
	});
});
