import { describe, expect, it } from "bun:test";
import type { NoteDiff } from "../../../../src/commanders/librarian/diffing/note-differ";
import { mapDiffToActions } from "../../../../src/commanders/librarian/diffing/tree-diff-applier";
import {
	treePathToCodexBasename,
	treePathToPageBasename,
	treePathToScrollBasename,
} from "../../../../src/commanders/librarian/indexing/codecs";
import type { TreePath } from "../../../../src/commanders/librarian/types";
import {
	type LegacyVaultAction,
	LegacyVaultActionType,
} from "../../../../src/services/obsidian-services/file-services/background/background-vault-actions";
import type { PrettyPath } from "../../../../src/types/common-interface/dtos";
import { TextStatus } from "../../../../src/types/common-interface/enums";

type ActionWithPrettyPath = LegacyVaultAction & {
	payload: { prettyPath: PrettyPath };
};
const hasPrettyPath = (a: LegacyVaultAction): a is ActionWithPrettyPath =>
	"prettyPath" in a.payload;

const ROOT_NAME = "Library";

const emptyDiff: NoteDiff = {
	addedNotes: [],
	addedSections: [],
	removedNotes: [],
	removedSections: [],
	statusChanges: [],
};

describe("mapDiffToActions", () => {
	describe("added notes", () => {
		it("should create scroll file for non-book note", () => {
			const diff: NoteDiff = {
				...emptyDiff,
				addedNotes: [
					{ path: ["Section", "Scroll"] as TreePath, status: TextStatus.NotStarted },
				],
			};

			const actions = mapDiffToActions(diff, ROOT_NAME);

			const fileAction = actions
				.filter(hasPrettyPath)
				.find(
					(a) =>
						a.type === LegacyVaultActionType.UpdateOrCreateFile &&
						a.payload.prettyPath.basename ===
							treePathToScrollBasename.encode(["Section", "Scroll"]),
				);

			expect(fileAction).toBeDefined();
			expect(fileAction?.payload.prettyPath.pathParts).toEqual(["Library", "Section"]);
		});

		it("should create page file for book note (numeric suffix)", () => {
			const diff: NoteDiff = {
				...emptyDiff,
				addedNotes: [
					{ path: ["Section", "Book", "000"] as TreePath, status: TextStatus.Done },
				],
			};

			const actions = mapDiffToActions(diff, ROOT_NAME);

			const fileAction = actions
				.filter(hasPrettyPath)
				.find(
					(a) =>
						a.type === LegacyVaultActionType.UpdateOrCreateFile &&
						a.payload.prettyPath.basename ===
							treePathToPageBasename.encode(["Section", "Book", "000"]),
				);

			expect(fileAction).toBeDefined();
			expect(fileAction?.payload.prettyPath.pathParts).toEqual([
				"Library",
				"Section",
				"Book",
			]);
		});

		it("should include meta info in scroll content", () => {
			const diff: NoteDiff = {
				...emptyDiff,
				addedNotes: [
					{ path: ["Scroll"] as TreePath, status: TextStatus.Done },
				],
			};

			const actions = mapDiffToActions(diff, ROOT_NAME);
			const fileAction = actions.find(
				(a) => a.type === LegacyVaultActionType.UpdateOrCreateFile,
			);

			expect(fileAction?.payload.content).toContain("Scroll");
			expect(fileAction?.payload.content).toContain("Done");
		});

		it("should include page index in page meta info", () => {
			const diff: NoteDiff = {
				...emptyDiff,
				addedNotes: [
					{ path: ["Book", "042"] as TreePath, status: TextStatus.NotStarted },
				],
			};

			const actions = mapDiffToActions(diff, ROOT_NAME);
			const fileAction = actions.find(
				(a) => a.type === LegacyVaultActionType.UpdateOrCreateFile,
			);

			expect(fileAction?.payload.content).toContain("Page");
			expect(fileAction?.payload.content).toContain("42");
		});
	});

	describe("removed notes", () => {
		it("should trash scroll file", () => {
			const diff: NoteDiff = {
				...emptyDiff,
				removedNotes: [
					{ path: ["Section", "Scroll"] as TreePath, status: TextStatus.Done },
				],
			};

			const actions = mapDiffToActions(diff, ROOT_NAME);

			const trashAction = actions
				.filter(hasPrettyPath)
				.find(
					(a) =>
						a.type === LegacyVaultActionType.TrashFile &&
						a.payload.prettyPath.basename ===
							treePathToScrollBasename.encode(["Section", "Scroll"]),
				);

			expect(trashAction).toBeDefined();
		});

		it("should trash page file", () => {
			const diff: NoteDiff = {
				...emptyDiff,
				removedNotes: [
					{ path: ["Book", "001"] as TreePath, status: TextStatus.Done },
				],
			};

			const actions = mapDiffToActions(diff, ROOT_NAME);

			const trashAction = actions
				.filter(hasPrettyPath)
				.find(
					(a) =>
						a.type === LegacyVaultActionType.TrashFile &&
						a.payload.prettyPath.basename ===
							treePathToPageBasename.encode(["Book", "001"]),
				);

			expect(trashAction).toBeDefined();
		});
	});

	describe("status changes", () => {
		it("should create ProcessFile action for scroll status change", () => {
			const diff: NoteDiff = {
				...emptyDiff,
				statusChanges: [
					{
						newStatus: TextStatus.Done,
						oldStatus: TextStatus.NotStarted,
						path: ["Section", "Scroll"] as TreePath,
					},
				],
			};

			const actions = mapDiffToActions(diff, ROOT_NAME);

			const processAction = actions
				.filter(hasPrettyPath)
				.find(
					(a) =>
						a.type === LegacyVaultActionType.ProcessFile &&
						a.payload.prettyPath.basename ===
							treePathToScrollBasename.encode(["Section", "Scroll"]),
				);

			expect(processAction).toBeDefined();
			expect("transform" in (processAction?.payload ?? {})).toBe(true);
		});

		it("should create ProcessFile action for page status change", () => {
			const diff: NoteDiff = {
				...emptyDiff,
				statusChanges: [
					{
						newStatus: TextStatus.Done,
						oldStatus: TextStatus.NotStarted,
						path: ["Book", "000"] as TreePath,
					},
				],
			};

			const actions = mapDiffToActions(diff, ROOT_NAME);

			const processAction = actions
				.filter(hasPrettyPath)
				.find((a) => a.type === LegacyVaultActionType.ProcessFile);

			expect(processAction).toBeDefined();
			expect(processAction?.payload.prettyPath.basename).toBe(
				treePathToPageBasename.encode(["Book", "000"]),
			);
		});
	});

	describe("sections", () => {
		it("should create folder for added section", () => {
			const diff: NoteDiff = {
				...emptyDiff,
				addedSections: [["NewSection"] as TreePath],
			};

			const actions = mapDiffToActions(diff, ROOT_NAME);

			const folderAction = actions
				.filter(hasPrettyPath)
				.find(
					(a) =>
						a.type === LegacyVaultActionType.UpdateOrCreateFolder &&
						a.payload.prettyPath.basename === "NewSection",
				);

			expect(folderAction).toBeDefined();
			expect(folderAction?.payload.prettyPath.pathParts).toEqual(["Library"]);
		});

		it("should create codex for added section", () => {
			const diff: NoteDiff = {
				...emptyDiff,
				addedSections: [["NewSection"] as TreePath],
			};

			const actions = mapDiffToActions(diff, ROOT_NAME);

			const codexAction = actions
				.filter(hasPrettyPath)
				.find(
					(a) =>
						a.type === LegacyVaultActionType.UpdateOrCreateFile &&
						a.payload.prettyPath.basename ===
							treePathToCodexBasename.encode(["NewSection"]),
				);

			expect(codexAction).toBeDefined();
			expect(codexAction?.payload.prettyPath.pathParts).toEqual([
				"Library",
				"NewSection",
			]);
		});

		it("should trash codex then folder for removed section", () => {
			const diff: NoteDiff = {
				...emptyDiff,
				removedSections: [["OldSection"] as TreePath],
			};

			const actions = mapDiffToActions(diff, ROOT_NAME);

			const actionsWithPath = actions.filter(hasPrettyPath);
			const codexTrash = actionsWithPath.findIndex(
				(a) =>
					a.type === LegacyVaultActionType.TrashFile &&
					a.payload.prettyPath.basename ===
						treePathToCodexBasename.encode(["OldSection"]),
			);
			const folderTrash = actionsWithPath.findIndex(
				(a) =>
					a.type === LegacyVaultActionType.TrashFolder &&
					a.payload.prettyPath.basename === "OldSection",
			);

			expect(codexTrash).toBeGreaterThanOrEqual(0);
			expect(folderTrash).toBeGreaterThan(codexTrash);
		});

		it("should remove deepest sections first", () => {
			const diff: NoteDiff = {
				...emptyDiff,
				removedSections: [
					["A"] as TreePath,
					["A", "B"] as TreePath,
					["A", "B", "C"] as TreePath,
				],
			};

			const actions = mapDiffToActions(diff, ROOT_NAME);

			const folderActions = actions
				.filter(hasPrettyPath)
				.filter((a) => a.type === LegacyVaultActionType.TrashFolder);

			const cIdx = folderActions.findIndex(
				(a) => a.payload.prettyPath.basename === "C",
			);
			const bIdx = folderActions.findIndex(
				(a) => a.payload.prettyPath.basename === "B",
			);
			const aIdx = folderActions.findIndex(
				(a) => a.payload.prettyPath.basename === "A",
			);

			expect(cIdx).toBeLessThan(bIdx);
			expect(bIdx).toBeLessThan(aIdx);
		});
	});

	describe("codex updates", () => {
		it("should update root codex when note added", () => {
			const diff: NoteDiff = {
				...emptyDiff,
				addedNotes: [
					{ path: ["Section", "Note"] as TreePath, status: TextStatus.Done },
				],
			};

			const actions = mapDiffToActions(diff, ROOT_NAME);

			const rootCodex = actions
				.filter(hasPrettyPath)
				.find(
					(a) =>
						a.type === LegacyVaultActionType.UpdateOrCreateFile &&
						a.payload.prettyPath.basename ===
							treePathToCodexBasename.encode(["Library"]),
				);

			expect(rootCodex).toBeDefined();
		});

		it("should update ancestor codexes on status change", () => {
			const diff: NoteDiff = {
				...emptyDiff,
				statusChanges: [
					{
						newStatus: TextStatus.Done,
						oldStatus: TextStatus.NotStarted,
						path: ["A", "B", "Note"] as TreePath,
					},
				],
			};

			const actions = mapDiffToActions(diff, ROOT_NAME);

			const codexUpdates = actions
				.filter(hasPrettyPath)
				.filter(
					(a) =>
						a.type === LegacyVaultActionType.UpdateOrCreateFile &&
						a.payload.prettyPath.basename.startsWith("__"),
				);

			const basenames = codexUpdates.map((a) => a.payload.prettyPath.basename);
			expect(basenames).toContain(treePathToCodexBasename.encode(["Library"]));
			expect(basenames).toContain(treePathToCodexBasename.encode(["A"]));
			expect(basenames).toContain(treePathToCodexBasename.encode(["A", "B"]));
		});

		it("should update book codex when page status changes", () => {
			const diff: NoteDiff = {
				...emptyDiff,
				statusChanges: [
					{
						newStatus: TextStatus.Done,
						oldStatus: TextStatus.NotStarted,
						path: ["Section", "Book", "000"] as TreePath,
					},
				],
			};

			const actions = mapDiffToActions(diff, ROOT_NAME);

			const bookCodex = actions
				.filter(hasPrettyPath)
				.find(
					(a) =>
						a.type === LegacyVaultActionType.UpdateOrCreateFile &&
						a.payload.prettyPath.basename ===
							treePathToCodexBasename.encode(["Section", "Book"]),
				);

			expect(bookCodex).toBeDefined();
		});
	});

	describe("empty diff", () => {
		it("should return empty actions for empty diff", () => {
			const actions = mapDiffToActions(emptyDiff, ROOT_NAME);
			expect(actions.length).toBe(0);
		});
	});
});
