import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	buildBasename,
	buildCanonicalBasename,
	computePathPartsFromSuffix,
	computeSuffixFromPath,
	expandSuffixedPath,
	folderNameNeedsSanitization,
	pathPartsHaveSuffix,
	sanitizeFolderName,
	suffixMatchesPath,
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
		expect(computeSuffixFromPath(["parent", "child"])).toEqual([
			"child",
			"parent",
		]);
	});

	it("handles single element", () => {
		expect(computeSuffixFromPath(["root"])).toEqual(["root"]);
	});

	it("handles empty array", () => {
		expect(computeSuffixFromPath([])).toEqual([]);
	});

	it("handles deep nesting", () => {
		expect(computeSuffixFromPath(["a", "b", "c", "d"])).toEqual([
			"d",
			"c",
			"b",
			"a",
		]);
	});
});

describe("computePathPartsFromSuffix", () => {
	it("reverses suffix to path", () => {
		expect(computePathPartsFromSuffix(["child", "parent"])).toEqual([
			"parent",
			"child",
		]);
	});

	it("is inverse of computeSuffixFromPath", () => {
		const path = ["a", "b", "c"];
		expect(computePathPartsFromSuffix(computeSuffixFromPath(path))).toEqual(path);
	});
});

describe("buildBasename", () => {
	it("joins coreName and suffix with delimiter", () => {
		expect(buildBasename("Note", ["child", "parent"], "-")).toBe(
			"Note-child-parent",
		);
	});

	it("returns coreName when suffix is empty", () => {
		expect(buildBasename("Note", [], "-")).toBe("Note");
	});

	it("uses custom delimiter", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			...defaultSettings,
			suffixDelimiter: "_",
		});
		expect(buildBasename("Note", ["a", "b"])).toBe("Note_a_b");
	});
});

describe("buildCanonicalBasename", () => {
	it("builds basename with reversed path as suffix", () => {
		expect(buildCanonicalBasename("Note", ["parent", "child"], "-")).toBe(
			"Note-child-parent",
		);
	});

	it("handles root-level file (empty path)", () => {
		expect(buildCanonicalBasename("Note", [], "-")).toBe("Note");
	});
});

describe("suffixMatchesPath", () => {
	it("returns true when suffix matches reversed path", () => {
		expect(suffixMatchesPath(["child", "parent"], ["parent", "child"])).toBe(
			true,
		);
	});

	it("returns false when lengths differ", () => {
		expect(suffixMatchesPath(["a"], ["a", "b"])).toBe(false);
	});

	it("returns false when content differs", () => {
		expect(suffixMatchesPath(["x", "y"], ["a", "b"])).toBe(false);
	});

	it("handles empty arrays", () => {
		expect(suffixMatchesPath([], [])).toBe(true);
	});
});

describe("sanitizeFolderName", () => {
	it("replaces delimiter with underscore", () => {
		expect(sanitizeFolderName("my-folder", "-")).toBe("my_folder");
	});

	it("handles multiple delimiters", () => {
		expect(sanitizeFolderName("a-b-c", "-")).toBe("a_b_c");
	});

	it("returns unchanged if no delimiter", () => {
		expect(sanitizeFolderName("folder", "-")).toBe("folder");
	});

	it("works with custom delimiter", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			...defaultSettings,
			suffixDelimiter: ".",
		});
		expect(sanitizeFolderName("my.folder.name")).toBe("my_folder_name");
	});
});

describe("folderNameNeedsSanitization", () => {
	it("returns true when name contains delimiter", () => {
		expect(folderNameNeedsSanitization("my-folder", "-")).toBe(true);
	});

	it("returns false when name is clean", () => {
		expect(folderNameNeedsSanitization("myfolder", "-")).toBe(false);
	});

	it("returns false for underscore with dash delimiter", () => {
		expect(folderNameNeedsSanitization("my_folder", "-")).toBe(false);
	});
});

describe("pathPartsHaveSuffix", () => {
	it("returns true when any part contains delimiter", () => {
		expect(pathPartsHaveSuffix(["Library", "X-Y", "Z"], "-")).toBe(true);
	});

	it("returns false when no part contains delimiter", () => {
		expect(pathPartsHaveSuffix(["Library", "X", "Y"], "-")).toBe(false);
	});

	it("detects suffix in first part", () => {
		expect(pathPartsHaveSuffix(["Lib-rary", "X"], "-")).toBe(true);
	});

	it("handles empty array", () => {
		expect(pathPartsHaveSuffix([], "-")).toBe(false);
	});
});

describe("expandSuffixedPath", () => {
	it("expands suffixed folder into parts", () => {
		expect(expandSuffixedPath(["Library", "X-Y"], "-")).toEqual([
			"Library",
			"X",
			"Y",
		]);
	});

	it("expands multiple dashes in one part", () => {
		expect(expandSuffixedPath(["A", "B-C-D"], "-")).toEqual([
			"A",
			"B",
			"C",
			"D",
		]);
	});

	it("leaves clean path unchanged", () => {
		expect(expandSuffixedPath(["Library", "X", "Y"], "-")).toEqual([
			"Library",
			"X",
			"Y",
		]);
	});

	it("handles empty array", () => {
		expect(expandSuffixedPath([], "-")).toEqual([]);
	});

	it("works with custom delimiter", () => {
		getParsedUserSettingsSpy.mockReturnValue({
			...defaultSettings,
			suffixDelimiter: ".",
		});
		expect(expandSuffixedPath(["A.B", "C"])).toEqual(["A", "B", "C"]);
	});
});
