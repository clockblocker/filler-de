import { beforeEach, describe, expect, it } from "bun:test";
import { SplitPathKind } from "@textfresser/vault-action-manager";
import { Result } from "effect";
import type { SuffixCodecs } from "../../../src/codecs/internal/suffix";
import { makeSuffixCodecs } from "../../../src/codecs/internal/suffix";
import type { LocatorCodecs } from "../../../src/codecs/locator/make";
import { makeLocatorCodecs } from "../../../src/codecs/locator/make";
import type { CodecRules } from "../../../src/codecs/rules";
import type { SegmentIdCodecs } from "../../../src/codecs/segment-id/make";
import { makeSegmentIdCodecs } from "../../../src/codecs/segment-id/make";
import type {
	FileNodeSegmentId,
	ScrollNodeSegmentId,
	SectionNodeSegmentId,
} from "../../../src/codecs/segment-id/types/segment-id";
import type {
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
} from "../../../src/codecs/split-path-with-separated-suffix";
import { TreeNodeKind } from "../../../src/healer/library-tree/tree-node/types/atoms";
import type { NodeName } from "../../../src/types/schemas/node-name";
import { defaultSettingsForUnitTests } from "../common-utils/consts";

// ﹘ = SMALL_EM_DASH (U+FE58)
const SEP = "﹘";
const sec = (name: string): SectionNodeSegmentId =>
	`${name}${SEP}Section${SEP}` as SectionNodeSegmentId;

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

