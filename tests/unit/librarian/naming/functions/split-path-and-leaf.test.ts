import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { buildCanonicalSplitPathFromNode } from "../../../../../src/commanders/librarian-old/naming/functions/split-path-and-leaf";
import type {
	FileNode,
	ScrollNode,
	SectionNode,
} from "../../../../../src/commanders/librarian-old/types/tree-node";
import { TreeNodeStatus, TreeNodeType } from "../../../../../src/commanders/librarian-old/types/tree-node";
import * as globalState from "../../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../../src/global-state/parsed-settings";
import { SplitPathType } from "../../../../../src/obsidian-vault-action-manager/types/split-path";

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

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = spyOn(globalState, "getParsedUserSettings").mockReturnValue({
		...defaultSettings,
	});
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("buildCanonicalSplitPathFromNode", () => {
	describe("SectionNode → SplitPathToFolder", () => {

		it("builds split path for section that is direct child of root", () => {
			const node: SectionNode = {
				children: [],
				nodeName: "Section",
				nodeNameChainToParent: ["Library"],
				status: TreeNodeStatus.NotStarted,
				type: TreeNodeType.Section,
			};
			const result = buildCanonicalSplitPathFromNode(node);
			expect(result).toEqual({
				basename: "Section",
				pathParts: ["Library"],
				type: SplitPathType.Folder,
			});
		});

		it("builds split path for nested section", () => {
			const node: SectionNode = {
				children: [],
				nodeName: "Child",
				nodeNameChainToParent: ["Library", "Parent"],
				status: TreeNodeStatus.NotStarted,
				type: TreeNodeType.Section,
			};
			const result = buildCanonicalSplitPathFromNode(node);
			expect(result).toEqual({
				basename: "Child",
				pathParts: ["Library", "Parent"],
				type: SplitPathType.Folder,
			});
		});

		it("builds split path for deeply nested section", () => {
			const node: SectionNode = {
				children: [],
				nodeName: "Deep",
				nodeNameChainToParent: ["Library", "Parent", "Child"],
				status: TreeNodeStatus.Done,
				type: TreeNodeType.Section,
			};
			const result = buildCanonicalSplitPathFromNode(node);
			expect(result).toEqual({
				basename: "Deep",
				pathParts: ["Library", "Parent", "Child"],
				type: SplitPathType.Folder,
			});
		});

		it("handles custom library root", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				splitPathToLibraryRoot: {
					basename: "Root",
					pathParts: [],
					type: SplitPathType.Folder,
				},
			});
			const node: SectionNode = {
				children: [],
				nodeName: "Section",
				nodeNameChainToParent: ["Root", "Parent"],
				status: TreeNodeStatus.NotStarted,
				type: TreeNodeType.Section,
			};
			const result = buildCanonicalSplitPathFromNode(node);
			expect(result).toEqual({
				basename: "Section",
				pathParts: ["Root", "Parent"],
				type: SplitPathType.Folder,
			});
		});
	});

	describe("ScrollNode → SplitPathToMdFile", () => {
		it("builds split path for root-level scroll", () => {
			const node: ScrollNode = {
				extension: "md",
				nodeName: "Note",
				nodeNameChainToParent: ["Library"],
				status: TreeNodeStatus.NotStarted,
				type: TreeNodeType.Scroll,
			};
			const result = buildCanonicalSplitPathFromNode(node);
			expect(result).toEqual({
				basename: "Note",
				extension: "md",
				pathParts: ["Library"],
				type: SplitPathType.MdFile,
			});
		});

		it("builds split path for nested scroll", () => {
			const node: ScrollNode = {
				extension: "md",
				nodeName: "Note",
				nodeNameChainToParent: ["Library", "Parent"],
				status: TreeNodeStatus.NotStarted,
				type: TreeNodeType.Scroll,
			};
			const result = buildCanonicalSplitPathFromNode(node);
			expect(result).toEqual({
				basename: "Note-Parent",
				extension: "md",
				pathParts: ["Library", "Parent"],
				type: SplitPathType.MdFile,
			});
		});

		it("builds split path for deeply nested scroll", () => {
			const node: ScrollNode = {
				extension: "md",
				nodeName: "Note",
				nodeNameChainToParent: ["Library", "Parent", "Child"],
				status: TreeNodeStatus.NotStarted,
				type: TreeNodeType.Scroll,
			};
			const result = buildCanonicalSplitPathFromNode(node);
			expect(result).toEqual({
				basename: "Note-Child-Parent",
				extension: "md",
				pathParts: ["Library", "Parent", "Child"],
				type: SplitPathType.MdFile,
			});
		});

		it("handles custom delimiter", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				suffixDelimiter: "::",
			});
			const node: ScrollNode = {
				extension: "md",
				nodeName: "Note",
				nodeNameChainToParent: ["Library", "Parent", "Child"],
				status: TreeNodeStatus.NotStarted,
				type: TreeNodeType.Scroll,
			};
			const result = buildCanonicalSplitPathFromNode(node);
			expect(result).toEqual({
				basename: "Note::Child::Parent",
				extension: "md",
				pathParts: ["Library", "Parent", "Child"],
				type: SplitPathType.MdFile,
			});
		});

		it("handles different status values", () => {
			const node: ScrollNode = {
				extension: "md",
				nodeName: "Note",
				nodeNameChainToParent: ["Library"],
				status: TreeNodeStatus.Done,
				type: TreeNodeType.Scroll,
			};
			const result = buildCanonicalSplitPathFromNode(node);
			expect(result).toEqual({
				basename: "Note",
				extension: "md",
				pathParts: ["Library"],
				type: SplitPathType.MdFile,
			});
		});
	});

	describe("FileNode → SplitPathToFile", () => {
		it("builds split path for root-level file", () => {
			const node: FileNode = {
				extension: "png",
				nodeName: "Image",
				nodeNameChainToParent: ["Library"],
				status: TreeNodeStatus.Unknown,
				type: TreeNodeType.File,
			};
			const result = buildCanonicalSplitPathFromNode(node);
			expect(result).toEqual({
				basename: "Image",
				extension: "png",
				pathParts: ["Library"],
				type: SplitPathType.File,
			});
		});

		it("builds split path for nested file", () => {
			const node: FileNode = {
				extension: "png",
				nodeName: "Image",
				nodeNameChainToParent: ["Library", "Parent"],
				status: TreeNodeStatus.Unknown,
				type: TreeNodeType.File,
			};
			const result = buildCanonicalSplitPathFromNode(node);
			expect(result).toEqual({
				basename: "Image-Parent",
				extension: "png",
				pathParts: ["Library", "Parent"],
				type: SplitPathType.File,
			});
		});

		it("builds split path for deeply nested file", () => {
			const node: FileNode = {
				extension: "jpg",
				nodeName: "Photo",
				nodeNameChainToParent: ["Library", "Parent", "Child"],
				status: TreeNodeStatus.Unknown,
				type: TreeNodeType.File,
			};
			const result = buildCanonicalSplitPathFromNode(node);
			expect(result).toEqual({
				basename: "Photo-Child-Parent",
				extension: "jpg",
				pathParts: ["Library", "Parent", "Child"],
				type: SplitPathType.File,
			});
		});

		it("handles different file extensions", () => {
			const extensions = ["pdf", "txt", "json", "xml"];
			for (const ext of extensions) {
				const node: FileNode = {
					extension: ext,
					nodeName: "Document",
					nodeNameChainToParent: ["Library", "Folder"],
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.File,
				};
				const result = buildCanonicalSplitPathFromNode(node);
				expect(result).toEqual({
					basename: "Document-Folder",
					extension: ext,
					pathParts: ["Library", "Folder"],
					type: SplitPathType.File,
				});
			}
		});

		it("handles custom delimiter", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				suffixDelimiter: "::",
			});
			const node: FileNode = {
				extension: "pdf",
				nodeName: "Doc",
				nodeNameChainToParent: ["Library", "A", "B"],
				status: TreeNodeStatus.Unknown,
				type: TreeNodeType.File,
			};
			const result = buildCanonicalSplitPathFromNode(node);
			expect(result).toEqual({
				basename: "Doc::B::A",
				extension: "pdf",
				pathParts: ["Library", "A", "B"],
				type: SplitPathType.File,
			});
		});
	});

	describe("edge cases", () => {
		it("handles single-character node names", () => {
			const node: ScrollNode = {
				extension: "md",
				nodeName: "A",
				nodeNameChainToParent: ["Library", "B"],
				status: TreeNodeStatus.NotStarted,
				type: TreeNodeType.Scroll,
			};
			const result = buildCanonicalSplitPathFromNode(node);
			expect(result).toEqual({
				basename: "A-B",
				extension: "md",
				pathParts: ["Library", "B"],
				type: SplitPathType.MdFile,
			});
		});

		it("handles very long parent chains", () => {
			const longChain = Array.from({ length: 10 }, (_, i) => `Parent${i}`);
			const node: SectionNode = {
				children: [],
				nodeName: "Final",
				nodeNameChainToParent: ["Library", ...longChain],
				status: TreeNodeStatus.NotStarted,
				type: TreeNodeType.Section,
			};
			const result = buildCanonicalSplitPathFromNode(node);
			expect(result.basename).toBe("Final");
			expect(result.pathParts).toEqual(["Library", ...longChain]);
			expect(result.type).toBe(SplitPathType.Folder);
		});
	});
});

