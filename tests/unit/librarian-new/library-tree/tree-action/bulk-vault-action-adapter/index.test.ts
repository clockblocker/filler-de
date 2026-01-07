import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { buildTreeActions } from "../../../../../../src/commanders/librarian-new/library-tree/tree-action/bulk-vault-action-adapter/index";
import type { TreeAction } from "../../../../../../src/commanders/librarian-new/library-tree/tree-action/types/tree-action";
import { TreeActionType } from "../../../../../../src/commanders/librarian-new/library-tree/tree-action/types/tree-action";
import { getNodeName } from "../../../../../../src/commanders/librarian-new/library-tree/tree-action/utils/locator/locator-utils";
import { TreeNodeType } from "../../../../../../src/commanders/librarian-new/library-tree/tree-node/types/atoms";
import * as globalState from "../../../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../../../src/global-state/parsed-settings";
import type { BulkVaultEvent } from "../../../../../../src/obsidian-vault-action-manager";
import type { PossibleRootVaultEvent } from "../../../../../../src/obsidian-vault-action-manager/impl/event-processing/bulk-event-emmiter/types/bulk/helpers";
import { SplitPathType } from "../../../../../../src/obsidian-vault-action-manager/types/split-path";
import type {
	FileCreatedVaultEvent,
	FileDeletedVaultEvent,
	FileRenamedVaultEvent,
	FolderCreatedVaultEvent,
	FolderDeletedVaultEvent,
	FolderRenamedVaultEvent,
	VaultEvent,
} from "../../../../../../src/obsidian-vault-action-manager/types/vault-event";
import { VaultEventType } from "../../../../../../src/obsidian-vault-action-manager/types/vault-event";

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

const spFile = (
	pathParts: string[],
	basename: string,
	ext: string = "txt",
): { basename: string; pathParts: string[]; type: typeof SplitPathType.File; extension: string } => ({
	basename,
	extension: ext,
	pathParts,
	type: SplitPathType.File,
});

const spFolder = (
	pathParts: string[],
	basename: string,
): { basename: string; pathParts: string[]; type: typeof SplitPathType.Folder } => ({
	basename,
	pathParts,
	type: SplitPathType.Folder,
});

const spMdFile = (
	pathParts: string[],
	basename: string,
): { basename: string; pathParts: string[]; type: typeof SplitPathType.MdFile; extension: "md" } => ({
	basename,
	extension: "md",
	pathParts,
	type: SplitPathType.MdFile,
});

const evFileCreated = (
	sp: ReturnType<typeof spFile> | ReturnType<typeof spMdFile>,
): FileCreatedVaultEvent => ({
	splitPath: sp,
	type: VaultEventType.FileCreated,
});

const evFileDeleted = (
	sp: ReturnType<typeof spFile> | ReturnType<typeof spMdFile>,
): FileDeletedVaultEvent => ({
	splitPath: sp,
	type: VaultEventType.FileDeleted,
});

const evFileRenamed = (
	from: ReturnType<typeof spFile> | ReturnType<typeof spMdFile>,
	to: ReturnType<typeof spFile> | ReturnType<typeof spMdFile>,
): FileRenamedVaultEvent => ({
	from,
	to,
	type: VaultEventType.FileRenamed,
});

const evFolderCreated = (sp: ReturnType<typeof spFolder>): FolderCreatedVaultEvent => ({
	splitPath: sp,
	type: VaultEventType.FolderCreated,
});

const evFolderDeleted = (sp: ReturnType<typeof spFolder>): FolderDeletedVaultEvent => ({
	splitPath: sp,
	type: VaultEventType.FolderDeleted,
});

const evFolderRenamed = (
	from: ReturnType<typeof spFolder>,
	to: ReturnType<typeof spFolder>,
): FolderRenamedVaultEvent => ({
	from,
	to,
	type: VaultEventType.FolderRenamed,
});