describe("locator codecs", () => {
	let suffixCodecs: SuffixCodecs;
	let segmentIdCodecs: SegmentIdCodecs;
	let codecs: LocatorCodecs;

	beforeEach(() => {
		const rules = makeDefaultRules();
		suffixCodecs = makeSuffixCodecs(rules);
		segmentIdCodecs = makeSegmentIdCodecs(rules);
		codecs = makeLocatorCodecs(segmentIdCodecs, suffixCodecs);
	});

	describe("canonicalSplitPathInsideLibraryToLocator", () => {
		it("converts Folder canonical split path to Section locator", () => {
			const sp: CanonicalSplitPathToFolderInsideLibrary = {
				kind: SplitPathKind.Folder,
				pathParts: ["Library", "parent"],
				separatedSuffixedBasename: {
					coreName: "child" as NodeName,
					suffixParts: [] as NodeName[],
				},
			};
			const result = codecs.canonicalSplitPathInsideLibraryToLocator(sp);
			expect(Result.isSuccess(result)).toBe(true);
			const loc = Result.getOrThrow(result);
			expect(loc.targetKind).toBe(TreeNodeKind.Section);
			expect(loc.segmentId).toBe(`child${SEP}Section${SEP}`);
			expect(loc.segmentIdChainToParent).toEqual([
				sec("Library"),
				sec("parent"),
			]);
		});

		it("converts MdFile canonical split path to Scroll locator", () => {
			const sp: CanonicalSplitPathToMdFileInsideLibrary = {
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "parent"],
				separatedSuffixedBasename: {
					coreName: "MyNote" as NodeName,
					suffixParts: ["parent" as NodeName],
				},
			};
			const result = codecs.canonicalSplitPathInsideLibraryToLocator(sp);
			expect(Result.isSuccess(result)).toBe(true);
			const loc = Result.getOrThrow(result);
			expect(loc.targetKind).toBe(TreeNodeKind.Scroll);
			expect(loc.segmentId).toBe(`MyNote${SEP}Scroll${SEP}md`);
			expect(loc.segmentIdChainToParent).toEqual([
				sec("Library"),
				sec("parent"),
			]);
		});

		it("converts File canonical split path to File locator", () => {
			const sp: CanonicalSplitPathToFileInsideLibrary = {
				extension: "png",
				kind: SplitPathKind.File,
				pathParts: ["Library", "parent"],
				separatedSuffixedBasename: {
					coreName: "Image" as NodeName,
					suffixParts: ["parent" as NodeName],
				},
			};
			const result = codecs.canonicalSplitPathInsideLibraryToLocator(sp);
			expect(Result.isSuccess(result)).toBe(true);
			const loc = Result.getOrThrow(result);
			expect(loc.targetKind).toBe(TreeNodeKind.File);
			expect(loc.segmentId).toBe(`Image${SEP}File${SEP}png`);
		});

		it("handles deeply nested path", () => {
			const sp: CanonicalSplitPathToMdFileInsideLibrary = {
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "grandpa", "father", "child"],
				separatedSuffixedBasename: {
					coreName: "Leaf" as NodeName,
					suffixParts: [
						"child" as NodeName,
						"father" as NodeName,
						"grandpa" as NodeName,
					],
				},
			};
			const result = codecs.canonicalSplitPathInsideLibraryToLocator(sp);
			expect(Result.isSuccess(result)).toBe(true);
			const loc = Result.getOrThrow(result);
			expect(loc.segmentIdChainToParent).toEqual([
				sec("Library"),
				sec("grandpa"),
				sec("father"),
				sec("child"),
			]);
		});
	});

	describe("locatorToCanonicalSplitPathInsideLibrary", () => {
		it("converts Section locator to Folder canonical split path", () => {
			const loc = {
				segmentId: `child${SEP}Section${SEP}` as SectionNodeSegmentId,
				segmentIdChainToParent: [
					sec("Library"),
					sec("parent"),
				] as SectionNodeSegmentId[],
				targetKind: TreeNodeKind.Section as typeof TreeNodeKind.Section,
			};
			const result = codecs.locatorToCanonicalSplitPathInsideLibrary(loc);
			expect(Result.isSuccess(result)).toBe(true);
			const sp = Result.getOrThrow(result);
			expect(sp.kind).toBe(SplitPathKind.Folder);
			expect(sp.pathParts).toEqual(["Library", "parent"]);
			expect(sp.separatedSuffixedBasename.coreName).toBe("child");
			expect(sp.separatedSuffixedBasename.suffixParts).toEqual([]);
		});

		it("converts Scroll locator to MdFile canonical split path", () => {
			const loc = {
				segmentId: `MyNote${SEP}Scroll${SEP}md` as ScrollNodeSegmentId,
				segmentIdChainToParent: [
					sec("Library"),
					sec("parent"),
				] as SectionNodeSegmentId[],
				targetKind: TreeNodeKind.Scroll as typeof TreeNodeKind.Scroll,
			};
			const result = codecs.locatorToCanonicalSplitPathInsideLibrary(loc);
			expect(Result.isSuccess(result)).toBe(true);
			const sp = Result.getOrThrow(result);
			expect(sp.kind).toBe(SplitPathKind.MdFile);
			expect(sp.pathParts).toEqual(["Library", "parent"]);
			expect(sp.separatedSuffixedBasename.coreName).toBe("MyNote");
			expect(sp.separatedSuffixedBasename.suffixParts).toEqual([
				"parent",
			]);
		});

		it("converts File locator to File canonical split path", () => {
			const loc = {
				segmentId: `Image${SEP}File${SEP}png` as FileNodeSegmentId,
				segmentIdChainToParent: [
					sec("Library"),
					sec("parent"),
				] as SectionNodeSegmentId[],
				targetKind: TreeNodeKind.File as typeof TreeNodeKind.File,
			};
			const result = codecs.locatorToCanonicalSplitPathInsideLibrary(loc);
			expect(Result.isSuccess(result)).toBe(true);
			const sp = Result.getOrThrow(result);
			expect(sp.kind).toBe(SplitPathKind.File);
			expect(sp.separatedSuffixedBasename.coreName).toBe("Image");
		});
	});

	describe("toLocator / fromLocator roundtrip", () => {
		it("roundtrips Section locator", () => {
			const originalSp: CanonicalSplitPathToFolderInsideLibrary = {
				kind: SplitPathKind.Folder,
				pathParts: ["Library", "parent"],
				separatedSuffixedBasename: {
					coreName: "child" as NodeName,
					suffixParts: [] as NodeName[],
				},
			};
			const locResult =
				codecs.canonicalSplitPathInsideLibraryToLocator(originalSp);
			expect(Result.isSuccess(locResult)).toBe(true);
			const loc = Result.getOrThrow(locResult);

			const spResult =
				codecs.locatorToCanonicalSplitPathInsideLibrary(loc);
			expect(Result.isSuccess(spResult)).toBe(true);
			const sp = Result.getOrThrow(spResult);
			expect(sp.kind).toBe(originalSp.kind);
			expect(sp.pathParts).toEqual(originalSp.pathParts);
			expect(sp.separatedSuffixedBasename.coreName).toBe(
				originalSp.separatedSuffixedBasename.coreName,
			);
		});

		it("roundtrips Scroll locator", () => {
			const originalSp: CanonicalSplitPathToMdFileInsideLibrary = {
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "parent", "child"],
				separatedSuffixedBasename: {
					coreName: "Leaf" as NodeName,
					suffixParts: ["child" as NodeName, "parent" as NodeName],
				},
			};
			const locResult =
				codecs.canonicalSplitPathInsideLibraryToLocator(originalSp);
			expect(Result.isSuccess(locResult)).toBe(true);
			const loc = Result.getOrThrow(locResult);

			const spResult =
				codecs.locatorToCanonicalSplitPathInsideLibrary(loc);
			expect(Result.isSuccess(spResult)).toBe(true);
			const sp = Result.getOrThrow(spResult);
			expect(sp.kind).toBe(SplitPathKind.MdFile);
			expect(sp.pathParts).toEqual(originalSp.pathParts);
			expect(sp.separatedSuffixedBasename.coreName).toBe("Leaf");
			expect(sp.separatedSuffixedBasename.suffixParts).toEqual([
				"child",
				"parent",
			]);
		});
	});
});
