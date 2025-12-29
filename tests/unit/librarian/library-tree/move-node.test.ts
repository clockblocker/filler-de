import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { TFolder } from "obsidian";
import { LibraryTreeDeprecated } from "../../../../src/commanders/librarian-old/library-tree";
import { TreeActionType } from "../../../../src/commanders/librarian-old/types/literals";
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
	status:
		| typeof TreeNodeStatus.Done
		| typeof TreeNodeStatus.NotStarted = TreeNodeStatus.NotStarted,
): TreeLeaf => ({
	extension: "md",
	nodeName,
	nodeNameChainToParent: ["Library", ...nodeNameChainToParent], // Include library root
	status,
	type: TreeNodeType.Scroll,
});

describe("LibraryTreeD MoveNode", () => {
	describe("basic move", () => {
		it("moves node to new parent", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("Note", ["A"]),
				createScrollLeaf("Other", ["B"]),
			];
			const tree = new LibraryTreeDeprecated(leaves);

			// Move Note from A to B
			tree.applyTreeAction({
				payload: {
					newNodeNameChainToParent: ["Library", "B"],
					nodeNameChain: ["Library", "A", "Note"],
				},
				type: TreeActionType.MoveNode,
			});

			// Node should exist at new location
			const movedNode = tree.getNode(["Library", "B", "Note"]);
			expect(movedNode).not.toBeNull();
			expect(movedNode?.nodeName).toBe("Note");
			expect(movedNode?.nodeNameChainToParent).toEqual(["Library", "B"]);

			// Node should not exist at old location
			const oldNode = tree.getNode(["Library", "A", "Note"]);
			expect(oldNode).toBeNull();
		});

		it("returns old and new parent chains", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("Note", ["A"]),
				createScrollLeaf("Other", ["B"]),
			];
			const tree = new LibraryTreeDeprecated(leaves);

			const result = tree.applyTreeAction({
				payload: {
					newNodeNameChainToParent: ["Library", "B"],
					nodeNameChain: ["Library", "A", "Note"],
				},
				type: TreeActionType.MoveNode,
			});

			expect(result).toEqual([["Library", "A"], ["Library", "B"]]);
		});
	});

	describe("creates parent path if needed", () => {
		it("creates intermediate sections", () => {
			const leaves: TreeLeaf[] = [createScrollLeaf("Note", ["A"])];
			const tree = new LibraryTreeDeprecated(leaves);

			// Move to non-existent path B/C
			tree.applyTreeAction({
				payload: {
					newNodeNameChainToParent: ["Library", "B", "C"],
					nodeNameChain: ["Library", "A", "Note"],
				},
				type: TreeActionType.MoveNode,
			});

			// Sections should be created
			expect(tree.getNode(["Library", "B"])).not.toBeNull();
			expect(tree.getNode(["Library", "B", "C"])).not.toBeNull();

			// Node at new location
			const movedNode = tree.getNode(["Library", "B", "C", "Note"]);
			expect(movedNode).not.toBeNull();
		});
	});

	describe("updates section children chains", () => {
		it("updates children nodeNameChainToParent recursively", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("Note1", ["A", "B"]),
				createScrollLeaf("Note2", ["A", "B"]),
				createScrollLeaf("Other", ["C"]),
			];
			const tree = new LibraryTreeDeprecated(leaves);

			// Move section B from A to C
			tree.applyTreeAction({
				payload: {
					newNodeNameChainToParent: ["Library", "C"],
					nodeNameChain: ["Library", "A", "B"],
				},
				type: TreeActionType.MoveNode,
			});

			// Section B should be under C now
			const sectionB = tree.getNode(["Library", "C", "B"]) as SectionNode;
			expect(sectionB).not.toBeNull();
			expect(sectionB.nodeNameChainToParent).toEqual(["Library", "C"]);

			// Children should have updated chains
			const note1 = tree.getNode(["Library", "C", "B", "Note1"]);
			expect(note1).not.toBeNull();
			expect(note1?.nodeNameChainToParent).toEqual(["Library", "C", "B"]);

			const note2 = tree.getNode(["Library", "C", "B", "Note2"]);
			expect(note2).not.toBeNull();
			expect(note2?.nodeNameChainToParent).toEqual(["Library", "C", "B"]);
		});
	});

	describe("status recalculation", () => {
		it("recalculates old parent status after move", () => {
			// A has one Done and one NotStarted → A is NotStarted
			// After moving NotStarted out, A should become Done
			const leaves: TreeLeaf[] = [
				createScrollLeaf("DoneNote", ["A"], TreeNodeStatus.Done),
				createScrollLeaf("NotStartedNote", ["A"], TreeNodeStatus.NotStarted),
				createScrollLeaf("Other", ["B"]),
			];
			const tree = new LibraryTreeDeprecated(leaves);

			const sectionA = tree.getNode(["Library", "A"]) as SectionNode;
			expect(sectionA.status).toBe(TreeNodeStatus.NotStarted);

			// Move NotStarted note to B
			tree.applyTreeAction({
				payload: {
					newNodeNameChainToParent: ["Library", "B"],
					nodeNameChain: ["Library", "A", "NotStartedNote"],
				},
				type: TreeActionType.MoveNode,
			});

			// A should now be Done (only Done children left)
			const updatedA = tree.getNode(["Library", "A"]) as SectionNode;
			expect(updatedA.status).toBe(TreeNodeStatus.Done);
		});

		it("recalculates new parent status after move", () => {
			// B has all Done → B is Done
			// After moving NotStarted in, B should become NotStarted
			const leaves: TreeLeaf[] = [
				createScrollLeaf("NotStartedNote", ["A"], TreeNodeStatus.NotStarted),
				createScrollLeaf("DoneNote", ["B"], TreeNodeStatus.Done),
			];
			const tree = new LibraryTreeDeprecated(leaves);

			const sectionB = tree.getNode(["Library", "B"]) as SectionNode;
			expect(sectionB.status).toBe(TreeNodeStatus.Done);

			// Move NotStarted note to B
			tree.applyTreeAction({
				payload: {
					newNodeNameChainToParent: ["Library", "B"],
					nodeNameChain: ["Library", "A", "NotStartedNote"],
				},
				type: TreeActionType.MoveNode,
			});

			// B should now be NotStarted
			const updatedB = tree.getNode(["Library", "B"]) as SectionNode;
			expect(updatedB.status).toBe(TreeNodeStatus.NotStarted);
		});
	});

	describe("error handling", () => {
		it("throws if target already exists", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("Note", ["A"]),
				createScrollLeaf("Note", ["B"]), // Same name in B
			];
			const tree = new LibraryTreeDeprecated(leaves);

			expect(() =>
				tree.applyTreeAction({
					payload: {
						newNodeNameChainToParent: ["Library", "B"],
						nodeNameChain: ["Library", "A", "Note"],
					},
					type: TreeActionType.MoveNode,
				}),
			).toThrow("Node already exists: Library/B/Note");
		});

		it("returns chains if node not found", () => {
			const leaves: TreeLeaf[] = [createScrollLeaf("Note", ["A"])];
			const tree = new LibraryTreeDeprecated(leaves);

			const result = tree.applyTreeAction({
				payload: {
					newNodeNameChainToParent: ["Library", "B"],
					nodeNameChain: ["Library", "X", "NonExistent"],
				},
				type: TreeActionType.MoveNode,
			});

			expect(result).toEqual([["Library", "X", "NonExistent"], ["Library", "B"]]);
		});
	});
});
