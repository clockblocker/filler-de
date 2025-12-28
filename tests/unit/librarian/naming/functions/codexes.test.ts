import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	buildCanonicalPathPartsForCodex,
	makeCanonicalBasenameForCodexFromSectionNode,
	makeNodeNameChainToParentFromCanonicalBasenameForCodex,
} from "../../../../../src/commanders/librarian/naming/functions/codexes";
import { separateJoinedSuffixedBasename } from "../../../../../src/commanders/librarian/naming/types/transformers";
import { TreeNodeStatus, TreeNodeType } from "../../../../../src/commanders/librarian/types/tree-node";
import * as globalState from "../../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../../src/global-state/parsed-settings";
import { SplitPathType } from "../../../../../src/obsidian-vault-action-manager/types/split-path";

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

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = spyOn(globalState, "getParsedUserSettings").mockReturnValue({
		...defaultSettings,
	});
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("makeCanonicalBasenameForCodexFromSectionNode", () => {
	it("creates basename for single-element chain", () => {
		const sectionNode = {
			children: [],
			nodeName: "Parent",
			nodeNameChainToParent: [],
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Section,
		};
		const result = makeCanonicalBasenameForCodexFromSectionNode(sectionNode);
		expect(result).toBe("__-Parent");
	});

	it("creates basename for multi-element chain", () => {
		const sectionNode = {
			children: [],
			nodeName: "Child",
			nodeNameChainToParent: ["Parent"],
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Section,
		};
		const result = makeCanonicalBasenameForCodexFromSectionNode(sectionNode);
		expect(result).toBe("__-Child-Parent");
	});

	it("creates basename for deeply nested chain", () => {
		const sectionNode = {
			children: [],
			nodeName: "D",
			nodeNameChainToParent: ["A", "B", "C"],
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Section,
		};
		const result = makeCanonicalBasenameForCodexFromSectionNode(sectionNode);
		expect(result).toBe("__-D-C-B-A");
	});


	it("handles custom delimiter", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			...defaultSettings,
			suffixDelimiter: "::",
		});
		const sectionNode = {
			children: [],
			nodeName: "Child",
			nodeNameChainToParent: ["Parent"],
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Section,
		};
		const result = makeCanonicalBasenameForCodexFromSectionNode(sectionNode);
		expect(result).toBe("__::Child::Parent");
	});
});

describe("makeNodeNameChainToParentFromCanonicalBasenameForCodex", () => {
	it("decodes basename for root codex (empty chain)", () => {
		const separated = separateJoinedSuffixedBasename("__-Library");
		const result = makeNodeNameChainToParentFromCanonicalBasenameForCodex(separated);
		expect(result).toEqual([]);
	});

	it("decodes basename for single-element chain", () => {
		const separated = separateJoinedSuffixedBasename("__-Parent");
		const result = makeNodeNameChainToParentFromCanonicalBasenameForCodex(separated);
		expect(result).toEqual(["Parent"]);
	});

	it("decodes basename for multi-element chain", () => {
		const separated = separateJoinedSuffixedBasename("__-Child-Parent");
		const result = makeNodeNameChainToParentFromCanonicalBasenameForCodex(separated);
		expect(result).toEqual(["Parent", "Child"]);
	});

	it("decodes basename for deeply nested chain", () => {
		const separated = separateJoinedSuffixedBasename("__-D-C-B-A");
		const result = makeNodeNameChainToParentFromCanonicalBasenameForCodex(separated);
		expect(result).toEqual(["A", "B", "C", "D"]);
	});

	it("handles custom library root", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			...defaultSettings,
			splitPathToLibraryRoot: {
				basename: "Root",
				pathParts: [],
				type: SplitPathType.Folder,
			},
		});
		const separated = separateJoinedSuffixedBasename("__-Root");
		const result = makeNodeNameChainToParentFromCanonicalBasenameForCodex(separated);
		expect(result).toEqual([]);
	});

	it("handles custom delimiter", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			...defaultSettings,
			suffixDelimiter: "::",
		});
		const separated = separateJoinedSuffixedBasename("__::Child::Parent");
		const result = makeNodeNameChainToParentFromCanonicalBasenameForCodex(separated);
		expect(result).toEqual(["Parent", "Child"]);
	});
});

