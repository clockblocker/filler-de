import { describe, expect, it } from "bun:test";
import type {
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
} from "../../../../../../src/commanders/librarian-new/library-tree/tree-action/utils/canonical-split-path-utils/types";
import { makeLocatorFromLibraryScopedCanonicalSplitPath } from "../../../../../../src/commanders/librarian-new/library-tree/tree-action/utils/make-locator";
import { TreeNodeType } from "../../../../../../src/commanders/librarian-new/library-tree/tree-node/types/atoms";
import { NodeSegmentIdSeparator } from "../../../../../../src/commanders/librarian-new/library-tree/tree-node/types/node-segment-id";
import { SplitPathType } from "../../../../../../src/obsidian-vault-action-manager/types/split-path";

describe("makeLocatorFromLibraryScopedCanonicalSplitPath", () => {
	describe("File type", () => {
		it("creates FileNodeLocator with empty sectionNames", () => {
			const sp: CanonicalSplitPathToFileInsideLibrary = {
				extension: "txt",
				nodeName: "MyFile",
				pathParts: [],
				sectionNames: [],
				type: SplitPathType.File,
			};

			const result = makeLocatorFromLibraryScopedCanonicalSplitPath(sp);

			expect(result.targetType).toBe(TreeNodeType.File);
			expect(result.segmentIdChainToParent).toEqual([]);
			expect(result.segmentId).toBe(
				`MyFile${NodeSegmentIdSeparator}${TreeNodeType.File}${NodeSegmentIdSeparator}txt`,
			);
		});

		it("creates FileNodeLocator with single sectionName", () => {
			const sp: CanonicalSplitPathToFileInsideLibrary = {
				extension: "pdf",
				nodeName: "MyFile",
				pathParts: [],
				sectionNames: ["Parent"],
				type: SplitPathType.File,
			};

			const result = makeLocatorFromLibraryScopedCanonicalSplitPath(sp);

			expect(result.targetType).toBe(TreeNodeType.File);
			expect(result.segmentIdChainToParent).toHaveLength(1);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Parent${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyFile${NodeSegmentIdSeparator}${TreeNodeType.File}${NodeSegmentIdSeparator}pdf`,
			);
		});

		it("creates FileNodeLocator with multiple sectionNames", () => {
			const sp: CanonicalSplitPathToFileInsideLibrary = {
				extension: "docx",
				nodeName: "MyFile",
				pathParts: [],
				sectionNames: ["Parent", "Child", "Grandchild"],
				type: SplitPathType.File,
			};

			const result = makeLocatorFromLibraryScopedCanonicalSplitPath(sp);

			expect(result.targetType).toBe(TreeNodeType.File);
			expect(result.segmentIdChainToParent).toHaveLength(3);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Parent${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[1]).toBe(
				`Child${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[2]).toBe(
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
				nodeName: "MyScroll",
				pathParts: [],
				sectionNames: [],
				type: SplitPathType.MdFile,
			};

			const result = makeLocatorFromLibraryScopedCanonicalSplitPath(sp);

			expect(result.targetType).toBe(TreeNodeType.Scroll);
			expect(result.segmentIdChainToParent).toEqual([]);
			expect(result.segmentId).toBe(
				`MyScroll${NodeSegmentIdSeparator}${TreeNodeType.Scroll}${NodeSegmentIdSeparator}md`,
			);
		});

		it("creates ScrollNodeLocator with single sectionName", () => {
			const sp: CanonicalSplitPathToMdFileInsideLibrary = {
				extension: "md",
				nodeName: "MyScroll",
				pathParts: [],
				sectionNames: ["Parent"],
				type: SplitPathType.MdFile,
			};

			const result = makeLocatorFromLibraryScopedCanonicalSplitPath(sp);

			expect(result.targetType).toBe(TreeNodeType.Scroll);
			expect(result.segmentIdChainToParent).toHaveLength(1);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Parent${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyScroll${NodeSegmentIdSeparator}${TreeNodeType.Scroll}${NodeSegmentIdSeparator}md`,
			);
		});

		it("creates ScrollNodeLocator with multiple sectionNames", () => {
			const sp: CanonicalSplitPathToMdFileInsideLibrary = {
				extension: "md",
				nodeName: "MyScroll",
				pathParts: [],
				sectionNames: ["Section1", "Section2", "Section3"],
				type: SplitPathType.MdFile,
			};

			const result = makeLocatorFromLibraryScopedCanonicalSplitPath(sp);

			expect(result.targetType).toBe(TreeNodeType.Scroll);
			expect(result.segmentIdChainToParent).toHaveLength(3);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Section1${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[1]).toBe(
				`Section2${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[2]).toBe(
				`Section3${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyScroll${NodeSegmentIdSeparator}${TreeNodeType.Scroll}${NodeSegmentIdSeparator}md`,
			);
		});

		it("always uses 'md' extension regardless of input", () => {
			const sp: CanonicalSplitPathToMdFileInsideLibrary = {
				extension: "md",
				nodeName: "MyScroll",
				pathParts: [],
				sectionNames: [],
				type: SplitPathType.MdFile,
			};

			const result = makeLocatorFromLibraryScopedCanonicalSplitPath(sp);

			expect(result.segmentId).toBe(
				`MyScroll${NodeSegmentIdSeparator}${TreeNodeType.Scroll}${NodeSegmentIdSeparator}md`,
			);
		});
	});

	describe("Folder type", () => {
		it("creates SectionNodeLocator with empty sectionNames", () => {
			const sp: CanonicalSplitPathToFolderInsideLibrary = {
				nodeName: "MyFolder",
				pathParts: [],
				sectionNames: [],
				type: SplitPathType.Folder,
			};

			const result = makeLocatorFromLibraryScopedCanonicalSplitPath(sp);

			expect(result.targetType).toBe(TreeNodeType.Section);
			expect(result.segmentIdChainToParent).toEqual([]);
			expect(result.segmentId).toBe(
				`MyFolder${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
		});

		it("creates SectionNodeLocator with single sectionName", () => {
			const sp: CanonicalSplitPathToFolderInsideLibrary = {
				nodeName: "MyFolder",
				pathParts: [],
				sectionNames: ["Parent"],
				type: SplitPathType.Folder,
			};

			const result = makeLocatorFromLibraryScopedCanonicalSplitPath(sp);

			expect(result.targetType).toBe(TreeNodeType.Section);
			expect(result.segmentIdChainToParent).toHaveLength(1);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Parent${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyFolder${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
		});

		it("creates SectionNodeLocator with multiple sectionNames", () => {
			const sp: CanonicalSplitPathToFolderInsideLibrary = {
				nodeName: "MyFolder",
				pathParts: [],
				sectionNames: ["Level1", "Level2", "Level3"],
				type: SplitPathType.Folder,
			};

			const result = makeLocatorFromLibraryScopedCanonicalSplitPath(sp);

			expect(result.targetType).toBe(TreeNodeType.Section);
			expect(result.segmentIdChainToParent).toHaveLength(3);
			expect(result.segmentIdChainToParent[0]).toBe(
				`Level1${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[1]).toBe(
				`Level2${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentIdChainToParent[2]).toBe(
				`Level3${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
			expect(result.segmentId).toBe(
				`MyFolder${NodeSegmentIdSeparator}${TreeNodeType.Section}${NodeSegmentIdSeparator}`,
			);
		});
	});
});

