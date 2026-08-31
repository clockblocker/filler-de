import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { makeSuffixCodecs } from "../../../../src/commanders/librarian/codecs/internal/suffix";
import type { SuffixCodecs } from "../../../../src/commanders/librarian/codecs/internal/suffix";
import { makeSplitPathWithSeparatedSuffixCodecs } from "../../../../src/commanders/librarian/codecs/split-path-with-separated-suffix/make";
import type { SplitPathWithSeparatedSuffixCodecs } from "../../../../src/commanders/librarian/codecs/split-path-with-separated-suffix/make";
import { SplitPathKind } from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import type {
	SplitPathToMdFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToFileInsideLibrary,
} from "../../../../src/commanders/librarian/codecs/split-path-inside-library";
import type { NodeName } from "../../../../src/commanders/librarian/types/schemas/node-name";
import type { CodecRules } from "../../../../src/commanders/librarian/codecs/rules";
import { setupGetParsedUserSettingsSpy } from "../../common-utils/setup-spy";
import { defaultSettingsForUnitTests } from "../../common-utils/consts";

function makeDefaultRules(): CodecRules {
	return {
		hideMetadata: defaultSettingsForUnitTests.hideMetadata,
		languages: defaultSettingsForUnitTests.languages,
		libraryRootName: "Library",
		libraryRootPathParts: [],
		showScrollBacklinks: defaultSettingsForUnitTests.showScrollBacklinks,
		suffixDelimiter: defaultSettingsForUnitTests.suffixDelimiter,
		suffixDelimiterConfig: defaultSettingsForUnitTests.suffixDelimiterConfig,
		suffixDelimiterPattern:
			defaultSettingsForUnitTests.suffixDelimiterPattern,
	};
}

describe("split-path-with-separated-suffix codecs", () => {
	let spy: ReturnType<typeof setupGetParsedUserSettingsSpy>;
	let suffixCodecs: SuffixCodecs;
	let codecs: SplitPathWithSeparatedSuffixCodecs;

	beforeEach(() => {
		spy = setupGetParsedUserSettingsSpy();
		const rules = makeDefaultRules();
		suffixCodecs = makeSuffixCodecs(rules);
		codecs = makeSplitPathWithSeparatedSuffixCodecs(suffixCodecs);
	});

	afterEach(() => {
		spy.mockRestore();
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
			expect(result.isOk()).toBe(true);
			const val = result._unsafeUnwrap();
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
			expect(result.isOk()).toBe(true);
			const val = result._unsafeUnwrap();
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
			expect(result.isOk()).toBe(true);
			const val = result._unsafeUnwrap();
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
			expect(result.isErr()).toBe(true);
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
			expect(result.pathParts).toEqual([
				"Library",
				"parent",
				"child",
			]);
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
			expect(withSuffix.isOk()).toBe(true);
			const back =
				codecs.fromSplitPathInsideLibraryWithSeparatedSuffix(
					withSuffix._unsafeUnwrap(),
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
			expect(withSuffix.isOk()).toBe(true);
			const back =
				codecs.fromSplitPathInsideLibraryWithSeparatedSuffix(
					withSuffix._unsafeUnwrap(),
				);
			expect(back.basename).toBe(original.basename);
			expect(back.pathParts).toEqual(original.pathParts);
		});
	});
});
