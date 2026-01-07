import { describe, expect, it } from "bun:test";
import type {
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
} from "../../../../../../src/commanders/librarian-new/library-tree/tree-action/utils/canonical-naming/types";
import { makeLocatorFromCanonicalSplitPathInsideLibrary } from "../../../../../../src/commanders/librarian-new/library-tree/tree-action/utils/locator/locator-codec";
import { TreeNodeType } from "../../../../../../src/commanders/librarian-new/library-tree/tree-node/types/atoms";
import { NodeSegmentIdSeparator } from "../../../../../../src/commanders/librarian-new/library-tree/tree-node/types/node-segment-id";
import { SplitPathType } from "../../../../../../src/obsidian-vault-action-manager/types/split-path";

describe("makeLocatorFromLibraryScopedCanonicalSplitPath", () => {
	describe("File type", () => {
		it("creates FileNodeLocator with empty sectionNames", () => {
			const sp: CanonicalSplitPathToFileInsideLibrary = {
				extension: "txt",
				pathParts: ["Library"],
				separatedSuffixedBasename: {
					coreName: "MyFile",
					suffixParts: [],
				},
				type: SplitPathType.File,
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.targetType).toBe(TreeNodeType.File);
			expect(result.segmentIdChainToParent).toHaveLength(1);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Library${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyFile${NodeSegmentIdSeparator}${TreeNodeType.File}${NodeSegmentIdSeparator}txt`,
			);
		});

		it("creates FileNodeLocator with single sectionName", () => {
			const sp: CanonicalSplitPathToFileInsideLibrary = {
				extension: "pdf",
				pathParts: ["Library", "Parent"],
				separatedSuffixedBasename: {
					coreName: "MyFile",
					suffixParts: ["Parent"],
				},
				type: SplitPathType.File,
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.targetType).toBe(TreeNodeType.File);
			expect(result.segmentIdChainToParent).toHaveLength(2);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Library${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[1]).toBe(
				`Parent${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyFile${NodeSegmentIdSeparator}${TreeNodeType.File}${NodeSegmentIdSeparator}pdf`,
			);
		});

		it("creates FileNodeLocator with multiple sectionNames", () => {
			const sp: CanonicalSplitPathToFileInsideLibrary = {
				extension: "docx",
				pathParts: ["Library", "Parent", "Child", "Grandchild"],
				separatedSuffixedBasename: {
					coreName: "MyFile",
					suffixParts: ["Grandchild", "Child", "Parent"],
				},
				type: SplitPathType.File,
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.targetType).toBe(TreeNodeType.File);
			expect(result.segmentIdChainToParent).toHaveLength(4);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Library${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[1]).toBe(
				`Parent${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[2]).toBe(
				`Child${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[3]).toBe(
				`Grandchild${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyFile${NodeSegmentIdSeparator}${TreeNodeType.File}${NodeSegmentIdSeparator}docx`,
			);
		});
	});

	describe("MdFile type", () => {
		it("creates ScrollNodeLocator with empty sectionNames", () => {
			const sp: CanonicalSplitPathToMdFileInsideLibrary = {
				extension: "md",
				pathParts: ["Library"],
				separatedSuffixedBasename: {
					coreName: "MyScroll",
					suffixParts: [],
				},
				type: SplitPathType.MdFile,
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.targetType).toBe(TreeNodeType.Scroll);
			expect(result.segmentIdChainToParent).toHaveLength(1);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Library${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyScroll${NodeSegmentIdSeparator}${TreeNodeType.Scroll}${NodeSegmentIdSeparator}md`,
			);
		});

		it("creates ScrollNodeLocator with single sectionName", () => {
			const sp: CanonicalSplitPathToMdFileInsideLibrary = {
				extension: "md",
				pathParts: ["Library", "Parent"],
				separatedSuffixedBasename: {
					coreName: "MyScroll",
					suffixParts: ["Parent"],
				},
				type: SplitPathType.MdFile,
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.targetType).toBe(TreeNodeType.Scroll);
			expect(result.segmentIdChainToParent).toHaveLength(2);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Library${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[1]).toBe(
				`Parent${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyScroll${NodeSegmentIdSeparator}${TreeNodeType.Scroll}${NodeSegmentIdSeparator}md`,
			);
		});

		it("creates ScrollNodeLocator with multiple sectionNames", () => {
			const sp: CanonicalSplitPathToMdFileInsideLibrary = {
				extension: "md",
				pathParts: ["Library", "Section1", "Section2", "Section3"],
				separatedSuffixedBasename: {
					coreName: "MyScroll",
					suffixParts: ["Section3", "Section2", "Section1"],
				},
				type: SplitPathType.MdFile,
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.targetType).toBe(TreeNodeType.Scroll);
			expect(result.segmentIdChainToParent).toHaveLength(4);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Library${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[1]).toBe(
				`Section1${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[2]).toBe(
				`Section2${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[3]).toBe(
				`Section3${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyScroll${NodeSegmentIdSeparator}${TreeNodeType.Scroll}${NodeSegmentIdSeparator}md`,
			);
		});

		it("always uses 'md' extension regardless of input", () => {
			const sp: CanonicalSplitPathToMdFileInsideLibrary = {
				extension: "md",
				pathParts: ["Library"],
				separatedSuffixedBasename: {
					coreName: "MyScroll",
					suffixParts: [],
				},
				type: SplitPathType.MdFile,
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.segmentId).toBe(
				`MyScroll${NodeSegmentIdSeparator}${TreeNodeType.Scroll}${NodeSegmentIdSeparator}md`,
			);
		});
	});

	describe("Folder type", () => {
		it("creates SectionNodeLocator with empty sectionNames", () => {
			const sp: CanonicalSplitPathToFolderInsideLibrary = {
				pathParts: [],
				separatedSuffixedBasename: {
					coreName: "MyFolder",
					suffixParts: [],
				},
				type: SplitPathType.Folder,
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.targetType).toBe(TreeNodeType.Section);
			expect(result.segmentIdChainToParent).toEqual([]);
			expect(result.segmentId).toBe(
				`MyFolder${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
		});

		it("creates SectionNodeLocator with single sectionName", () => {
			const sp: CanonicalSplitPathToFolderInsideLibrary = {
				pathParts: ["Library", "Parent"],
				separatedSuffixedBasename: {
					coreName: "MyFolder",
					suffixParts: [],
				},
				type: SplitPathType.Folder,
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.targetType).toBe(TreeNodeType.Section);
			expect(result.segmentIdChainToParent).toHaveLength(2);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Library${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[1]).toBe(
				`Parent${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyFolder${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
		});

		it("creates SectionNodeLocator with multiple sectionNames", () => {
			const sp: CanonicalSplitPathToFolderInsideLibrary = {
				pathParts: ["Library", "Level1", "Level2", "Level3"],
				separatedSuffixedBasename: {
					coreName: "MyFolder",
					suffixParts: [],
				},
				type: SplitPathType.Folder,
			};

			const result = makeLocatorFromCanonicalSplitPathInsideLibrary(sp);

			expect(result.targetType).toBe(TreeNodeType.Section);
			expect(result.segmentIdChainToParent).toHaveLength(4);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Library${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[1]).toBe(
				`Level1${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[2]).toBe(
				`Level2${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[3]).toBe(
				`Level3${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyFolder${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
		});
	});
});
