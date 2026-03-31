import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	fromSplitPath,
	toSplitPath,
	getSuffixParts,
	getBasename,
	getParentPathParts,
	makeLeafPath,
	makeSectionPath,
	fromSectionChain,
	makeLibraryPathCodecs,
	type LibraryPath,
} from "../../../../src/commanders/librarian/codecs/library-path";
import { makeSegmentIdCodecs } from "../../../../src/commanders/librarian/codecs/segment-id/make";
import { SplitPathKind } from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import type {
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
	SplitPathToFileInsideLibrary,
} from "../../../../src/commanders/librarian/codecs/split-path-inside-library";
import type { SectionNodeSegmentId } from "../../../../src/commanders/librarian/codecs/segment-id/types/segment-id";
import type { CodecRules } from "../../../../src/commanders/librarian/codecs/rules";
import { setupGetParsedUserSettingsSpy } from "../../common-utils/setup-spy";
import { defaultSettingsForUnitTests } from "../../common-utils/consts";

// ﹘ = SMALL_EM_DASH (U+FE58)
const SEP = "﹘";
const sec = (name: string): SectionNodeSegmentId =>
	`${name}${SEP}Section${SEP}` as SectionNodeSegmentId;

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

describe("library-path codecs", () => {
	let spy: ReturnType<typeof setupGetParsedUserSettingsSpy>;

	beforeEach(() => {
		spy = setupGetParsedUserSettingsSpy();
	});

	afterEach(() => {
		spy.mockRestore();
	});

	describe("fromSplitPath", () => {
		it("creates LibraryPath from Folder split path", () => {
			const sp: SplitPathToFolderInsideLibrary = {
				basename: "child",
				kind: SplitPathKind.Folder,
				pathParts: ["Library", "parent"],
			};
			const lp = fromSplitPath(sp);
			expect(lp.segments).toEqual(["Library", "parent", "child"]);
			expect(lp.kind).toBe(SplitPathKind.Folder);
			expect(lp.extension).toBeUndefined();
		});

		it("creates LibraryPath from MdFile split path", () => {
			const sp: SplitPathToMdFileInsideLibrary = {
				basename: "Note",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "parent"],
			};
			const lp = fromSplitPath(sp);
			expect(lp.segments).toEqual(["Library", "parent", "Note"]);
			expect(lp.kind).toBe(SplitPathKind.MdFile);
			expect(lp.extension).toBe("md");
		});

		it("creates LibraryPath from File split path", () => {
			const sp: SplitPathToFileInsideLibrary = {
				basename: "Image",
				extension: "png",
				kind: SplitPathKind.File,
				pathParts: ["Library"],
			};
			const lp = fromSplitPath(sp);
			expect(lp.segments).toEqual(["Library", "Image"]);
			expect(lp.extension).toBe("png");
		});
	});

	describe("toSplitPath", () => {
		it("converts Folder LibraryPath to split path", () => {
			const lp: LibraryPath = {
				extension: undefined,
				kind: SplitPathKind.Folder,
				segments: ["Library", "parent", "child"],
			};
			const sp = toSplitPath(lp);
			expect(sp.basename).toBe("child");
			expect(sp.pathParts).toEqual(["Library", "parent"]);
			expect(sp.kind).toBe(SplitPathKind.Folder);
		});

		it("converts MdFile LibraryPath to split path", () => {
			const lp: LibraryPath = {
				extension: "md",
				kind: SplitPathKind.MdFile,
				segments: ["Library", "parent", "Note"],
			};
			const sp = toSplitPath(lp);
			expect(sp.basename).toBe("Note");
			expect(sp.pathParts).toEqual(["Library", "parent"]);
			expect(sp.kind).toBe(SplitPathKind.MdFile);
		});

		it("converts File LibraryPath to split path", () => {
			const lp: LibraryPath = {
				extension: "png",
				kind: SplitPathKind.File,
				segments: ["Library", "Image"],
			};
			const sp = toSplitPath(lp);
			expect(sp.basename).toBe("Image");
			expect(sp.pathParts).toEqual(["Library"]);
		});
	});

	describe("getSuffixParts", () => {
		it("returns copy of segments for root-only path", () => {
			const lp: LibraryPath = {
				kind: SplitPathKind.Folder,
				segments: ["Library"],
			};
			expect(getSuffixParts(lp)).toEqual(["Library"]);
		});

		it("returns reversed segments excluding root", () => {
			const lp: LibraryPath = {
				kind: SplitPathKind.Folder,
				segments: ["Library", "grandpa", "father"],
			};
			expect(getSuffixParts(lp)).toEqual(["father", "grandpa"]);
		});

		it("handles deeply nested path", () => {
			const lp: LibraryPath = {
				kind: SplitPathKind.Folder,
				segments: ["Library", "a", "b", "c"],
			};
			expect(getSuffixParts(lp)).toEqual(["c", "b", "a"]);
		});
	});

	describe("getBasename", () => {
		it("returns last segment", () => {
			const lp: LibraryPath = {
				kind: SplitPathKind.Folder,
				segments: ["Library", "parent", "child"],
			};
			expect(getBasename(lp)).toBe("child");
		});

		it("returns empty string for empty segments", () => {
			const lp: LibraryPath = {
				kind: SplitPathKind.Folder,
				segments: [],
			};
			expect(getBasename(lp)).toBe("");
		});
	});

	describe("getParentPathParts", () => {
		it("returns all segments except last", () => {
			const lp: LibraryPath = {
				kind: SplitPathKind.Folder,
				segments: ["Library", "parent", "child"],
			};
			expect(getParentPathParts(lp)).toEqual(["Library", "parent"]);
		});

		it("returns empty for single segment", () => {
			const lp: LibraryPath = {
				kind: SplitPathKind.Folder,
				segments: ["Library"],
			};
			expect(getParentPathParts(lp)).toEqual([]);
		});
	});

	describe("makeLeafPath", () => {
		it("creates MdFile path for md extension", () => {
			const lp = makeLeafPath(["Library", "parent"], "Note", "md");
			expect(lp.segments).toEqual(["Library", "parent", "Note"]);
			expect(lp.kind).toBe(SplitPathKind.MdFile);
			expect(lp.extension).toBe("md");
		});

		it("creates File path for non-md extension", () => {
			const lp = makeLeafPath(["Library"], "Image", "png");
			expect(lp.segments).toEqual(["Library", "Image"]);
			expect(lp.kind).toBe(SplitPathKind.File);
			expect(lp.extension).toBe("png");
		});
	});

	describe("makeSectionPath", () => {
		it("creates Folder path", () => {
			const lp = makeSectionPath(["Library", "parent", "child"]);
			expect(lp.segments).toEqual(["Library", "parent", "child"]);
			expect(lp.kind).toBe(SplitPathKind.Folder);
			expect(lp.extension).toBeUndefined();
		});
	});

	describe("fromSectionChain", () => {
		it("converts section chain to LibraryPath", () => {
			const rules = makeDefaultRules();
			const segmentIdCodecs = makeSegmentIdCodecs(rules);
			const chain = [sec("Library"), sec("parent"), sec("child")];
			const result = fromSectionChain(chain, segmentIdCodecs);
			expect(result.isOk()).toBe(true);
			const lp = result._unsafeUnwrap();
			expect(lp.segments).toEqual(["Library", "parent", "child"]);
			expect(lp.kind).toBe(SplitPathKind.Folder);
		});

		it("returns empty segments for empty chain", () => {
			const rules = makeDefaultRules();
			const segmentIdCodecs = makeSegmentIdCodecs(rules);
			const result = fromSectionChain([], segmentIdCodecs);
			expect(result.isOk()).toBe(true);
			expect(result._unsafeUnwrap().segments).toEqual([]);
		});

		it("returns error for invalid segment ID in chain", () => {
			const rules = makeDefaultRules();
			const segmentIdCodecs = makeSegmentIdCodecs(rules);
			const chain = ["invalid" as SectionNodeSegmentId];
			const result = fromSectionChain(chain, segmentIdCodecs);
			expect(result.isErr()).toBe(true);
		});
	});

	describe("fromSplitPath / toSplitPath roundtrip", () => {
		it("roundtrips Folder path", () => {
			const original: SplitPathToFolderInsideLibrary = {
				basename: "child",
				kind: SplitPathKind.Folder,
				pathParts: ["Library", "parent"],
			};
			const lp = fromSplitPath(original);
			const back = toSplitPath(lp);
			expect(back.basename).toBe(original.basename);
			expect(back.pathParts).toEqual(original.pathParts);
			expect(back.kind).toBe(original.kind);
		});

		it("roundtrips MdFile path", () => {
			const original: SplitPathToMdFileInsideLibrary = {
				basename: "Note",
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "parent"],
			};
			const lp = fromSplitPath(original);
			const back = toSplitPath(lp);
			expect(back.basename).toBe(original.basename);
			expect(back.pathParts).toEqual(original.pathParts);
		});
	});

	describe("makeLibraryPathCodecs factory", () => {
		it("creates codecs object with all functions", () => {
			const rules = makeDefaultRules();
			const segmentIdCodecs = makeSegmentIdCodecs(rules);
			const codecs = makeLibraryPathCodecs(segmentIdCodecs);
			expect(typeof codecs.fromSplitPath).toBe("function");
			expect(typeof codecs.toSplitPath).toBe("function");
			expect(typeof codecs.getSuffixParts).toBe("function");
			expect(typeof codecs.getBasename).toBe("function");
			expect(typeof codecs.getParentPathParts).toBe("function");
			expect(typeof codecs.makeLeafPath).toBe("function");
			expect(typeof codecs.makeSectionPath).toBe("function");
			expect(typeof codecs.fromSectionChain).toBe("function");
		});
	});
});
