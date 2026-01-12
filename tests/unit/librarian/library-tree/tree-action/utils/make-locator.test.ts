import { describe, expect, it } from "bun:test";
import type {
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
} from "../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/utils/canonical-naming/types";
import { makeLocatorFromCanonicalSplitPathInsideLibrary } from "../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/utils/locator/locator-codec";
import { TreeNodeKind } from "../../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/atoms";
import { NodeSegmentIdSeparator } from "../../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/node-segment-id";
import { SplitPathKind } from "../../../../../../src/managers/obsidian/vault-action-manager/types/split-path";

describe("makeLocatorFromLibraryScopedCanonicalSplitPath", () => {
	describe("File type", () => {
		it("creates FileNodeLocator with empty sectionNames", () => {
			const sp: CanonicalSplitPathToFileInsideLibrary = {
				extension: "txt",
				kind: SplitPathKind.File,
				pathParts: ["Library"],
				separatedSuffixedBasename: {
					coreName: "MyFile",
					suffixParts: [],
				},
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.targetKind).toBe(TreeNodeKind.File);
			expect(result.segmentIdChainToParent).toHaveLength(1);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Library${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyFile${NodeSegmentIdSeparator}${TreeNodeKind.File}${NodeSegmentIdSeparator}txt`,
			);
		});

		it("creates FileNodeLocator with single sectionName", () => {
			const sp: CanonicalSplitPathToFileInsideLibrary = {
				extension: "pdf",
				kind: SplitPathKind.File,
				pathParts: ["Library", "Parent"],
				separatedSuffixedBasename: {
					coreName: "MyFile",
					suffixParts: ["Parent"],
				},
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.targetKind).toBe(TreeNodeKind.File);
			expect(result.segmentIdChainToParent).toHaveLength(2);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Library${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[1]).toBe(
				`Parent${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyFile${NodeSegmentIdSeparator}${TreeNodeKind.File}${NodeSegmentIdSeparator}pdf`,
			);
		});

		it("creates FileNodeLocator with multiple sectionNames", () => {
			const sp: CanonicalSplitPathToFileInsideLibrary = {
				extension: "docx",
				kind: SplitPathKind.File,
				pathParts: ["Library", "Parent", "Child", "Grandchild"],
				separatedSuffixedBasename: {
					coreName: "MyFile",
					suffixParts: ["Grandchild", "Child", "Parent"],
				},
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.targetKind).toBe(TreeNodeKind.File);
			expect(result.segmentIdChainToParent).toHaveLength(4);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Library${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[1]).toBe(
				`Parent${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[2]).toBe(
				`Child${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[3]).toBe(
				`Grandchild${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyFile${NodeSegmentIdSeparator}${TreeNodeKind.File}${NodeSegmentIdSeparator}docx`,
			);
		});
	});

	describe("MdFile type", () => {
		it("creates ScrollNodeLocator with empty sectionNames", () => {
			const sp: CanonicalSplitPathToMdFileInsideLibrary = {
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library"],
				separatedSuffixedBasename: {
					coreName: "MyScroll",
					suffixParts: [],
				},
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.targetKind).toBe(TreeNodeKind.Scroll);
			expect(result.segmentIdChainToParent).toHaveLength(1);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Library${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyScroll${NodeSegmentIdSeparator}${TreeNodeKind.Scroll}${NodeSegmentIdSeparator}md`,
			);
		});

		it("creates ScrollNodeLocator with single sectionName", () => {
			const sp: CanonicalSplitPathToMdFileInsideLibrary = {
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Parent"],
				separatedSuffixedBasename: {
					coreName: "MyScroll",
					suffixParts: ["Parent"],
				},
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.targetKind).toBe(TreeNodeKind.Scroll);
			expect(result.segmentIdChainToParent).toHaveLength(2);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Library${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[1]).toBe(
				`Parent${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyScroll${NodeSegmentIdSeparator}${TreeNodeKind.Scroll}${NodeSegmentIdSeparator}md`,
			);
		});

		it("creates ScrollNodeLocator with multiple sectionNames", () => {
			const sp: CanonicalSplitPathToMdFileInsideLibrary = {
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section1", "Section2", "Section3"],
				separatedSuffixedBasename: {
					coreName: "MyScroll",
					suffixParts: ["Section3", "Section2", "Section1"],
				},
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.targetKind).toBe(TreeNodeKind.Scroll);
			expect(result.segmentIdChainToParent).toHaveLength(4);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Library${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[1]).toBe(
				`Section1${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[2]).toBe(
				`Section2${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[3]).toBe(
				`Section3${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyScroll${NodeSegmentIdSeparator}${TreeNodeKind.Scroll}${NodeSegmentIdSeparator}md`,
			);
		});

		it("always uses 'md' extension regardless of input", () => {
			const sp: CanonicalSplitPathToMdFileInsideLibrary = {
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: ["Library"],
				separatedSuffixedBasename: {
					coreName: "MyScroll",
					suffixParts: [],
				},
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.segmentId).toBe(
				`MyScroll${NodeSegmentIdSeparator}${TreeNodeKind.Scroll}${NodeSegmentIdSeparator}md`,
			);
		});
	});

	describe("Folder type", () => {
		it("creates SectionNodeLocator with empty sectionNames", () => {
			const sp: CanonicalSplitPathToFolderInsideLibrary = {
				kind: SplitPathKind.Folder,
				pathParts: [],
				separatedSuffixedBasename: {
					coreName: "MyFolder",
					suffixParts: [],
				},
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.targetKind).toBe(TreeNodeKind.Section);
			expect(result.segmentIdChainToParent).toEqual([]);
			expect(result.segmentId).toBe(
				`MyFolder${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
		});

		it("creates SectionNodeLocator with single sectionName", () => {
			const sp: CanonicalSplitPathToFolderInsideLibrary = {
				kind: SplitPathKind.Folder,
				pathParts: ["Library", "Parent"],
				separatedSuffixedBasename: {
					coreName: "MyFolder",
					suffixParts: [],
				},
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.targetKind).toBe(TreeNodeKind.Section);
			expect(result.segmentIdChainToParent).toHaveLength(2);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Library${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[1]).toBe(
				`Parent${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyFolder${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
		});

		it("creates SectionNodeLocator with multiple sectionNames", () => {
			const sp: CanonicalSplitPathToFolderInsideLibrary = {
				kind: SplitPathKind.Folder,
				pathParts: ["Library", "Level1", "Level2", "Level3"],
				separatedSuffixedBasename: {
					coreName: "MyFolder",
					suffixParts: [],
				},
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.targetKind).toBe(TreeNodeKind.Section);
			expect(result.segmentIdChainToParent).toHaveLength(4);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Library${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[1]).toBe(
				`Level1${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[2]).toBe(
				`Level2${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[3]).toBe(
				`Level3${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyFolder${NodeSegmentIdSeparator}${TreeNodeKind.Section}${NodeSegmentIdSeparator}`,
			);
		});
	});
});
