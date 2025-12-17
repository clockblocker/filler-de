import { describe, expect, it } from "bun:test";
import {
	buildBasename,
	buildCanonicalBasename,
	computePathFromSuffix,
	computeSuffixFromPath,
	expandSuffixedPath,
	folderNameNeedsSanitization,
	pathPartsHaveSuffix,
	sanitizeFolderName,
	suffixMatchesPath,
} from "../../../../src/commanders/librarian/utils/path-suffix-utils";

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

describe("computePathFromSuffix", () => {
	it("reverses suffix to path", () => {
		expect(computePathFromSuffix(["child", "parent"])).toEqual([
			"parent",
			"child",
		]);
	});

	it("is inverse of computeSuffixFromPath", () => {
		const path = ["a", "b", "c"];
		expect(computePathFromSuffix(computeSuffixFromPath(path))).toEqual(path);
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
		expect(buildBasename("Note", ["a", "b"], "_")).toBe("Note_a_b");
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
		expect(sanitizeFolderName("my.folder.name", ".")).toBe("my_folder_name");
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
		expect(expandSuffixedPath(["A.B", "C"], ".")).toEqual(["A", "B", "C"]);
	});
});
