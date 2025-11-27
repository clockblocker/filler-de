import { describe, expect, it } from "bun:test";
import { DiffToActionsMapper } from "../../../src/commanders/librarian/diffing/diff-to-actions";
import type { TreeDiff } from "../../../src/commanders/librarian/diffing/types";
import type { TreePath } from "../../../src/commanders/librarian/types";
import { VaultActionType } from "../../../src/services/obsidian-services/file-services/background/background-vault-actions";
import { TextStatus } from "../../../src/types/common-interface/enums";

const mapper = new DiffToActionsMapper("Library");

describe("DiffToActionsMapper", () => {
	describe("mapDiffToActions - sections", () => {
		it("should create folder action for added section", () => {
			const diff: TreeDiff = {
				addedSections: [["NewSection"] as TreePath],
				addedTexts: [],
				removedSections: [],
				removedTexts: [],
				statusChanges: [],
			};

			const actions = mapper.mapDiffToActions(diff);

			const createFolderActions = actions.filter(
				(a) => a.type === VaultActionType.UpdateOrCreateFolder,
			);
			expect(createFolderActions.length).toBe(1);
			expect(createFolderActions?.[0]?.payload.prettyPath.basename).toBe("NewSection");
		});

		it("should create trash folder action for removed section", () => {
			const diff: TreeDiff = {
				addedSections: [],
				addedTexts: [],
				removedSections: [["OldSection"] as TreePath],
				removedTexts: [],
				statusChanges: [],
			};

			const actions = mapper.mapDiffToActions(diff);

			const trashFolderActions = actions.filter(
				(a) => a.type === VaultActionType.TrashFolder,
			);
			expect(trashFolderActions.length).toBe(1);
		});

		it("should sort removed sections deepest first", () => {
			const diff: TreeDiff = {
				addedSections: [],
				addedTexts: [],
				removedSections: [
					["A"] as TreePath,
					["A", "B"] as TreePath,
					["A", "B", "C"] as TreePath,
				],
				removedTexts: [],
				statusChanges: [],
			};

			const actions = mapper.mapDiffToActions(diff);

			const trashFolderActions = actions.filter(
				(a) => a.type === VaultActionType.TrashFolder,
			);

			// Deepest first
			expect(trashFolderActions?.[0]?.payload.prettyPath.basename).toBe("C");
			expect(trashFolderActions?.[1]?.payload.prettyPath.basename).toBe("B");
			expect(trashFolderActions?.[2]?.payload.prettyPath.basename).toBe("A");
		});
	});

	describe("mapDiffToActions - texts", () => {
		it("should create single file for scroll (single page)", () => {
			const diff: TreeDiff = {
				addedSections: [],
				addedTexts: [
					{
						pageStatuses: { "000": TextStatus.NotStarted },
						path: ["Section", "Scroll"] as TreePath,
					},
				],
				removedSections: [],
				removedTexts: [],
				statusChanges: [],
			};

			const actions = mapper.mapDiffToActions(diff);

			const createFileActions = actions.filter(
				(a) => a.type === VaultActionType.UpdateOrCreateFile,
			);
			// 1 scroll + 1 parent section codex + 1 root codex
			expect(createFileActions.length).toBe(3);
			// Scroll filename is reversed path
			const scrollAction = createFileActions.find(
				(a) => a.payload.prettyPath.basename === "Scroll-Section",
			);
			expect(scrollAction).toBeDefined();
		});

		it("should create folder + pages + codex for book (multiple pages)", () => {
			const diff: TreeDiff = {
				addedSections: [],
				addedTexts: [
					{
						pageStatuses: {
							"000": TextStatus.NotStarted,
							"001": TextStatus.NotStarted,
						},
						path: ["Section", "Book"] as TreePath,
					},
				],
				removedSections: [],
				removedTexts: [],
				statusChanges: [],
			};

			const actions = mapper.mapDiffToActions(diff);

			const createFolderActions = actions.filter(
				(a) => a.type === VaultActionType.UpdateOrCreateFolder,
			);
			const createFileActions = actions.filter(
				(a) => a.type === VaultActionType.UpdateOrCreateFile,
			);

			// 1 folder for book + 1 Page subfolder
			expect(createFolderActions.length).toBe(2);
			expect(createFolderActions?.[0]?.payload?.prettyPath.basename).toBe("Book");
			expect(createFolderActions?.[1]?.payload?.prettyPath.basename).toBe("Page");

			// 2 pages + 1 book codex + 1 parent section codex + 1 root codex
			expect(createFileActions.length).toBe(5);

			// Check page files have correct path
			const pageFiles = createFileActions.filter((a) =>
				a.payload.prettyPath.pathParts.includes("Page"),
			);
			expect(pageFiles.length).toBe(2);
		});

		it("should trash scroll file", () => {
			const diff: TreeDiff = {
				addedSections: [],
				addedTexts: [],
				removedSections: [],
				removedTexts: [
					{
						pageStatuses: { "000": TextStatus.Done },
						path: ["Section", "Scroll"] as TreePath,
					},
				],
				statusChanges: [],
			};

			const actions = mapper.mapDiffToActions(diff);

			const trashFileActions = actions.filter(
				(a) => a.type === VaultActionType.TrashFile,
			);
			expect(trashFileActions.length).toBe(1);
		});

		it("should trash book pages, codex, and folder", () => {
			const diff: TreeDiff = {
				addedSections: [],
				addedTexts: [],
				removedSections: [],
				removedTexts: [
					{
						pageStatuses: {
							"000": TextStatus.Done,
							"001": TextStatus.Done,
						},
						path: ["Section", "Book"] as TreePath,
					},
				],
				statusChanges: [],
			};

			const actions = mapper.mapDiffToActions(diff);

			const trashFileActions = actions.filter(
				(a) => a.type === VaultActionType.TrashFile,
			);
			const trashFolderActions = actions.filter(
				(a) => a.type === VaultActionType.TrashFolder,
			);

			// 2 pages + 1 codex
			expect(trashFileActions.length).toBe(3);
			// 1 Page folder + 1 book folder
			expect(trashFolderActions.length).toBe(2);
		});
	});

	describe("mapDiffToActions - status changes", () => {
		it("should create process action for affected codex", () => {
			const diff: TreeDiff = {
				addedSections: [],
				addedTexts: [],
				removedSections: [],
				removedTexts: [],
				statusChanges: [
					{
						newStatus: TextStatus.Done,
						oldStatus: TextStatus.NotStarted,
						path: ["Section", "Book", "000"] as TreePath,
					},
				],
			};

			const actions = mapper.mapDiffToActions(diff);

			const createActions = actions.filter(
				(a) => a.type === VaultActionType.UpdateOrCreateFile,
			);

			// Should affect: Section/Book codex, Section codex, and root codex
			expect(createActions.length).toBe(3);
		});
	});

	describe("getAffectedCodexPaths", () => {
		it("should return all ancestor paths", () => {
			const statusChanges = [
				{
					newStatus: TextStatus.Done,
					oldStatus: TextStatus.NotStarted,
					path: ["A", "B", "C", "000"] as TreePath,
				},
			];

			const paths = mapper.getAffectedCodexPaths(statusChanges);

			expect(paths.has("A/B/C")).toBe(true);
			expect(paths.has("A/B")).toBe(true);
			expect(paths.has("A")).toBe(true);
			expect(paths.has("")).toBe(true); // root
			expect(paths.size).toBe(4);
		});

		it("should dedupe paths from multiple changes", () => {
			const statusChanges = [
				{
					newStatus: TextStatus.Done,
					oldStatus: TextStatus.NotStarted,
					path: ["A", "B", "000"] as TreePath,
				},
				{
					newStatus: TextStatus.Done,
					oldStatus: TextStatus.NotStarted,
					path: ["A", "B", "001"] as TreePath,
				},
			];

			const paths = mapper.getAffectedCodexPaths(statusChanges);

			// A/B, A, and root ("") - each counted once
			expect(paths.size).toBe(3);
		});
	});
});

