import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse } from "../../../../../src/commanders/librarian-old/naming/deprecated-codexes/tree-node-to-split-path-codec";
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

describe("treeNodeToSuffixedSplitPathCodec", () => {
	describe("decode (TreeNode → SplitPath)", () => {
		describe("Section", () => {
			it("decodes root section", () => {
				const node = {
					children: [],
					nodeName: "Library",
					nodeNameChainToParent: [],
					status: TreeNodeStatus.NotStarted,
					type: TreeNodeType.Section,
				};
				const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.decode(node);
				expect(result).toEqual({
					basename: "Library",
					pathParts: [],
					type: SplitPathType.Folder,
				});
			});

			it("decodes nested section", () => {
				const node = {
					children: [],
					nodeName: "Child",
					nodeNameChainToParent: ["Library", "Parent"],
					status: TreeNodeStatus.NotStarted,
					type: TreeNodeType.Section,
				};
				const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.decode(node);
				expect(result).toEqual({
					basename: "Child",
					pathParts: ["Library", "Parent"],
					type: SplitPathType.Folder,
				});
			});

			it("decodes deeply nested section", () => {
				const node = {
					children: [],
					nodeName: "Deep",
					nodeNameChainToParent: ["Library", "Parent", "Child"],
					status: TreeNodeStatus.NotStarted,
					type: TreeNodeType.Section,
				};
				const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.decode(node);
				expect(result).toEqual({
					basename: "Deep",
					pathParts: ["Library", "Parent", "Child"],
					type: SplitPathType.Folder,
				});
			});
		});

		describe("Scroll", () => {
			it("decodes root-level scroll", () => {
				const node = {
					extension: "md",
					nodeName: "Note",
					nodeNameChainToParent: ["Library"],
					status: TreeNodeStatus.NotStarted,
					type: TreeNodeType.Scroll,
				};
				const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.decode(node);
				expect(result).toEqual({
					basename: "Note",
					extension: "md",
					pathParts: ["Library"],
					type: SplitPathType.MdFile,
				});
			});

			it("decodes nested scroll", () => {
				const node = {
					extension: "md",
					nodeName: "Note",
					nodeNameChainToParent: ["Library", "Parent"],
					status: TreeNodeStatus.NotStarted,
					type: TreeNodeType.Scroll,
				};
				const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.decode(node);
				expect(result).toEqual({
					basename: "Note-Parent",
					extension: "md",
					pathParts: ["Library", "Parent"],
					type: SplitPathType.MdFile,
				});
			});

			it("decodes deeply nested scroll", () => {
				const node = {
					extension: "md",
					nodeName: "Note",
					nodeNameChainToParent: ["Library", "Parent", "Child"],
					status: TreeNodeStatus.NotStarted,
					type: TreeNodeType.Scroll,
				};
				const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.decode(node);
				expect(result).toEqual({
					basename: "Note-Child-Parent",
					extension: "md",
					pathParts: ["Library", "Parent", "Child"],
					type: SplitPathType.MdFile,
				});
			});
		});

		describe("File", () => {
			it("decodes root-level file", () => {
				const node = {
					extension: "png",
					nodeName: "Image",
					nodeNameChainToParent: ["Library"],
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.File,
				};
				const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.decode(node);
				expect(result).toEqual({
					basename: "Image",
					extension: "png",
					pathParts: ["Library"],
					type: SplitPathType.File,
				});
			});

			it("decodes nested file", () => {
				const node = {
					extension: "png",
					nodeName: "Image",
					nodeNameChainToParent: ["Library", "Parent"],
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.File,
				};
				const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.decode(node);
				expect(result).toEqual({
					basename: "Image-Parent",
					extension: "png",
					pathParts: ["Library", "Parent"],
					type: SplitPathType.File,
				});
			});
		});
	});

	describe("encode (SplitPath → TreeNode)", () => {
		describe("Section (Folder)", () => {
			it("encodes root section", () => {
				const splitPath = {
					basename: "Library",
					pathParts: [],
					type: SplitPathType.Folder,
				};
				const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.encode(splitPath);
				expect(result).toEqual({
					children: [],
					nodeName: "Library",
					nodeNameChainToParent: [],
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.Section,
				});
			});

			it("encodes nested section", () => {
				const splitPath = {
					basename: "Child",
					pathParts: ["Library", "Parent"],
					type: SplitPathType.Folder,
				};
				const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.encode(splitPath);
				expect(result).toEqual({
					children: [],
					nodeName: "Child",
					nodeNameChainToParent: ["Library", "Parent"],
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.Section,
				});
			});

			it("encodes deeply nested section", () => {
				const splitPath = {
					basename: "Deep",
					pathParts: ["Library", "Parent", "Child"],
					type: SplitPathType.Folder,
				};
				const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.encode(splitPath);
				expect(result).toEqual({
					children: [],
					nodeName: "Deep",
					nodeNameChainToParent: ["Library", "Parent", "Child"],
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.Section,
				});
			});
		});

		describe("Scroll (MdFile)", () => {
			it("encodes root-level scroll", () => {
				const splitPath = {
					basename: "Note",
					extension: "md",
					pathParts: ["Library"],
					type: SplitPathType.MdFile,
				};
				const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.encode(splitPath);
				expect(result).toEqual({
					extension: "md",
					nodeName: "Note",
					nodeNameChainToParent: ["Library"],
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.Scroll,
				});
			});

			it("encodes nested scroll", () => {
				const splitPath = {
					basename: "Note-Parent",
					extension: "md",
					pathParts: ["Library", "Parent"],
					type: SplitPathType.MdFile,
				};
				const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.encode(splitPath);
				expect(result).toEqual({
					extension: "md",
					nodeName: "Note",
					nodeNameChainToParent: ["Library", "Parent"],
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.Scroll,
				});
			});

			it("encodes deeply nested scroll", () => {
				const splitPath = {
					basename: "Note-Child-Parent",
					extension: "md",
					pathParts: ["Library", "Parent", "Child"],
					type: SplitPathType.MdFile,
				};
				const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.encode(splitPath);
				expect(result).toEqual({
					extension: "md",
					nodeName: "Note",
					nodeNameChainToParent: ["Library", "Parent", "Child"],
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.Scroll,
				});
			});
		});

		describe("File", () => {
			it("encodes root-level file", () => {
				const splitPath = {
					basename: "Image",
					extension: "png",
					pathParts: ["Library"],
					type: SplitPathType.File,
				};
				const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.encode(splitPath);
				expect(result).toEqual({
					extension: "png",
					nodeName: "Image",
					nodeNameChainToParent: ["Library"],
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.File,
				});
			});

			it("encodes nested file", () => {
				const splitPath = {
					basename: "Image-Parent",
					extension: "png",
					pathParts: ["Library", "Parent"],
					type: SplitPathType.File,
				};
				const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.encode(splitPath);
				expect(result).toEqual({
					extension: "png",
					nodeName: "Image",
					nodeNameChainToParent: ["Library", "Parent"],
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.File,
				});
			});
		});
	});

	describe("roundtrip (encode/decode)", () => {
		it("roundtrips root section", () => {
			const node = {
				children: [],
				nodeName: "Library",
				nodeNameChainToParent: [],
				status: TreeNodeStatus.NotStarted,
				type: TreeNodeType.Section,
			};
			const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.encode(
				treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.decode(node),
			);
			expect(result).toMatchObject({
				nodeName: node.nodeName,
				nodeNameChainToParent: node.nodeNameChainToParent,
				type: node.type,
			});
		});

		it("roundtrips nested section", () => {
			const node = {
				children: [],
				nodeName: "Child",
				nodeNameChainToParent: ["Parent"],
				status: TreeNodeStatus.NotStarted,
				type: TreeNodeType.Section,
			};
			const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.encode(
				treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.decode(node),
			);
			expect(result).toMatchObject({
				nodeName: node.nodeName,
				nodeNameChainToParent: node.nodeNameChainToParent,
				type: node.type,
			});
		});

		it("roundtrips root-level scroll", () => {
			const node = {
				extension: "md",
				nodeName: "Note",
				nodeNameChainToParent: [],
				status: TreeNodeStatus.NotStarted,
				type: TreeNodeType.Scroll,
			};
			const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.encode(
				treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.decode(node),
			);
			expect(result).toMatchObject({
				nodeName: node.nodeName,
				nodeNameChainToParent: node.nodeNameChainToParent,
				type: node.type,
			});
		});

		it("roundtrips nested scroll", () => {
			const node = {
				extension: "md",
				nodeName: "Note",
				nodeNameChainToParent: ["Parent", "Child"],
				status: TreeNodeStatus.NotStarted,
				type: TreeNodeType.Scroll,
			};
			const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.encode(
				treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.decode(node),
			);
			expect(result).toMatchObject({
				nodeName: node.nodeName,
				nodeNameChainToParent: node.nodeNameChainToParent,
				type: node.type,
			});
		});

		it("roundtrips nested file", () => {
			const node = {
				extension: "png",
				nodeName: "Image",
				nodeNameChainToParent: ["Parent"],
				status: TreeNodeStatus.Unknown,
				type: TreeNodeType.File,
			};
			const result = treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.encode(
				treeNodeToSuffixedSplitPathCodecDeprecatedDoNotUse.decode(node),
			);
			expect(result).toMatchObject({
				nodeName: node.nodeName,
				nodeNameChainToParent: node.nodeNameChainToParent,
				type: node.type,
			});
		});
	});
});

