import { describe, expect, it, beforeEach } from "bun:test";
import { DiffToActionsMapper } from "../../../src/commanders/librarian/diffing/diff-to-actions";
import type { TreeDiff } from "../../../src/commanders/librarian/diffing/types";
import { LibraryTree } from "../../../src/commanders/librarian/library-tree/library-tree";
import type {
	SectionNode,
	TextDto,
	TextNode,
	TreePath,
} from "../../../src/commanders/librarian/types";
import { NodeType } from "../../../src/commanders/librarian/types";
import { BackgroundVaultActionType } from "../../../src/services/obsidian-services/file-services/background/background-vault-actions";
import { TextStatus } from "../../../src/types/common-interface/enums";

describe("Codex Integration", () => {
	let mapper: DiffToActionsMapper;
	let tree: LibraryTree;

	beforeEach(() => {
		mapper = new DiffToActionsMapper("Library");
		tree = new LibraryTree([], "Library");
	});

	const getNode = (path: TreePath) => {
		const mbNode = tree.getMaybeNode({ path });
		if (mbNode.error) return undefined;
		const node = mbNode.data;
		if (node.type === "Section" || node.type === "Text") {
			return node as SectionNode | TextNode;
		}
		return undefined;
	};

	describe("Section → Codex content", () => {
		it("should generate Codex with back link for new section", () => {
			// Add section to tree first
			const textDto: TextDto = {
				pageStatuses: { "000": TextStatus.NotStarted },
				path: ["Avatar", "Episode_1"] as TreePath,
			};
			tree.addTexts([textDto]);

			const diff: TreeDiff = {
				addedSections: [["Avatar"] as TreePath],
				addedTexts: [],
				removedSections: [],
				removedTexts: [],
				statusChanges: [],
			};

			const actions = mapper.mapDiffToActions(diff, getNode);

			// Find the CreateFile action for the section Codex
			const codexAction = actions.find(
				(a) =>
					a.type === BackgroundVaultActionType.CreateFile &&
					a.payload.prettyPath.basename.startsWith("__"),
			);

			expect(codexAction).toBeDefined();
			expect(codexAction?.type).toBe(BackgroundVaultActionType.CreateFile);

			const content =
				codexAction?.type === BackgroundVaultActionType.CreateFile
					? codexAction.payload.content
					: "";

			// Should have back link to Library (parent)
			expect(content).toContain("[[Library|← Library]]");
			// Should have checkbox for Episode_1
			expect(content).toContain("[ ]");
			expect(content).toContain("Episode 1");
		});

		it("should generate Codex with nested children", () => {
			// Add nested structure
			tree.addTexts([
				{
					pageStatuses: { "000": TextStatus.Done },
					path: ["Avatar", "Season_1", "Episode_1"] as TreePath,
				},
				{
					pageStatuses: { "000": TextStatus.NotStarted },
					path: ["Avatar", "Season_1", "Episode_2"] as TreePath,
				},
			]);

			const diff: TreeDiff = {
				addedSections: [["Avatar"] as TreePath],
				addedTexts: [],
				removedSections: [],
				removedTexts: [],
				statusChanges: [],
			};

			const actions = mapper.mapDiffToActions(diff, getNode);

			const codexAction = actions.find(
				(a) =>
					a.type === BackgroundVaultActionType.CreateFile &&
					a.payload.prettyPath.basename === "__Avatar",
			);

			const content =
				codexAction?.type === BackgroundVaultActionType.CreateFile
					? codexAction.payload.content
					: "";

			// Should have Season_1 as child
			expect(content).toContain("Season 1");
			// Nested items should have tabs
			expect(content).toContain("\t");
		});
	});

	describe("Book → Codex content", () => {
		it("should generate Book Codex with flat page list", () => {
			const diff: TreeDiff = {
				addedSections: [],
				addedTexts: [
					{
						pageStatuses: {
							"000": TextStatus.Done,
							"001": TextStatus.NotStarted,
						},
						path: ["Avatar", "Episode_1"] as TreePath,
					},
				],
				removedSections: [],
				removedTexts: [],
				statusChanges: [],
			};

			// Add to tree for getNode to work
			tree.addTexts([
				{
					pageStatuses: {
						"000": TextStatus.Done,
						"001": TextStatus.NotStarted,
					},
					path: ["Avatar", "Episode_1"] as TreePath,
				},
			]);

			const actions = mapper.mapDiffToActions(diff, getNode);

			// Find book codex action
			const bookCodexAction = actions.find(
				(a) =>
					a.type === BackgroundVaultActionType.CreateFile &&
					a.payload.prettyPath.basename.includes("Episode_1") &&
					a.payload.prettyPath.basename.startsWith("__"),
			);

			expect(bookCodexAction).toBeDefined();

			const content =
				bookCodexAction?.type === BackgroundVaultActionType.CreateFile
					? bookCodexAction.payload.content
					: "";

			// Should have pages
			expect(content).toContain("Page 1");
			expect(content).toContain("Page 2");
			// First page is done
			expect(content).toContain("[x]");
			// Second page is not started
			expect(content).toContain("[ ]");
		});
	});

	describe("Status change → Codex update", () => {
		it("should generate WriteFile action with updated content", () => {
			// Set up tree with a book
			tree.addTexts([
				{
					pageStatuses: {
						"000": TextStatus.NotStarted,
						"001": TextStatus.NotStarted,
					},
					path: ["Avatar", "Episode_1"] as TreePath,
				},
			]);

			// Simulate status change
			tree.setStatus({
				path: ["Avatar", "Episode_1", "000"],
				status: "Done",
			});

			const diff: TreeDiff = {
				addedSections: [],
				addedTexts: [],
				removedSections: [],
				removedTexts: [],
				statusChanges: [
					{
						newStatus: TextStatus.Done,
						oldStatus: TextStatus.NotStarted,
						path: ["Avatar", "Episode_1", "000"] as TreePath,
					},
				],
			};

			const actions = mapper.mapDiffToActions(diff, getNode);

			// Should have WriteFile actions for affected Codexes
			const writeActions = actions.filter(
				(a) => a.type === BackgroundVaultActionType.WriteFile,
			);

			// Episode_1 (book) and Avatar (parent section)
			expect(writeActions.length).toBe(2);

			// Find the book codex update
			const bookUpdate = writeActions.find((a) =>
				a.payload.prettyPath.basename.includes("Episode_1"),
			);

			expect(bookUpdate).toBeDefined();

			const content =
				bookUpdate?.type === BackgroundVaultActionType.WriteFile
					? bookUpdate.payload.content
					: "";

			// Page 1 should now be checked
			expect(content).toContain("[x]");
		});

		it("should update all ancestor Codexes on status change", () => {
			// Deep nesting
			tree.addTexts([
				{
					pageStatuses: { "000": TextStatus.NotStarted },
					path: ["A", "B", "C", "Text"] as TreePath,
				},
			]);

			tree.setStatus({
				path: ["A", "B", "C", "Text", "000"],
				status: "Done",
			});

			const diff: TreeDiff = {
				addedSections: [],
				addedTexts: [],
				removedSections: [],
				removedTexts: [],
				statusChanges: [
					{
						newStatus: TextStatus.Done,
						oldStatus: TextStatus.NotStarted,
						path: ["A", "B", "C", "Text", "000"] as TreePath,
					},
				],
			};

			const actions = mapper.mapDiffToActions(diff, getNode);

			const writeActions = actions.filter(
				(a) => a.type === BackgroundVaultActionType.WriteFile,
			);

			// Should update: A/B/C/Text, A/B/C, A/B, A = 4 codexes
			// But Text is a scroll (single page), so only sections: A/B/C, A/B, A = 3
			expect(writeActions.length).toBe(3);
		});
	});

	describe("Scroll (no Codex)", () => {
		it("should not create Codex for single-page text", () => {
			const diff: TreeDiff = {
				addedSections: [],
				addedTexts: [
					{
						pageStatuses: { "000": TextStatus.NotStarted },
						path: ["Songs", "MySong"] as TreePath,
					},
				],
				removedSections: [],
				removedTexts: [],
				statusChanges: [],
			};

			const actions = mapper.mapDiffToActions(diff, getNode);

			// Should only create the scroll file, no Codex
			const createActions = actions.filter(
				(a) => a.type === BackgroundVaultActionType.CreateFile,
			);

			expect(createActions.length).toBe(1);
			expect(createActions[0]?.payload.prettyPath.basename).not.toContain(
				"__",
			);
		});
	});

	describe("Root Library Codex", () => {
		it("should generate Codex with no back link for root", () => {
			// The root section is the Library itself
			// When we add a child to root, we might update root's codex
			tree.addTexts([
				{
					pageStatuses: { "000": TextStatus.NotStarted },
					path: ["Avatar"] as TreePath,
				},
			]);

			// The root node is the Library section
			const rootNode = tree.root;

			// Generate codex for root
			const { codexGenerator, codexFormatter } = require(
				"../../../src/commanders/librarian/codex",
			);

			const content = codexGenerator.forSection(rootNode);
			const markdown = codexFormatter.format(content, "section");

			// Root should have no back link
			expect(content.backLink).toBeNull();
			expect(markdown).not.toContain("←");
			// But should have children
			expect(markdown).toContain("Avatar");
		});
	});
});