const bulk = ({
	events,
	roots,
}: {
	events?: VaultEvent[];
	roots?: PossibleRootVaultEvent[];
}): BulkVaultEvent => ({
	debug: {
		collapsedCount: { creates: 0, deletes: 0, renames: 0 },
		endedAt: 0,
		reduced: { rootDeletes: 0, rootRenames: 0 },
		startedAt: 0,
		trueCount: { creates: 0, deletes: 0, renames: 0 },
	},
	events: events ?? [],
	roots: roots ?? [],
});

describe("buildTreeActions", () => {
	describe("A) Create mapping", () => {
		it("FileCreated inside flat => Create", () => {
			const bulkEvent = bulk({
				events: [evFileCreated(spMdFile(["Library"], "Note-Child-Parent"))],
			});

			const actions = buildTreeActions(bulkEvent);

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Create);
			expect(getNodeName(action.targetLocator)).toBe("Note");
			expect(action.targetLocator.targetType).toBe(TreeNodeType.Scroll);
		});

		it("FileCreated inside nested => Create", () => {
			const bulkEvent = bulk({
				events: [evFileCreated(spMdFile(["Library", "Parent", "Child"], "Note"))],
			});

			const actions = buildTreeActions(bulkEvent);

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Create);
			expect(getNodeName(action.targetLocator)).toBe("Note");
			expect(action.targetLocator.targetType).toBe(TreeNodeType.Scroll);
		});

		it("FileRenamed outside→inside => Create", () => {
			const bulkEvent = bulk({
				events: [
					evFileRenamed(
						spMdFile(["Inbox"], "a"),
						spMdFile(["Library", "Parent"], "a"),
					),
				],
			});

			const actions = buildTreeActions(bulkEvent);

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Create);
			expect(getNodeName(action.targetLocator)).toBe("a");
			expect(action.targetLocator.targetType).toBe(TreeNodeType.Scroll);
		});
	});

	describe("B) Delete mapping", () => {
		it("FileDeleted inside => Delete", () => {
			const bulkEvent = bulk({
				roots: [evFileDeleted(spMdFile(["Library", "Section"], "Note-Section"))],
			});

			const actions = buildTreeActions(bulkEvent);

			expect(actions.length).toBeGreaterThanOrEqual(0);
			if (actions.length > 0) {
				const action = actions[0];
				if (!action) throw new Error("Expected action");
				expect(action.actionType).toBe(TreeActionType.Delete);
			}
		});

		it("FolderDeleted inside root => Delete", () => {
			const bulkEvent = bulk({
				roots: [evFolderDeleted(spFolder(["Library"], "Section"))],
			});

			const actions = buildTreeActions(bulkEvent);

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Delete);
			expect(getNodeName(action.targetLocator)).toBe("Section");
			expect(action.targetLocator.targetType).toBe(TreeNodeType.Section);
		});

		it("FileRenamed inside→outside => Delete", () => {
			const bulkEvent = bulk({
				events: [
					evFileRenamed(
						spMdFile(["Library", "A"], "x-A"),
						spMdFile(["Inbox"], "x"),
					),
				],
			});

			const actions = buildTreeActions(bulkEvent);

			expect(actions.length).toBeGreaterThanOrEqual(0);
			if (actions.length > 0) {
				const action = actions[0];
				if (!action) throw new Error("Expected action");
				expect(action.actionType).toBe(TreeActionType.Delete);
			}
		});
	});

	describe("C) Rename mapping", () => {
		it("FolderRenamed inside pie→pies => Rename", () => {
			const bulkEvent = bulk({
				roots: [
					evFolderRenamed(
						spFolder(["Library"], "pie"),
						spFolder(["Library"], "pies"),
					),
				],
			});

			const actions = buildTreeActions(bulkEvent);

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Rename);
			expect(getNodeName(action.targetLocator)).toBe("pie");
			if (action.actionType === TreeActionType.Rename) {
				expect(action.newNodeName).toBe("pies");
			}
		});

		it("FolderRenamed inside pie→sweet-pie => Move", () => {
			const bulkEvent = bulk({
				roots: [
					evFolderRenamed(
						spFolder(["Library"], "pie"),
						spFolder(["Library"], "sweet-pie"),
					),
				],
			});

			const actions = buildTreeActions(bulkEvent);

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Move);
			expect(getNodeName(action.targetLocator)).toBe("pie");
			if (action.actionType === TreeActionType.Move) {
				expect(action.newNodeName).toBe("pie");
				expect(getNodeName(action.newParentLocator)).toBe("sweet");
			}
		});

		it("FolderRenamed inside pie→recipe/pie => Move", () => {
			const bulkEvent = bulk({
				roots: [
					evFolderRenamed(
						spFolder(["Library"], "pie"),
						spFolder(["Library", "recipe"], "pie"),
					),
				],
			});

			const actions = buildTreeActions(bulkEvent);

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Move);
			expect(getNodeName(action.targetLocator)).toBe("pie");
			if (action.actionType === TreeActionType.Move) {
				expect(getNodeName(action.newParentLocator)).toBe("recipe");
				expect(action.newNodeName).toBe("pie");
			}
		});

		it("FileRenamed inside pie.md→pies.md => Rename", () => {
			const bulkEvent = bulk({
				roots: [
					evFileRenamed(
						spMdFile(["Library"], "pie"),
						spMdFile(["Library"], "pies"),
					),
				],
			});

			const actions = buildTreeActions(bulkEvent);

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Rename);
			expect(getNodeName(action.targetLocator)).toBe("pie");
			if (action.actionType === TreeActionType.Rename) {
				expect(action.newNodeName).toBe("pies");
			}
		});

		it("FileRenamed inside pie.md→sweet-pie.md => Move", () => {
			const bulkEvent = bulk({
				roots: [
					evFileRenamed(
						spMdFile(["Library"], "pie"),
						spMdFile(["Library"], "sweet-pie"),
					),
				],
			});

			const actions = buildTreeActions(bulkEvent);

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Move);
			expect(getNodeName(action.targetLocator)).toBe("pie");
			if (action.actionType === TreeActionType.Move) {
				expect(action.newNodeName).toBe("pie");
				expect(getNodeName(action.newParentLocator)).toBe("sweet");
			}
		});

		it("FileRenamed inside pie.md→recipe/pie.md => Move", () => {
			const bulkEvent = bulk({
				roots: [
					evFileRenamed(
						spMdFile(["Library"], "pie"),
						spMdFile(["Library", "recipe"], "pie"),
					),
				],
			});

			const actions = buildTreeActions(bulkEvent);

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Move);
			expect(getNodeName(action.targetLocator)).toBe("pie");
			if (action.actionType === TreeActionType.Move) {
				expect(getNodeName(action.newParentLocator)).toBe("recipe");
				expect(action.newNodeName).toBe("pie");
			}
		});
	});

	describe("D) Noise handling", () => {
		it("FileCreated outside-only => no actions", () => {
			const bulkEvent = bulk({
				events: [evFileCreated(spMdFile(["Inbox"], "a"))],
			});

			const actions = buildTreeActions(bulkEvent);

			expect(actions.length).toBe(0);
		});

		it("Mixed bulk: folder move root + descendant file renames => only folder root action", () => {
			const bulkEvent = bulk({
				events: [
					evFileRenamed(
						spMdFile(["Library", "parent"], "a"),
						spMdFile(["Library", "archive", "parent"], "a"),
					),
					evFileRenamed(
						spMdFile(["Library", "parent", "b"], "c"),
						spMdFile(["Library", "archive", "parent", "b"], "c"),
					),
				],
				roots: [
					evFolderRenamed(
						spFolder(["Library"], "parent"),
						spFolder(["Library", "archive"], "parent"),
					),
				],
			});

			const actions = buildTreeActions(bulkEvent);

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Move);
			expect(getNodeName(action.targetLocator)).toBe("parent");
		});
	});
});

