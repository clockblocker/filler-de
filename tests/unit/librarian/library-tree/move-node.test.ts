import type { TFolder } from "obsidian";
import { describe, expect, it } from "vitest";
import { LibraryTree } from "../../../../src/commanders/librarian/library-tree";
import { TreeActionType } from "../../../../src/commanders/librarian/types/literals";
import type { TreeLeaf } from "../../../../src/commanders/librarian/types/tree-node";
import {
	type SectionNode,
	TreeNodeStatus,
	TreeNodeType,
} from "../../../../src/commanders/librarian/types/tree-node";

const fakeRootFolder = { name: "Library" } as unknown as TFolder;

const createScrollLeaf = (
	coreName: string,
	coreNameChainToParent: string[],
	status:
		| typeof TreeNodeStatus.Done
		| typeof TreeNodeStatus.NotStarted = TreeNodeStatus.NotStarted,
): TreeLeaf => ({
	coreName,
	coreNameChainToParent,
	extension: "md",
	status,
	type: TreeNodeType.Scroll,
});

describe("LibraryTree MoveNode", () => {
	describe("basic move", () => {
		it("moves node to new parent", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("Note", ["A"]),
				createScrollLeaf("Other", ["B"]),
			];
			const tree = new LibraryTree(leaves, fakeRootFolder);

			// Move Note from A to B
			tree.applyTreeAction({
				payload: {
					coreNameChain: ["A", "Note"],
					newCoreNameChainToParent: ["B"],
				},
				type: TreeActionType.MoveNode,
			});

			// Node should exist at new location
			const movedNode = tree.getNode(["B", "Note"]);
			expect(movedNode).not.toBeNull();
			expect(movedNode?.coreName).toBe("Note");
			expect(movedNode?.coreNameChainToParent).toEqual(["B"]);

			// Node should not exist at old location
			const oldNode = tree.getNode(["A", "Note"]);
			expect(oldNode).toBeNull();
		});

		it("returns old and new parent chains", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("Note", ["A"]),
				createScrollLeaf("Other", ["B"]),
			];
			const tree = new LibraryTree(leaves, fakeRootFolder);

			const result = tree.applyTreeAction({
				payload: {
					coreNameChain: ["A", "Note"],
					newCoreNameChainToParent: ["B"],
				},
				type: TreeActionType.MoveNode,
			});

			expect(result).toEqual([["A"], ["B"]]);
		});
	});

	describe("creates parent path if needed", () => {
		it("creates intermediate sections", () => {
			const leaves: TreeLeaf[] = [createScrollLeaf("Note", ["A"])];
			const tree = new LibraryTree(leaves, fakeRootFolder);

			// Move to non-existent path B/C
			tree.applyTreeAction({
				payload: {
					coreNameChain: ["A", "Note"],
					newCoreNameChainToParent: ["B", "C"],
				},
				type: TreeActionType.MoveNode,
			});

			// Sections should be created
			expect(tree.getNode(["B"])).not.toBeNull();
			expect(tree.getNode(["B", "C"])).not.toBeNull();

			// Node at new location
			const movedNode = tree.getNode(["B", "C", "Note"]);
			expect(movedNode).not.toBeNull();
		});
	});

	describe("updates section children chains", () => {
		it("updates children coreNameChainToParent recursively", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("Note1", ["A", "B"]),
				createScrollLeaf("Note2", ["A", "B"]),
				createScrollLeaf("Other", ["C"]),
			];
			const tree = new LibraryTree(leaves, fakeRootFolder);

			// Move section B from A to C
			tree.applyTreeAction({
				payload: {
					coreNameChain: ["A", "B"],
					newCoreNameChainToParent: ["C"],
				},
				type: TreeActionType.MoveNode,
			});

			// Section B should be under C now
			const sectionB = tree.getNode(["C", "B"]) as SectionNode;
			expect(sectionB).not.toBeNull();
			expect(sectionB.coreNameChainToParent).toEqual(["C"]);

			// Children should have updated chains
			const note1 = tree.getNode(["C", "B", "Note1"]);
			expect(note1).not.toBeNull();
			expect(note1?.coreNameChainToParent).toEqual(["C", "B"]);

			const note2 = tree.getNode(["C", "B", "Note2"]);
			expect(note2).not.toBeNull();
			expect(note2?.coreNameChainToParent).toEqual(["C", "B"]);
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
			const tree = new LibraryTree(leaves, fakeRootFolder);

			const sectionA = tree.getNode(["A"]) as SectionNode;
			expect(sectionA.status).toBe(TreeNodeStatus.NotStarted);

			// Move NotStarted note to B
			tree.applyTreeAction({
				payload: {
					coreNameChain: ["A", "NotStartedNote"],
					newCoreNameChainToParent: ["B"],
				},
				type: TreeActionType.MoveNode,
			});

			// A should now be Done (only Done children left)
			const updatedA = tree.getNode(["A"]) as SectionNode;
			expect(updatedA.status).toBe(TreeNodeStatus.Done);
		});

		it("recalculates new parent status after move", () => {
			// B has all Done → B is Done
			// After moving NotStarted in, B should become NotStarted
			const leaves: TreeLeaf[] = [
				createScrollLeaf("NotStartedNote", ["A"], TreeNodeStatus.NotStarted),
				createScrollLeaf("DoneNote", ["B"], TreeNodeStatus.Done),
			];
			const tree = new LibraryTree(leaves, fakeRootFolder);

			const sectionB = tree.getNode(["B"]) as SectionNode;
			expect(sectionB.status).toBe(TreeNodeStatus.Done);

			// Move NotStarted note to B
			tree.applyTreeAction({
				payload: {
					coreNameChain: ["A", "NotStartedNote"],
					newCoreNameChainToParent: ["B"],
				},
				type: TreeActionType.MoveNode,
			});

			// B should now be NotStarted
			const updatedB = tree.getNode(["B"]) as SectionNode;
			expect(updatedB.status).toBe(TreeNodeStatus.NotStarted);
		});
	});

	describe("error handling", () => {
		it("throws if target already exists", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("Note", ["A"]),
				createScrollLeaf("Note", ["B"]), // Same name in B
			];
			const tree = new LibraryTree(leaves, fakeRootFolder);

			expect(() =>
				tree.applyTreeAction({
					payload: {
						coreNameChain: ["A", "Note"],
						newCoreNameChainToParent: ["B"],
					},
					type: TreeActionType.MoveNode,
				}),
			).toThrow("Node already exists: B/Note");
		});

		it("returns chains if node not found", () => {
			const leaves: TreeLeaf[] = [createScrollLeaf("Note", ["A"])];
			const tree = new LibraryTree(leaves, fakeRootFolder);

			const result = tree.applyTreeAction({
				payload: {
					coreNameChain: ["X", "NonExistent"],
					newCoreNameChainToParent: ["B"],
				},
				type: TreeActionType.MoveNode,
			});

			expect(result).toEqual([["X", "NonExistent"], ["B"]]);
		});
	});
});
