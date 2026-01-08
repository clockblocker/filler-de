import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { TreeLeafDeprecated } from "../../../../src/commanders/librarian-old/types/tree-node";
import { TreeNodeStatusDeprecated, TreeNodeTypeDeprecated } from "../../../../src/commanders/librarian-old/types/tree-node";
import {
	buildCanonicalBasenameForLeaf,
	buildCanonicalPathForLeaf,
} from "../../../../src/commanders/librarian-old/utils/tree-path-utils";
import * as globalState from "../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../src/global-state/parsed-settings";
import { SplitPathType } from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";

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

describe("buildCanonicalPathFromTree", () => {

	it("builds canonical path for root-level file", () => {
		const leaf: TreeLeafDeprecated = {
			extension: "md",
			nodeName: "Note",
			nodeNameChainToParent: ["Library"],
			status: TreeNodeStatusDeprecated.NotStarted,
			type: TreeNodeTypeDeprecated.Scroll,
		};

		const result = buildCanonicalPathForLeaf(leaf);

		expect(result).toBe("Library/Note.md");
	});

	it("builds canonical path with suffix in basename", () => {
		const leaf: TreeLeafDeprecated = {
			extension: "md",
			nodeName: "Note",
			nodeNameChainToParent: ["Library", "A", "B"],
			status: TreeNodeStatusDeprecated.NotStarted,
			type: TreeNodeTypeDeprecated.Scroll,
		};

		const result = buildCanonicalPathForLeaf(leaf);

		expect(result).toBe("Library/A/B/Note-B-A.md");
	});

	it("uses custom suffix delimiter", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			...defaultSettings,
			suffixDelimiter: "::",
		});

		const leaf: TreeLeafDeprecated = {
			extension: "md",
			nodeName: "Note",
			nodeNameChainToParent: ["Library", "A", "B"],
			status: TreeNodeStatusDeprecated.NotStarted,
			type: TreeNodeTypeDeprecated.Scroll,
		};

		const result = buildCanonicalPathForLeaf(leaf);

		expect(result).toBe("Library/A/B/Note::B::A.md");
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

		const leaf: TreeLeafDeprecated = {
			extension: "md",
			nodeName: "Note",
			nodeNameChainToParent: ["child", "A"],
			status: TreeNodeStatusDeprecated.NotStarted,
			type: TreeNodeTypeDeprecated.Scroll,
		};

		const result = buildCanonicalPathForLeaf(leaf);

		expect(result).toBe("parent/child/A/Note-A.md");
	});
});

describe("buildCanonicalBasenameFromTree", () => {

	it("builds canonical basename for root-level file", () => {
		const leaf: TreeLeafDeprecated = {
			extension: "md",
			nodeName: "Note",
			nodeNameChainToParent: ["Library"],
			status: TreeNodeStatusDeprecated.NotStarted,
			type: TreeNodeTypeDeprecated.Scroll,
		};

		const result = buildCanonicalBasenameForLeaf(leaf);

		expect(result).toBe("Note");
	});

	it("builds canonical basename with reversed path as suffix", () => {
		const leaf: TreeLeafDeprecated = {
			extension: "md",
			nodeName: "Note",
			nodeNameChainToParent: ["Library", "A", "B"],
			status: TreeNodeStatusDeprecated.NotStarted,
			type: TreeNodeTypeDeprecated.Scroll,
		};

		const result = buildCanonicalBasenameForLeaf(leaf);

		expect(result).toBe("Note-B-A");
	});

	it("uses custom suffix delimiter", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			...defaultSettings,
			suffixDelimiter: "::",
		});

		const leaf: TreeLeafDeprecated = {
			extension: "md",
			nodeName: "Note",
			nodeNameChainToParent: ["Library", "A", "B"],
			status: TreeNodeStatusDeprecated.NotStarted,
			type: TreeNodeTypeDeprecated.Scroll,
		};

		const result = buildCanonicalBasenameForLeaf(leaf);

		expect(result).toBe("Note::B::A");
	});

	it("handles single parent folder", () => {
		const leaf: TreeLeafDeprecated = {
			extension: "md",
			nodeName: "Note",
			nodeNameChainToParent: ["Library", "Parent"],
			status: TreeNodeStatusDeprecated.NotStarted,
			type: TreeNodeTypeDeprecated.Scroll,
		};

		const result = buildCanonicalBasenameForLeaf(leaf);

		expect(result).toBe("Note-Parent");
	});
});

