import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	buildBasenameDepreacated,
	buildCanonicalBasenameDeprecated,
	computePathPartsFromSuffixDepreacated,
	computeSuffixFromPathDepreacated,
	expandSuffixedPathDepreacated,
	folderNameNeedsSanitizationDepreacated,
	pathPartsHaveSuffixDepreacated,
	sanitizeFolderNameDepreacated,
	suffixMatchesPathDepreacated,
} from "../../../../src/commanders/librarian/utils/path-suffix-utils";
import * as globalState from "../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../src/global-state/parsed-settings";
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

describe("computeSuffixFromPath", () => {
	it("reverses path to suffix", () => {
		expect(computeSuffixFromPathDepreacated(["parent", "child"])).toEqual([
			"child",
			"parent",
		]);
	});

	it("handles single element", () => {
		expect(computeSuffixFromPathDepreacated(["root"])).toEqual(["root"]);
	});

	it("handles empty array", () => {
		expect(computeSuffixFromPathDepreacated([])).toEqual([]);
	});

	it("handles deep nesting", () => {
		expect(computeSuffixFromPathDepreacated(["a", "b", "c", "d"])).toEqual([
			"d",
			"c",
			"b",
			"a",
		]);
	});
});

describe("computePathPartsFromSuffix", () => {
	it("reverses suffix to path", () => {
		expect(computePathPartsFromSuffixDepreacated(["child", "parent"])).toEqual([
			"parent",
			"child",
		]);
	});

	it("is inverse of computeSuffixFromPath", () => {
		const path = ["a", "b", "c"];
		expect(computePathPartsFromSuffixDepreacated(computeSuffixFromPathDepreacated(path))).toEqual(path);
	});
});

describe("buildBasename", () => {
	it("joins nodeName and suffix with delimiter", () => {
		expect(buildBasenameDepreacated("Note", ["child", "parent"], "-")).toBe(
			"Note-child-parent",
		);
	});

	it("returns nodeName when suffix is empty", () => {
		expect(buildBasenameDepreacated("Note", [], "-")).toBe("Note");
	});

	it("uses custom delimiter", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			...defaultSettings,
			suffixDelimiter: "_",
		});
		expect(buildBasenameDepreacated("Note", ["a", "b"])).toBe("Note_a_b");
	});
});

describe("buildCanonicalBasename", () => {
	it("builds basename with reversed path as suffix", () => {
		expect(buildCanonicalBasenameDeprecated("Note", ["parent", "child"], "-")).toBe(
			"Note-child-parent",
		);
	});

	it("handles root-level file (empty path)", () => {
		expect(buildCanonicalBasenameDeprecated("Note", [], "-")).toBe("Note");
	});
});

describe("suffixMatchesPath", () => {
	it("returns true when suffix matches reversed path", () => {
		expect(suffixMatchesPathDepreacated(["child", "parent"], ["parent", "child"])).toBe(
			true,
		);
	});

	it("returns false when lengths differ", () => {
		expect(suffixMatchesPathDepreacated(["a"], ["a", "b"])).toBe(false);
	});

	it("returns false when content differs", () => {
		expect(suffixMatchesPathDepreacated(["x", "y"], ["a", "b"])).toBe(false);
	});

	it("handles empty arrays", () => {
		expect(suffixMatchesPathDepreacated([], [])).toBe(true);
	});
});

describe("sanitizeFolderName", () => {
	it("replaces delimiter with underscore", () => {
		expect(sanitizeFolderNameDepreacated("my-folder", "-")).toBe("my_folder");
	});

	it("handles multiple delimiters", () => {
		expect(sanitizeFolderNameDepreacated("a-b-c", "-")).toBe("a_b_c");
	});

	it("returns unchanged if no delimiter", () => {
		expect(sanitizeFolderNameDepreacated("folder", "-")).toBe("folder");
	});

	it("works with custom delimiter", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			...defaultSettings,
			suffixDelimiter: ".",
		});
		expect(sanitizeFolderNameDepreacated("my.folder.name")).toBe("my_folder_name");
	});
});

describe("folderNameNeedsSanitization", () => {
	it("returns true when name contains delimiter", () => {
		expect(folderNameNeedsSanitizationDepreacated("my-folder", "-")).toBe(true);
	});

	it("returns false when name is clean", () => {
		expect(folderNameNeedsSanitizationDepreacated("myfolder", "-")).toBe(false);
	});

	it("returns false for underscore with dash delimiter", () => {
		expect(folderNameNeedsSanitizationDepreacated("my_folder", "-")).toBe(false);
	});
});

describe("pathPartsHaveSuffix", () => {
	it("returns true when any part contains delimiter", () => {
		expect(pathPartsHaveSuffixDepreacated(["Library", "X-Y", "Z"], "-")).toBe(true);
	});

	it("returns false when no part contains delimiter", () => {
		expect(pathPartsHaveSuffixDepreacated(["Library", "X", "Y"], "-")).toBe(false);
	});

	it("detects suffix in first part", () => {
		expect(pathPartsHaveSuffixDepreacated(["Lib-rary", "X"], "-")).toBe(true);
	});

	it("handles empty array", () => {
		expect(pathPartsHaveSuffixDepreacated([], "-")).toBe(false);
	});
});

describe("expandSuffixedPath", () => {
	it("expands suffixed folder into parts", () => {
		expect(expandSuffixedPathDepreacated(["Library", "X-Y"], "-")).toEqual([
			"Library",
			"X",
			"Y",
		]);
	});

	it("expands multiple dashes in one part", () => {
		expect(expandSuffixedPathDepreacated(["A", "B-C-D"], "-")).toEqual([
			"A",
			"B",
			"C",
			"D",
		]);
	});

	it("leaves clean path unchanged", () => {
		expect(expandSuffixedPathDepreacated(["Library", "X", "Y"], "-")).toEqual([
			"Library",
			"X",
			"Y",
		]);
	});

	it("handles empty array", () => {
		expect(expandSuffixedPathDepreacated([], "-")).toEqual([]);
	});

	it("works with custom delimiter", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			...defaultSettings,
			suffixDelimiter: ".",
		});
		expect(expandSuffixedPathDepreacated(["A.B", "C"])).toEqual(["A", "B", "C"]);
	});
});
