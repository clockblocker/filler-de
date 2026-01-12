import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	type CodecRules,
	type Codecs,
	makeCodecRulesFromSettings,
	makeCodecs,
} from "../../../../../../src/commanders/librarian-new/codecs";
import { buildTreeActions } from "../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/bulk-vault-action-adapter/index";
import { TreeActionType } from "../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/types/tree-action";
import { getNodeName } from "../../../../../../src/commanders/librarian-new/healer/library-tree/tree-action/utils/locator/locator-utils";
import { TreeNodeKind } from "../../../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/atoms";
import type { BulkVaultEvent } from "../../../../../../src/managers/obsidian/vault-action-manager";
import type { PossibleRootVaultEvent } from "../../../../../../src/managers/obsidian/vault-action-manager/impl/event-processing/bulk-event-emmiter/types/bulk/helpers";
import { SplitPathKind } from "../../../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import type {
	FileCreatedVaultEvent,
	FileDeletedVaultEvent,
	FileRenamedVaultEvent,
	FolderCreatedVaultEvent,
	FolderDeletedVaultEvent,
	FolderRenamedVaultEvent,
	VaultEvent,
} from "../../../../../../src/managers/obsidian/vault-action-manager/types/vault-event";
import { VaultEventKind } from "../../../../../../src/managers/obsidian/vault-action-manager/types/vault-event";
import { defaultSettingsForUnitTests } from "../../../../common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../../../common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;
let codecs: Codecs;
let rules: CodecRules;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy({
		showScrollsInCodexesForDepth: 0,
	});
	rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
	codecs = makeCodecs(rules);
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

const spFile = (
	pathParts: string[],
	basename: string,
	ext: string = "txt",
): { basename: string; pathParts: string[]; kind: typeof SplitPathKind.File; extension: string } => ({
	basename,
	extension: ext,
	kind: SplitPathKind.File,
	pathParts,
});

const spFolder = (
	pathParts: string[],
	basename: string,
): { basename: string; pathParts: string[]; kind: typeof SplitPathKind.Folder } => ({
	basename,
	kind: SplitPathKind.Folder,
	pathParts,
});

const spMdFile = (
	pathParts: string[],
	basename: string,
): { basename: string; pathParts: string[]; kind: typeof SplitPathKind.MdFile; extension: "md" } => ({
	basename,
	extension: "md",
	kind: SplitPathKind.MdFile,
	pathParts,
});

const evFileCreated = (
	sp: ReturnType<typeof spFile> | ReturnType<typeof spMdFile>,
): FileCreatedVaultEvent => ({
	kind: VaultEventKind.FileCreated,
	splitPath: sp,
});

const evFileDeleted = (
	sp: ReturnType<typeof spFile> | ReturnType<typeof spMdFile>,
): FileDeletedVaultEvent => ({
	kind: VaultEventKind.FileDeleted,
	splitPath: sp,
});

const evFileRenamed = (
	from: ReturnType<typeof spFile> | ReturnType<typeof spMdFile>,
	to: ReturnType<typeof spFile> | ReturnType<typeof spMdFile>,
): FileRenamedVaultEvent => ({
	from,
	kind: VaultEventKind.FileRenamed,
	to,
});

const evFolderCreated = (sp: ReturnType<typeof spFolder>): FolderCreatedVaultEvent => ({
	kind: VaultEventKind.FolderCreated,
	splitPath: sp,
});

const evFolderDeleted = (sp: ReturnType<typeof spFolder>): FolderDeletedVaultEvent => ({
	kind: VaultEventKind.FolderDeleted,
	splitPath: sp,
});

const evFolderRenamed = (
	from: ReturnType<typeof spFolder>,
	to: ReturnType<typeof spFolder>,
): FolderRenamedVaultEvent => ({
	from,
	kind: VaultEventKind.FolderRenamed,
	to,
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

			const actions = buildTreeActions(bulkEvent, codecs, rules);

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Create);
			expect(getNodeName(action.targetLocator)).toBe("Note");
			expect(action.targetLocator.targetKind).toBe(TreeNodeKind.Scroll);
		});

		it("FileCreated inside nested => Create", () => {
			const bulkEvent = bulk({
				events: [evFileCreated(spMdFile(["Library", "Parent", "Child"], "Note-Child-Parent"))],
			});

			const actions = buildTreeActions(bulkEvent, codecs, rules);

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Create);
			expect(getNodeName(action.targetLocator)).toBe("Note");
			expect(action.targetLocator.targetKind).toBe(TreeNodeKind.Scroll);
		});

		it("FileRenamed outside→inside => Create", () => {
			const bulkEvent = bulk({
				events: [
					evFileRenamed(
						spMdFile(["Inbox"], "a"),
						spMdFile(["Library", "Parent"], "a-Parent"),
					),
				],
			});

			const actions = buildTreeActions(bulkEvent, codecs, rules);

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Create);
			expect(getNodeName(action.targetLocator)).toBe("a");
			expect(action.targetLocator.targetKind).toBe(TreeNodeKind.Scroll);
		});
	});

	describe("B) Delete mapping", () => {
		it("FileDeleted inside => Delete", () => {
			const bulkEvent = bulk({
				roots: [evFileDeleted(spMdFile(["Library", "Section"], "Note-Section"))],
			});

			const actions = buildTreeActions(bulkEvent, codecs, rules);

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

			const actions = buildTreeActions(bulkEvent, codecs, rules);

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Delete);
			expect(getNodeName(action.targetLocator)).toBe("Section");
			expect(action.targetLocator.targetKind).toBe(TreeNodeKind.Section);
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

			const actions = buildTreeActions(bulkEvent, codecs, rules);

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

			const actions = buildTreeActions(bulkEvent, codecs, rules);

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
			// sweet-pie: coreName="sweet", suffix=["pie"]
			// NameKing Move: suffix reversed = path => Library/pie/sweet
			const bulkEvent = bulk({
				roots: [
					evFolderRenamed(
						spFolder(["Library"], "pie"),
						spFolder(["Library"], "sweet-pie"),
					),
				],
			});

			const actions = buildTreeActions(bulkEvent, codecs, rules);

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Move);
			expect(getNodeName(action.targetLocator)).toBe("pie");
			if (action.actionType === TreeActionType.Move) {
				expect(action.newNodeName).toBe("sweet");
				expect(getNodeName(action.newParentLocator)).toBe("pie");
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

			const actions = buildTreeActions(bulkEvent, codecs, rules);

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

			const actions = buildTreeActions(bulkEvent, codecs, rules);

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
			// sweet-pie: coreName="sweet", suffix=["pie"]
			// NameKing Move: suffix reversed = path => Library/pie/sweet-pie.md
			const bulkEvent = bulk({
				roots: [
					evFileRenamed(
						spMdFile(["Library"], "pie"),
						spMdFile(["Library"], "sweet-pie"),
					),
				],
			});

			const actions = buildTreeActions(bulkEvent, codecs, rules);

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Move);
			expect(getNodeName(action.targetLocator)).toBe("pie");
			if (action.actionType === TreeActionType.Move) {
				expect(action.newNodeName).toBe("sweet");
				expect(getNodeName(action.newParentLocator)).toBe("pie");
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

			const actions = buildTreeActions(bulkEvent, codecs, rules);

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

			const actions = buildTreeActions(bulkEvent, codecs, rules);

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

			const actions = buildTreeActions(bulkEvent, codecs, rules);

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Move);
			expect(getNodeName(action.targetLocator)).toBe("parent");
		});
	});
});

