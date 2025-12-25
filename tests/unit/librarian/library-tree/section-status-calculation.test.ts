import type { TFolder } from "obsidian";
import { describe, expect, it } from "vitest";
import { LibraryTree } from "../../../../src/commanders/librarian/library-tree";
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
	status: typeof TreeNodeStatus.Done | typeof TreeNodeStatus.NotStarted = TreeNodeStatus.NotStarted,
): TreeLeaf => ({
	coreName,
	coreNameChainToParent,
	extension: "md",
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

			const tree = new LibraryTree(leaves, fakeRootFolder);
			const folder = tree.getNode(["folder"]) as SectionNode;

			expect(folder.status).toBe(TreeNodeStatus.NotStarted);
		});

		it("section with all Done children is Done", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("Note1", ["folder"], TreeNodeStatus.Done),
				createScrollLeaf("Note2", ["folder"], TreeNodeStatus.Done),
			];

			const tree = new LibraryTree(leaves, fakeRootFolder);
			const folder = tree.getNode(["folder"]) as SectionNode;

			expect(folder.status).toBe(TreeNodeStatus.Done);
		});

		it("section with mixed children is NotStarted", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("Note1", ["folder"], TreeNodeStatus.Done),
				createScrollLeaf("Note2", ["folder"], TreeNodeStatus.NotStarted),
			];

			const tree = new LibraryTree(leaves, fakeRootFolder);
			const folder = tree.getNode(["folder"]) as SectionNode;

			expect(folder.status).toBe(TreeNodeStatus.NotStarted);
		});

		it("nested sections propagate status up", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("Note1", ["parent", "child"], TreeNodeStatus.Done),
				createScrollLeaf("Note2", ["parent", "child"], TreeNodeStatus.Done),
			];

			const tree = new LibraryTree(leaves, fakeRootFolder);
			const child = tree.getNode(["parent", "child"]) as SectionNode;
			const parent = tree.getNode(["parent"]) as SectionNode;

			expect(child.status).toBe(TreeNodeStatus.Done);
			expect(parent.status).toBe(TreeNodeStatus.Done);
		});

		it("parent is NotStarted if any child section is NotStarted", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("Note1", ["parent", "doneChild"], TreeNodeStatus.Done),
				createScrollLeaf("Note2", ["parent", "notStartedChild"], TreeNodeStatus.NotStarted),
			];

			const tree = new LibraryTree(leaves, fakeRootFolder);
			const doneChild = tree.getNode(["parent", "doneChild"]) as SectionNode;
			const notStartedChild = tree.getNode(["parent", "notStartedChild"]) as SectionNode;
			const parent = tree.getNode(["parent"]) as SectionNode;

			expect(doneChild.status).toBe(TreeNodeStatus.Done);
			expect(notStartedChild.status).toBe(TreeNodeStatus.NotStarted);
			expect(parent.status).toBe(TreeNodeStatus.NotStarted);
		});

		it("FileNodes (Unknown status) are ignored in calculation", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("Note1", ["folder"], TreeNodeStatus.Done),
				{
					coreName: "doc",
					coreNameChainToParent: ["folder"],
					extension: "pdf",
					status: TreeNodeStatus.Unknown,
					type: TreeNodeType.File,
				},
			];

			const tree = new LibraryTree(leaves, fakeRootFolder);
			const folder = tree.getNode(["folder"]) as SectionNode;

			expect(folder.status).toBe(TreeNodeStatus.Done);
		});

		it("empty section is Done", () => {
			// Create a section by having a leaf in a nested path, then check sibling empty section
			// Actually, empty sections aren't created by leaves. Let's test root with no children.
			const leaves: TreeLeaf[] = [];

			const tree = new LibraryTree(leaves, fakeRootFolder);
			const root = tree.getNode([]) as SectionNode;

			expect(root.status).toBe(TreeNodeStatus.Done);
		});

		it("root status reflects all descendants", () => {
			const leaves: TreeLeaf[] = [
				createScrollLeaf("A", ["x", "y"], TreeNodeStatus.Done),
				createScrollLeaf("B", ["x", "z"], TreeNodeStatus.Done),
				createScrollLeaf("C", ["w"], TreeNodeStatus.NotStarted),
			];

			const tree = new LibraryTree(leaves, fakeRootFolder);
			const root = tree.getNode([]) as SectionNode;

			expect(root.status).toBe(TreeNodeStatus.NotStarted);
		});
	});
});
