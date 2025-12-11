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
	type VaultAction,
	VaultActionType,
} from "../../../../src/obsidian-vault-action-manager/types/vault-action";
import { TextStatus } from "../../../../src/types/common-interface/enums";

type ActionWithCorePath = VaultAction & {
	payload: { coreSplitPath: { basename: string; pathParts: string[] } };
};
const hasCorePath = (a: VaultAction): a is ActionWithCorePath =>
	"coreSplitPath" in a.payload;
const basenameWithoutMd = (a: ActionWithCorePath): string =>
	a.payload.coreSplitPath.basename.replace(/\.md$/, "");

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
				.filter(hasCorePath)
				.find(
					(a) =>
						a.type === VaultActionType.CreateMdFile &&
						basenameWithoutMd(a) ===
							`${treePathToScrollBasename.encode(["Section", "Scroll"])}.md`,
				);

			expect(fileAction).toBeDefined();
			expect(fileAction?.payload.coreSplitPath.pathParts).toEqual([
				"Library",
				"Section",
			]);
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
				.filter(hasCorePath)
				.find(
					(a) =>
						a.type === VaultActionType.CreateMdFile &&
						basenameWithoutMd(a) ===
							`${treePathToPageBasename.encode(["Section", "Book", "000"])}.md`,
				);

			expect(fileAction).toBeDefined();
			expect(fileAction?.payload.coreSplitPath.pathParts).toEqual([
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
				(a) => a.type === VaultActionType.CreateMdFile,
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
				(a) => a.type === VaultActionType.CreateMdFile,
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
				.filter(hasCorePath)
				.find(
					(a) =>
						a.type === VaultActionType.TrashMdFile &&
						basenameWithoutMd(a) ===
							`${treePathToScrollBasename.encode(["Section", "Scroll"])}.md`,
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
				.filter(hasCorePath)
				.find(
					(a) =>
						a.type === VaultActionType.TrashMdFile &&
						basenameWithoutMd(a) ===
							`${treePathToPageBasename.encode(["Book", "001"])}.md`,
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
				.filter(hasCorePath)
				.find(
					(a) =>
						a.type === VaultActionType.ProcessMdFile &&
						basenameWithoutMd(a) ===
							`${treePathToScrollBasename.encode(["Section", "Scroll"])}.md`,
				);

			expect(processAction).toBeDefined();
			expect("transform" in (processAction?.payload ?? {})).toBe(true);
		});

		it("should create ProcessMdFile action for page status change", () => {
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
				.filter(hasCorePath)
				.find((a) => a.type === VaultActionType.ProcessMdFile);

			expect(processAction).toBeDefined();
			expect(processAction?.payload.coreSplitPath.basename).toBe(
				`${treePathToPageBasename.encode(["Book", "000"])}.md`,
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
			.filter(hasCorePath)
			.find(
				(a) =>
					a.type === VaultActionType.CreateFolder &&
					a.payload.coreSplitPath.basename === "NewSection",
			);

			expect(folderAction).toBeDefined();
		expect(folderAction?.payload.coreSplitPath.pathParts).toEqual(["Library"]);
		});

		it("should create codex for added section", () => {
			const diff: NoteDiff = {
				...emptyDiff,
				addedSections: [["NewSection"] as TreePath],
			};

			const actions = mapDiffToActions(diff, ROOT_NAME);

		const codexAction = actions
			.filter(hasCorePath)
			.find(
				(a) =>
					a.type === VaultActionType.CreateMdFile &&
					basenameWithoutMd(a) ===
						`${treePathToCodexBasename.encode(["NewSection"])}.md`,
			);

			expect(codexAction).toBeDefined();
		expect(codexAction?.payload.coreSplitPath.pathParts).toEqual([
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

			const actionsWithPath = actions.filter(hasCorePath);
			const codexTrash = actionsWithPath.findIndex(
				(a) =>
					a.type === VaultActionType.TrashMdFile &&
					basenameWithoutMd(a) ===
						`${treePathToCodexBasename.encode(["OldSection"])}.md`,
			);
			const folderTrash = actionsWithPath.findIndex(
				(a) =>
					a.type === VaultActionType.TrashFolder &&
					a.payload.coreSplitPath.basename === "OldSection",
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
				.filter(hasCorePath)
				.filter((a) => a.type === VaultActionType.TrashFolder);

			const cIdx = folderActions.findIndex(
				(a) => a.payload.coreSplitPath.basename === "C",
			);
			const bIdx = folderActions.findIndex(
				(a) => a.payload.coreSplitPath.basename === "B",
			);
			const aIdx = folderActions.findIndex(
				(a) => a.payload.coreSplitPath.basename === "A",
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
			.filter(hasCorePath)
			.find(
				(a) =>
					a.type === VaultActionType.CreateMdFile &&
					basenameWithoutMd(a) ===
						`${treePathToCodexBasename.encode(["Library"])}.md`,
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
				.filter(hasCorePath)
				.filter(
					(a) =>
						a.type === VaultActionType.CreateMdFile &&
						a.payload.coreSplitPath.basename.startsWith("__"),
				);

			const basenames = codexUpdates.map(
				(a) => a.payload.coreSplitPath.basename,
			);
			expect(basenames).toContain(
				`${treePathToCodexBasename.encode(["Library"])}.md`,
			);
			expect(basenames).toContain(
				`${treePathToCodexBasename.encode(["A"])}.md`,
			);
			expect(basenames).toContain(
				`${treePathToCodexBasename.encode(["A", "B"])}.md`,
			);
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
				.filter(hasCorePath)
				.find(
					(a) =>
						a.type === VaultActionType.CreateMdFile &&
						basenameWithoutMd(a) ===
							`${treePathToCodexBasename.encode(["Section", "Book"])}.md`,
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
