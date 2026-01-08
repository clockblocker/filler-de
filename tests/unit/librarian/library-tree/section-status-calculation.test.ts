import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { TFolder } from "obsidian";
import { LibraryTreeDeprecated } from "../../../../src/commanders/librarian-old/library-tree";
import type { TreeLeafDeprecated } from "../../../../src/commanders/librarian-old/types/tree-node";
import {
	type SectionNodeDeprecated,
	TreeNodeStatusDeprecated,
	TreeNodeTypeDeprecated,
} from "../../../../src/commanders/librarian-old/types/tree-node";
import * as globalState from "../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../src/global-state/parsed-settings";
import { SplitPathType } from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";

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
	status: typeof TreeNodeStatusDeprecated.Done | typeof TreeNodeStatusDeprecated.NotStarted = TreeNodeStatusDeprecated.NotStarted,
): TreeLeafDeprecated => ({
	extension: "md",
	nodeName,
	nodeNameChainToParent: ["Library", ...nodeNameChainToParent], // Include library root
	status,
	type: TreeNodeTypeDeprecated.Scroll,
});

describe("LibraryTree section status calculation", () => {
	describe("after construction", () => {
		it("section with all NotStarted children is NotStarted", () => {
			const leaves: TreeLeafDeprecated[] = [
				createScrollLeaf("Note1", ["folder"], TreeNodeStatusDeprecated.NotStarted),
				createScrollLeaf("Note2", ["folder"], TreeNodeStatusDeprecated.NotStarted),
			];

			const tree = new LibraryTreeDeprecated(leaves);
			const folder = tree.getNode(["Library", "folder"]) as SectionNodeDeprecated;

			expect(folder.status).toBe(TreeNodeStatusDeprecated.NotStarted);
		});

		it("section with all Done children is Done", () => {
			const leaves: TreeLeafDeprecated[] = [
				createScrollLeaf("Note1", ["folder"], TreeNodeStatusDeprecated.Done),
				createScrollLeaf("Note2", ["folder"], TreeNodeStatusDeprecated.Done),
			];

			const tree = new LibraryTreeDeprecated(leaves);
			const folder = tree.getNode(["Library", "folder"]) as SectionNodeDeprecated;

			expect(folder.status).toBe(TreeNodeStatusDeprecated.Done);
		});

		it("section with mixed children is NotStarted", () => {
			const leaves: TreeLeafDeprecated[] = [
				createScrollLeaf("Note1", ["folder"], TreeNodeStatusDeprecated.Done),
				createScrollLeaf("Note2", ["folder"], TreeNodeStatusDeprecated.NotStarted),
			];

			const tree = new LibraryTreeDeprecated(leaves);
			const folder = tree.getNode(["Library", "folder"]) as SectionNodeDeprecated;

			expect(folder.status).toBe(TreeNodeStatusDeprecated.NotStarted);
		});

		it("nested sections propagate status up", () => {
			const leaves: TreeLeafDeprecated[] = [
				createScrollLeaf("Note1", ["parent", "child"], TreeNodeStatusDeprecated.Done),
				createScrollLeaf("Note2", ["parent", "child"], TreeNodeStatusDeprecated.Done),
			];

			const tree = new LibraryTreeDeprecated(leaves);
			const child = tree.getNode(["Library", "parent", "child"]) as SectionNodeDeprecated;
			const parent = tree.getNode(["Library", "parent"]) as SectionNodeDeprecated;

			expect(child.status).toBe(TreeNodeStatusDeprecated.Done);
			expect(parent.status).toBe(TreeNodeStatusDeprecated.Done);
		});

		it("parent is NotStarted if any child section is NotStarted", () => {
			const leaves: TreeLeafDeprecated[] = [
				createScrollLeaf("Note1", ["parent", "doneChild"], TreeNodeStatusDeprecated.Done),
				createScrollLeaf("Note2", ["parent", "notStartedChild"], TreeNodeStatusDeprecated.NotStarted),
			];

			const tree = new LibraryTreeDeprecated(leaves);
			const doneChild = tree.getNode(["Library", "parent", "doneChild"]) as SectionNodeDeprecated;
			const notStartedChild = tree.getNode(["Library", "parent", "notStartedChild"]) as SectionNodeDeprecated;
			const parent = tree.getNode(["Library", "parent"]) as SectionNodeDeprecated;

			expect(doneChild.status).toBe(TreeNodeStatusDeprecated.Done);
			expect(notStartedChild.status).toBe(TreeNodeStatusDeprecated.NotStarted);
			expect(parent.status).toBe(TreeNodeStatusDeprecated.NotStarted);
		});

		it("FileNodes (Unknown status) are ignored in calculation", () => {
			const leaves: TreeLeafDeprecated[] = [
				createScrollLeaf("Note1", ["folder"], TreeNodeStatusDeprecated.Done),
				{
					extension: "pdf",
					nodeName: "doc",
					nodeNameChainToParent: ["Library", "folder"],
					status: TreeNodeStatusDeprecated.Unknown,
					type: TreeNodeTypeDeprecated.File,
				},
			];

			const tree = new LibraryTreeDeprecated(leaves);
			const folder = tree.getNode(["Library", "folder"]) as SectionNodeDeprecated;

			expect(folder.status).toBe(TreeNodeStatusDeprecated.Done);
		});

		it("empty section is Done", () => {
			// Create a section by having a leaf in a nested path, then check sibling empty section
			// Actually, empty sections aren't created by leaves. Let's test root with no children.
			const leaves: TreeLeafDeprecated[] = [];

			const tree = new LibraryTreeDeprecated(leaves);
			const root = tree.getNode([]) as SectionNodeDeprecated; // Empty chain = library root

			expect(root.status).toBe(TreeNodeStatusDeprecated.Done);
		});

		it("root status reflects all descendants", () => {
			const leaves: TreeLeafDeprecated[] = [
				createScrollLeaf("A", ["x", "y"], TreeNodeStatusDeprecated.Done),
				createScrollLeaf("B", ["x", "z"], TreeNodeStatusDeprecated.Done),
				createScrollLeaf("C", ["w"], TreeNodeStatusDeprecated.NotStarted),
			];

			const tree = new LibraryTreeDeprecated(leaves);
			const root = tree.getNode([]) as SectionNodeDeprecated; // Empty chain = library root

			expect(root.status).toBe(TreeNodeStatusDeprecated.NotStarted);
		});
	});
});
