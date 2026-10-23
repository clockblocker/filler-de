import { beforeEach, describe, expect, it } from "bun:test";
import { SplitPathKind } from "@textfresser/vault-action-manager";
import { Result } from "effect";
import type { SuffixCodecs } from "../../../src/codecs/internal/suffix";
import { makeSuffixCodecs } from "../../../src/codecs/internal/suffix";
import type { CodecRules } from "../../../src/codecs/rules";
import type {
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../../src/codecs/split-path-inside-library";
import type { SplitPathWithSeparatedSuffixCodecs } from "../../../src/codecs/split-path-with-separated-suffix/make";
import { makeSplitPathWithSeparatedSuffixCodecs } from "../../../src/codecs/split-path-with-separated-suffix/make";
import type { NodeName } from "../../../src/types/schemas/node-name";
import { defaultSettingsForUnitTests } from "../common-utils/consts";

function makeDefaultRules(): CodecRules {
	return {
		languages: defaultSettingsForUnitTests.languages,
		libraryRootName: "Library",
		libraryRootPathParts: [],
		maxSectionDepth: defaultSettingsForUnitTests.maxSectionDepth,
		metadataFormat: () => "Hidden",
		showScrollBacklinks: defaultSettingsForUnitTests.showScrollBacklinks,
		showScrollsInCodexesForDepth:
			defaultSettingsForUnitTests.showScrollsInCodexesForDepth,
		suffixDelimiter: defaultSettingsForUnitTests.suffixDelimiter,
		suffixDelimiterConfig:
			defaultSettingsForUnitTests.suffixDelimiterConfig,
		suffixDelimiterPattern:
			defaultSettingsForUnitTests.suffixDelimiterPattern,
	};
}

describe("split-path-with-separated-suffix codecs", () => {
	let suffixCodecs: SuffixCodecs;
	let codecs: SplitPathWithSeparatedSuffixCodecs;

	beforeEach(() => {
		const rules = makeDefaultRules();
		suffixCodecs = makeSuffixCodecs(rules);
		codecs = makeSplitPathWithSeparatedSuffixCodecs(rules, suffixCodecs);
	});

	describe("splitPathInsideLibraryToWithSeparatedSuffix", () => {
		it("converts MdFile split path to separated suffix form", () => {
			const sp: SplitPathToMdFileInsideLibrary = {
				basename: "NoteName-child-parent",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "parent", "child"],
			};
			const result =
				codecs.splitPathInsideLibraryToWithSeparatedSuffix(sp);
			expect(Result.isSuccess(result)).toBe(true);
			const val = Result.getOrThrow(result);
			expect(val.kind).toBe(SplitPathKind.MdFile);
			expect(val.separatedSuffixedBasename).toEqual({
				coreName: "NoteName",
				suffixParts: ["child", "parent"],
			});
			expect(val.pathParts).toEqual(["Library", "parent", "child"]);
		});

		it("converts Folder split path to separated suffix form", () => {
			const sp: SplitPathToFolderInsideLibrary = {
				basename: "child",
				kind: SplitPathKind.Folder,
				pathParts: ["Library", "parent"],
			};
			const result =
				codecs.splitPathInsideLibraryToWithSeparatedSuffix(sp);
			expect(Result.isSuccess(result)).toBe(true);
			const val = Result.getOrThrow(result);
			expect(val.kind).toBe(SplitPathKind.Folder);
			expect(val.separatedSuffixedBasename).toEqual({
				coreName: "child",
				suffixParts: [],
			});
		});

		it("converts File split path to separated suffix form", () => {
			const sp: SplitPathToFileInsideLibrary = {
				basename: "Image-parent",
				extension: "png",
				kind: SplitPathKind.File,
				pathParts: ["Library", "parent"],
			};
			const result =
				codecs.splitPathInsideLibraryToWithSeparatedSuffix(sp);
			expect(Result.isSuccess(result)).toBe(true);
			const val = Result.getOrThrow(result);
			expect(val.kind).toBe(SplitPathKind.File);
			expect(val.separatedSuffixedBasename).toEqual({
				coreName: "Image",
				suffixParts: ["parent"],
			});
		});

		it("returns error for invalid basename", () => {
			const sp: SplitPathToMdFileInsideLibrary = {
				basename: "",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library"],
			};
			const result =
				codecs.splitPathInsideLibraryToWithSeparatedSuffix(sp);
			expect(Result.isFailure(result)).toBe(true);
		});
	});

	describe("fromSplitPathInsideLibraryWithSeparatedSuffix", () => {
		it("converts MdFile separated suffix form back to split path", () => {
			const sp = {
				extension: "md" as const,
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "parent", "child"],
				separatedSuffixedBasename: {
					coreName: "NoteName" as NodeName,
					suffixParts: ["child" as NodeName, "parent" as NodeName],
				},
			};
			const result =
				codecs.fromSplitPathInsideLibraryWithSeparatedSuffix(sp);
			expect(result.basename).toBe("NoteName-child-parent");
			expect(result.kind).toBe(SplitPathKind.MdFile);
			expect(result.pathParts).toEqual(["Library", "parent", "child"]);
		});

		it("converts Folder separated suffix form back to split path", () => {
			const sp = {
				kind: SplitPathKind.Folder,
				pathParts: ["Library", "parent"],
				separatedSuffixedBasename: {
					coreName: "child" as NodeName,
					suffixParts: [] as NodeName[],
				},
			};
			const result =
				codecs.fromSplitPathInsideLibraryWithSeparatedSuffix(sp);
			expect(result.basename).toBe("child");
			expect(result.kind).toBe(SplitPathKind.Folder);
		});

		it("converts File separated suffix form back to split path", () => {
			const sp = {
				extension: "png",
				kind: SplitPathKind.File,
				pathParts: ["Library", "parent"],
				separatedSuffixedBasename: {
					coreName: "Image" as NodeName,
					suffixParts: ["parent" as NodeName],
				},
			};
			const result =
				codecs.fromSplitPathInsideLibraryWithSeparatedSuffix(sp);
			expect(result.basename).toBe("Image-parent");
			expect(result.kind).toBe(SplitPathKind.File);
		});
	});

	describe("to/from roundtrip", () => {
		it("roundtrips MdFile path", () => {
			const original: SplitPathToMdFileInsideLibrary = {
				basename: "NoteName-child-parent",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "parent", "child"],
			};
			const withSuffix =
				codecs.splitPathInsideLibraryToWithSeparatedSuffix(original);
			expect(Result.isSuccess(withSuffix)).toBe(true);
			const back = codecs.fromSplitPathInsideLibraryWithSeparatedSuffix(
				Result.getOrThrow(withSuffix),
			);
			expect(back.basename).toBe(original.basename);
			expect(back.pathParts).toEqual(original.pathParts);
			expect(back.kind).toBe(original.kind);
		});

		it("roundtrips Folder path", () => {
			const original: SplitPathToFolderInsideLibrary = {
				basename: "child",
				kind: SplitPathKind.Folder,
				pathParts: ["Library", "parent"],
			};
			const withSuffix =
				codecs.splitPathInsideLibraryToWithSeparatedSuffix(original);
			expect(Result.isSuccess(withSuffix)).toBe(true);
			const back = codecs.fromSplitPathInsideLibraryWithSeparatedSuffix(
				Result.getOrThrow(withSuffix),
			);
			expect(back.basename).toBe(original.basename);
			expect(back.pathParts).toEqual(original.pathParts);
		});
	});
});
