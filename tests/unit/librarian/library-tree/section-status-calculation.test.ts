import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { TFolder } from "obsidian";
import { LibraryTreeDeprecated } from "../../../../src/commanders/librarian-old/library-tree";
import type { TreeLeaf } from "../../../../src/commanders/librarian-old/types/tree-node";
import {
	type SectionNode,
	TreeNodeStatus,
	TreeNodeType,
} from "../../../../src/commanders/librarian-old/types/tree-node";
import * as globalState from "../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../src/global-state/parsed-settings";
import { SplitPathType } from "../../../../src/obsidian-vault-action-manager/types/split-path";

const fakeRootFolder = { name: "Library" } as unknown as TFolder;

const defaultSettings: ParsedUserSettings = {
	apiProvider: "google",
	googleApiKey: "",
	maxSectionDepth: 6,
	showScrollsInCodexesForDepth: 0,
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

const createScrollLeaf = (
	nodeName: string,
	nodeNameChainToParent: string[],
	status: typeof TreeNodeStatus.Done | typeof TreeNodeStatus.NotStarted = TreeNodeStatus.NotStarted,
): TreeLeaf => ({
	extension: "md",
	nodeName,
	nodeNameChainToParent: ["Library", ...nodeNameChainToParent], // Include library root
	status,
	type: TreeNodeType.Scroll,
});

describe("LibraryTree section status calculation", () => {
	describe("after construction", () => {
		it("section with all NotStarted children is NotStarted", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("Note1", ["folder"], TreeNodeStatus.NotStarted),
				createScrollLeaf("Note2", ["folder"], TreeNodeStatus.NotStarted),
			];

			const tree = new LibraryTreeDeprecated(leaves);
			const folder = tree.getNode(["Library", "folder"]) as SectionNode;

			expect(folder.status).toBe(TreeNodeStatus.NotStarted);
		});

		it("section with all Done children is Done", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("Note1", ["folder"], TreeNodeStatus.Done),
				createScrollLeaf("Note2", ["folder"], TreeNodeStatus.Done),
			];

			const tree = new LibraryTreeDeprecated(leaves);
			const folder = tree.getNode(["Library", "folder"]) as SectionNode;

			expect(folder.status).toBe(TreeNodeStatus.Done);
		});

		it("section with mixed children is NotStarted", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("Note1", ["folder"], TreeNodeStatus.Done),
				createScrollLeaf("Note2", ["folder"], TreeNodeStatus.NotStarted),
			];

			const tree = new LibraryTreeDeprecated(leaves);
			const folder = tree.getNode(["Library", "folder"]) as SectionNode;

			expect(folder.status).toBe(TreeNodeStatus.NotStarted);
		});

		it("nested sections propagate status up", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("Note1", ["parent", "child"], TreeNodeStatus.Done),
				createScrollLeaf("Note2", ["parent", "child"], TreeNodeStatus.Done),
			];

			const tree = new LibraryTreeDeprecated(leaves);
			const child = tree.getNode(["Library", "parent", "child"]) as SectionNode;
			const parent = tree.getNode(["Library", "parent"]) as SectionNode;

			expect(child.status).toBe(TreeNodeStatus.Done);
			expect(parent.status).toBe(TreeNodeStatus.Done);
		});

		it("parent is NotStarted if any child section is NotStarted", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("Note1", ["parent", "doneChild"], TreeNodeStatus.Done),
				createScrollLeaf("Note2", ["parent", "notStartedChild"], TreeNodeStatus.NotStarted),
			];

			const tree = new LibraryTreeDeprecated(leaves);
			const doneChild = tree.getNode(["Library", "parent", "doneChild"]) as SectionNode;
			const notStartedChild = tree.getNode(["Library", "parent", "notStartedChild"]) as SectionNode;
			const parent = tree.getNode(["Library", "parent"]) as SectionNode;

			expect(doneChild.status).toBe(TreeNodeStatus.Done);
			expect(notStartedChild.status).toBe(TreeNodeStatus.NotStarted);
			expect(parent.status).toBe(TreeNodeStatus.NotStarted);
		});

		it("FileNodes (Unknown status) are ignored in calculation", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("Note1", ["folder"], TreeNodeStatus.Done),
				{
					extension: "pdf",
					nodeName: "doc",
					nodeNameChainToParent: ["Library", "folder"],
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.File,
				},
			];

			const tree = new LibraryTreeDeprecated(leaves);
			const folder = tree.getNode(["Library", "folder"]) as SectionNode;

			expect(folder.status).toBe(TreeNodeStatus.Done);
		});

		it("empty section is Done", () => {
			// Create a section by having a leaf in a nested path, then check sibling empty section
			// Actually, empty sections aren't created by leaves. Let's test root with no children.
			const leaves: TreeLeaf[] = [];

			const tree = new LibraryTreeDeprecated(leaves);
			const root = tree.getNode([]) as SectionNode; // Empty chain = library root

			expect(root.status).toBe(TreeNodeStatus.Done);
		});

		it("root status reflects all descendants", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("A", ["x", "y"], TreeNodeStatus.Done),
				createScrollLeaf("B", ["x", "z"], TreeNodeStatus.Done),
				createScrollLeaf("C", ["w"], TreeNodeStatus.NotStarted),
			];

			const tree = new LibraryTreeDeprecated(leaves);
			const root = tree.getNode([]) as SectionNode; // Empty chain = library root

			expect(root.status).toBe(TreeNodeStatus.NotStarted);
		});
	});
});
