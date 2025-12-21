import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { TreeNodeStatus, TreeNodeType } from "../../../../src/commanders/librarian/types/tree-node";
import {
	buildCanonicalBasenameFromTree,
	buildCanonicalPathFromTree,
	,
} from "../../../../src/commanders/librarian/utils/tree-path-utils";
import * as globalState from "../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../src/global-state/parsed-settings";
import { SplitPathType } from "../../../../src/obsidian-vault-action-manager/types/split-path";

// Default settings for tests
const defaultSettings: ParsedUserSettings = {
	splitPathToLibraryRoot: {
		basename: "Library",
		pathParts: [],
		type: SplitPathType.Folder,
	},
	suffixDelimiter: "-",
};

describe("buildCanonicalPathFromTree", () => {
	let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		getParsedUserSettingsSpy = spyOn(globalState, "getParsedUserSettings").mockReturnValue({
			...defaultSettings,
		});
	});

	afterEach(() => {
		getParsedUserSettingsSpy.mockRestore();
	});

	it("builds canonical path for root-level file", () => {
		const leaf = {
			coreName: "Note",
			coreNameChainToParent: [],
			extension: "md",
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Scroll,
		};

		const result = buildCanonicalPathFromTree(leaf);

		expect(result).toBe("Library/Note.md");
	});

	it("builds canonical path with suffix in basename", () => {
		const leaf = {
			coreName: "Note",
			coreNameChainToParent: ["A", "B"],
			extension: "md",
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Scroll,
		};

		const result = buildCanonicalPathFromTree(leaf);

		expect(result).toBe("Library/A/B/Note-B-A.md");
	});

	it("uses custom suffix delimiter", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			splitPathToLibraryRoot: {
				basename: "Library",
				pathParts: [],
				type: SplitPathType.Folder,
			},
			suffixDelimiter: "_",
		});

		const leaf = {
			coreName: "Note",
			coreNameChainToParent: ["A", "B"],
			extension: "md",
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Scroll,
		};

		const result = buildCanonicalPathFromTree(leaf);

		expect(result).toBe("Library/A/B/Note_B_A.md");
	});

	it("handles library root with path parts", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			splitPathToLibraryRoot: {
				basename: "child",
				pathParts: ["parent"],
				type: SplitPathType.Folder,
			},
			suffixDelimiter: "-",
		});

		const leaf = {
			coreName: "Note",
			coreNameChainToParent: ["A"],
			extension: "md",
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Scroll,
		};

		const result = buildCanonicalPathFromTree(leaf);

		expect(result).toBe("parent/child/A/Note-A.md");
	});
});

describe("buildCanonicalBasenameFromTree", () => {
	let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		getParsedUserSettingsSpy = spyOn(globalState, "getParsedUserSettings").mockReturnValue({
			...defaultSettings,
		});
	});

	afterEach(() => {
		getParsedUserSettingsSpy.mockRestore();
	});

	it("builds canonical basename for root-level file", () => {
		const leaf = {
			coreName: "Note",
			coreNameChainToParent: [],
			extension: "md",
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Scroll,
		};

		const result = buildCanonicalBasenameFromTree(leaf);

		expect(result).toBe("Note");
	});

	it("builds canonical basename with reversed path as suffix", () => {
		const leaf = {
			coreName: "Note",
			coreNameChainToParent: ["A", "B"],
			extension: "md",
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Scroll,
		};

		const result = buildCanonicalBasenameFromTree(leaf);

		expect(result).toBe("Note-B-A");
	});

	it("uses custom suffix delimiter", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			splitPathToLibraryRoot: {
				basename: "Library",
				pathParts: [],
				type: SplitPathType.Folder,
			},
			suffixDelimiter: "_",
		});

		const leaf = {
			coreName: "Note",
			coreNameChainToParent: ["A", "B"],
			extension: "md",
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Scroll,
		};

		const result = buildCanonicalBasenameFromTree(leaf);

		expect(result).toBe("Note_B_A");
	});

	it("handles single parent folder", () => {
		const leaf = {
			coreName: "Note",
			coreNameChainToParent: ["Parent"],
			extension: "md",
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Scroll,
		};

		const result = buildCanonicalBasenameFromTree(leaf);

		expect(result).toBe("Note-Parent");
	});
});