describe("buildCanonicalPathPartsForCodex", () => {
	it("builds path parts for root codex", () => {
		const result = buildCanonicalPathPartsForCodex("__-Library");
		expect(result).toEqual(["Library"]);
	});

	it("builds path parts for single-element chain", () => {
		const result = buildCanonicalPathPartsForCodex("__-Parent");
		expect(result).toEqual(["Library", "Parent"]);
	});

	it("builds path parts for multi-element chain", () => {
		const result = buildCanonicalPathPartsForCodex("__-Child-Parent");
		expect(result).toEqual(["Library", "Parent", "Child"]);
	});

	it("builds path parts for deeply nested chain", () => {
		const result = buildCanonicalPathPartsForCodex("__-D-C-B-A");
		expect(result).toEqual(["Library", "A", "B", "C", "D"]);
	});

	it("handles custom library root", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			...defaultSettings,
			splitPathToLibraryRoot: {
				basename: "Root",
				pathParts: [],
				type: SplitPathType.Folder,
			},
		});
		const result = buildCanonicalPathPartsForCodex("__-Root");
		expect(result).toEqual(["Root"]);
	});

	it("handles custom delimiter", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			...defaultSettings,
			suffixDelimiter: "::",
		});
		const result = buildCanonicalPathPartsForCodex("__::Child::Parent");
		expect(result).toEqual(["Library", "Parent", "Child"]);
	});
});

describe("roundtrip tests", () => {

	it("roundtrips single-element chain", () => {
		const sectionNode = {
			children: [],
			nodeName: "Parent",
			nodeNameChainToParent: [],
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Section,
		};
		const basename = makeCanonicalBasenameForCodexFromSectionNode(sectionNode);
		const separated = separateJoinedSuffixedBasename(basename);
		const result = makeNodeNameChainToParentFromCanonicalBasenameForCodex(separated);
		// Returns full chain to section (includes section's nodeName)
		expect(result).toEqual(["Parent"]);
	});

	it("roundtrips multi-element chain", () => {
		const sectionNode = {
			children: [],
			nodeName: "Child",
			nodeNameChainToParent: ["Parent"],
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Section,
		};
		const basename = makeCanonicalBasenameForCodexFromSectionNode(sectionNode);
		const separated = separateJoinedSuffixedBasename(basename);
		const result = makeNodeNameChainToParentFromCanonicalBasenameForCodex(separated);
		// Returns full chain to section (includes section's nodeName)
		expect(result).toEqual(["Parent", "Child"]);
	});

	it("roundtrips deeply nested chain", () => {
		const sectionNode = {
			children: [],
			nodeName: "D",
			nodeNameChainToParent: ["A", "B", "C"],
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Section,
		};
		const basename = makeCanonicalBasenameForCodexFromSectionNode(sectionNode);
		const separated = separateJoinedSuffixedBasename(basename);
		const result = makeNodeNameChainToParentFromCanonicalBasenameForCodex(separated);
		// Returns full chain to section (includes section's nodeName)
		expect(result).toEqual(["A", "B", "C", "D"]);
	});

	it("roundtrips through buildCanonicalPathPartsForCodex and back", () => {
		const sectionNode = {
			children: [],
			nodeName: "Child",
			nodeNameChainToParent: ["Parent"],
			status: TreeNodeStatus.NotStarted,
			type: TreeNodeType.Section,
		};
		const basename = makeCanonicalBasenameForCodexFromSectionNode(sectionNode);
		const pathParts = buildCanonicalPathPartsForCodex(basename);
		// pathParts should be ["Library", "Parent", "Child"]
		expect(pathParts).toEqual(["Library", "Parent", "Child"]);
	});
});

