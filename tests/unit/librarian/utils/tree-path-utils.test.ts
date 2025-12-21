import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { TreeLeaf } from "../../../../src/commanders/librarian/types/tree-leaf";
import { TreeNodeStatus, TreeNodeType } from "../../../../src/commanders/librarian/types/tree-node";
import {
	buildCanonicalBasenameForLeaf,
	buildCanonicalPathForLeaf,
} from "../../../../src/commanders/librarian/utils/tree-path-utils";
import * as globalState from "../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../src/global-state/parsed-settings";
import { SplitPathType } from "../../../../src/obsidian-vault-action-manager/types/split-path";

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

describe("buildCanonicalPathFromTree", () => {

	it("builds canonical path for root-level file", () => {
		const leaf: TreeLeaf = {
			coreName: "Note",
			coreNameChainToParent: [],
			extension: "md",
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Scroll,
		};

		const result = buildCanonicalPathForLeaf(leaf);

		expect(result).toBe("Library/Note.md");
	});

	it("builds canonical path with suffix in basename", () => {
		const leaf: TreeLeaf = {
			coreName: "Note",
			coreNameChainToParent: ["A", "B"],
			extension: "md",
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Scroll,
		};

		const result = buildCanonicalPathForLeaf(leaf);

		expect(result).toBe("Library/A/B/Note-B-A.md");
	});

	it("uses custom suffix delimiter", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			...defaultSettings,
			suffixDelimiter: "_",
		});

		const leaf: TreeLeaf = {
			coreName: "Note",
			coreNameChainToParent: ["A", "B"],
			extension: "md",
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Scroll,
		};

		const result = buildCanonicalPathForLeaf(leaf);

		expect(result).toBe("Library/A/B/Note_B_A.md");
	});

	it("handles library root with path parts", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			...defaultSettings,
			splitPathToLibraryRoot: {
				basename: "child",
				pathParts: ["parent"],
				type: SplitPathType.Folder,
			},
		});

		const leaf: TreeLeaf = {
			coreName: "Note",
			coreNameChainToParent: ["A"],
			extension: "md",
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Scroll,
		};

		const result = buildCanonicalPathForLeaf(leaf);

		expect(result).toBe("parent/child/A/Note-A.md");
	});
});

describe("buildCanonicalBasenameFromTree", () => {

	it("builds canonical basename for root-level file", () => {
		const leaf: TreeLeaf = {
			coreName: "Note",
			coreNameChainToParent: [],
			extension: "md",
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Scroll,
		};

		const result = buildCanonicalBasenameForLeaf(leaf);

		expect(result).toBe("Note");
	});

	it("builds canonical basename with reversed path as suffix", () => {
		const leaf: TreeLeaf = {
			coreName: "Note",
			coreNameChainToParent: ["A", "B"],
			extension: "md",
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Scroll,
		};

		const result = buildCanonicalBasenameForLeaf(leaf);

		expect(result).toBe("Note-B-A");
	});

	it("uses custom suffix delimiter", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			...defaultSettings,
			suffixDelimiter: "_",
		});

		const leaf: TreeLeaf = {
			coreName: "Note",
			coreNameChainToParent: ["A", "B"],
			extension: "md",
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Scroll,
		};

		const result = buildCanonicalBasenameForLeaf(leaf);

		expect(result).toBe("Note_B_A");
	});

	it("handles single parent folder", () => {
		const leaf: TreeLeaf = {
			coreName: "Note",
			coreNameChainToParent: ["Parent"],
			extension: "md",
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Scroll,
		};

		const result = buildCanonicalBasenameForLeaf(leaf);

		expect(result).toBe("Note-Parent");
	});
});

