import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	buildCanonicalPathPartsForCodex,
	makeCanonicalBasenameForCodex,
	makeNodeNameChainToParentFromCanonicalBasenameForCodex,
} from "../../../../../src/commanders/librarian/naming/functions/codexes";
import { separateJoinedSuffixedBasename } from "../../../../../src/commanders/librarian/naming/types/transformers";
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

describe("makeCanonicalBasenameForCodex", () => {
	it("creates basename for empty chain (root codex)", () => {
		const result = makeCanonicalBasenameForCodex([]);
		expect(result).toBe("__-Library");
	});

	it("creates basename for single-element chain", () => {
		const result = makeCanonicalBasenameForCodex(["Parent"]);
		expect(result).toBe("__-Parent");
	});

	it("creates basename for multi-element chain", () => {
		const result = makeCanonicalBasenameForCodex(["Parent", "Child"]);
		expect(result).toBe("__-Child-Parent");
	});

	it("creates basename for deeply nested chain", () => {
		const result = makeCanonicalBasenameForCodex(["A", "B", "C", "D"]);
		expect(result).toBe("__-D-C-B-A");
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
		const result = makeCanonicalBasenameForCodex([]);
		expect(result).toBe("__-Root");
	});

	it("handles custom delimiter", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			...defaultSettings,
			suffixDelimiter: "::",
		});
		const result = makeCanonicalBasenameForCodex(["Parent", "Child"]);
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
	it("roundtrips empty chain through makeCanonicalBasenameForCodex and makeNodeNameChainToParentFromCanonicalBasenameForCodex", () => {
		const chain: string[] = [];
		const basename = makeCanonicalBasenameForCodex(chain);
		const separated = separateJoinedSuffixedBasename(basename);
		const result = makeNodeNameChainToParentFromCanonicalBasenameForCodex(separated);
		expect(result).toEqual(chain);
	});

	it("roundtrips single-element chain", () => {
		const chain = ["Parent"];
		const basename = makeCanonicalBasenameForCodex(chain);
		const separated = separateJoinedSuffixedBasename(basename);
		const result = makeNodeNameChainToParentFromCanonicalBasenameForCodex(separated);
		expect(result).toEqual(chain);
	});

	it("roundtrips multi-element chain", () => {
		const chain = ["Parent", "Child"];
		const basename = makeCanonicalBasenameForCodex(chain);
		const separated = separateJoinedSuffixedBasename(basename);
		const result = makeNodeNameChainToParentFromCanonicalBasenameForCodex(separated);
		expect(result).toEqual(chain);
	});

	it("roundtrips deeply nested chain", () => {
		const chain = ["A", "B", "C", "D"];
		const basename = makeCanonicalBasenameForCodex(chain);
		const separated = separateJoinedSuffixedBasename(basename);
		const result = makeNodeNameChainToParentFromCanonicalBasenameForCodex(separated);
		expect(result).toEqual(chain);
	});

	it("roundtrips through buildCanonicalPathPartsForCodex and back", () => {
		const chain = ["Parent", "Child"];
		const basename = makeCanonicalBasenameForCodex(chain);
		const pathParts = buildCanonicalPathPartsForCodex(basename);
		// pathParts should be ["Library", "Parent", "Child"]
		expect(pathParts).toEqual(["Library", "Parent", "Child"]);
	});
});

