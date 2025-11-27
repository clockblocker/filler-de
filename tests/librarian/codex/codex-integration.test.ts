import { beforeEach, describe, expect, it } from "bun:test";
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
import { VaultActionType } from "../../../src/services/obsidian-services/file-services/background/background-vault-actions";
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

			// Find the UpdateOrCreateFile action for the section Codex
			const codexAction = actions.find(
				(a) =>
					a.type === VaultActionType.UpdateOrCreateFile &&
					a.payload.prettyPath.basename.startsWith("__"),
			);

			expect(codexAction).toBeDefined();
			expect(codexAction?.type).toBe(VaultActionType.UpdateOrCreateFile);

			const content =
				codexAction?.type === VaultActionType.UpdateOrCreateFile
					? codexAction.payload.content
					: "";

			// Should have back link to Library codex (parent)
			expect(content).toContain("[[__Library|← Library]]");
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
					a.type === VaultActionType.UpdateOrCreateFile &&
					a.payload.prettyPath.basename === "__Avatar",
			);

			const content =
				codexAction?.type === VaultActionType.UpdateOrCreateFile
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
					a.type === VaultActionType.UpdateOrCreateFile &&
					a.payload.prettyPath.basename.includes("Episode_1") &&
					a.payload.prettyPath.basename.startsWith("__"),
			);

			expect(bookCodexAction).toBeDefined();

			const content =
				bookCodexAction?.type === VaultActionType.UpdateOrCreateFile
					? bookCodexAction.payload.content
					: "";

			// Should have pages (displayed as raw names)
			expect(content).toContain("|000]]");
			expect(content).toContain("|001]]");
			// First page is done
			expect(content).toContain("[x]");
			// Second page is not started
			expect(content).toContain("[ ]");
		});
	});

	describe("Status change → Codex update", () => {
		it("should generate UpdateOrCreateFile action with updated content", () => {
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

			// Should have UpdateOrCreateFile actions for affected Codexes
			const createActions = actions.filter(
				(a) => a.type === VaultActionType.UpdateOrCreateFile,
			);

			// Episode_1 (book), Avatar (parent section), and root codex
			expect(createActions.length).toBe(3);

			// Find the book codex update
			const bookUpdate = createActions.find((a) =>
				a.payload.prettyPath.basename.includes("Episode_1"),
			);

			expect(bookUpdate).toBeDefined();

			const content =
				bookUpdate?.type === VaultActionType.UpdateOrCreateFile
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

			const createActions = actions.filter(
				(a) => a.type === VaultActionType.UpdateOrCreateFile,
			);

			// Should update: A/B/C/Text, A/B/C, A/B, A, root = 5 codexes
			// But Text is a scroll (single page), so only sections: A/B/C, A/B, A, root = 4
			expect(createActions.length).toBe(4);
		});
	});

	describe("Scroll (no Codex)", () => {
		it("should not create Codex for single-page text itself", () => {
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

			// Should create: 1 scroll file + 1 parent section codex + 1 root codex
			const createActions = actions.filter(
				(a) => a.type === VaultActionType.UpdateOrCreateFile,
			);

			expect(createActions.length).toBe(3);

			// The scroll file itself shouldn't have __ prefix (not a codex)
			const scrollAction = createActions.find(
				(a) => a.payload.prettyPath.basename === "MySong-Songs",
			);
			expect(scrollAction).toBeDefined();
			expect(scrollAction?.payload.prettyPath.basename).not.toContain("__");

			// The parent section should get a codex update
			const sectionCodexAction = createActions.find(
				(a) => a.payload.prettyPath.basename.startsWith("__"),
			);
			expect(sectionCodexAction).toBeDefined();
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
