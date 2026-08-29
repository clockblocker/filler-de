import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type spyOn,
} from "bun:test";
import type {
	FileCreatedVaultEvent,
	FileDeletedVaultEvent,
	FileRenamedVaultEvent,
	FolderDeletedVaultEvent,
	FolderRenamedVaultEvent,
	PossibleRootVaultEvent,
	VaultEvent,
} from "@textfresser/vault-action-manager";
import {
	MD,
	SplitPathKind,
	VaultEventKind,
} from "@textfresser/vault-action-manager";
import {
	type CodecRules,
	type Codecs,
	makeCodecRulesFromSettings,
	makeCodecs,
} from "../../../../../../src/codecs";
import {
	type BulkInterpreter,
	makeBulkInterpreter,
} from "../../../../../../src/healer/library-tree/tree-action/bulk-vault-action-adapter";
import { TreeActionType } from "../../../../../../src/healer/library-tree/tree-action/types/tree-action";
import { getNodeName } from "../../../../../../src/healer/library-tree/tree-action/utils/locator/locator-utils";
import { TreeNodeKind } from "../../../../../../src/healer/library-tree/tree-node/types/atoms";
import type { LibraryBulk } from "../../../../../../src/tree/library-scope";
import { defaultSettingsForUnitTests } from "../../../../common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../../../common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;
let codecs: Codecs;
let interpretBulk: BulkInterpreter;
let rules: CodecRules;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy({
		showScrollsInCodexesForDepth: 0,
	});
	rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
	codecs = makeCodecs(rules);
	interpretBulk = makeBulkInterpreter(codecs);
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

const spFile = (
	pathParts: string[],
	basename: string,
	ext = "txt",
): {
	basename: string;
	pathParts: string[];
	kind: typeof SplitPathKind.File;
	extension: string;
} => ({
	basename,
	extension: ext,
	kind: SplitPathKind.File,
	pathParts,
});

const spFolder = (
	pathParts: string[],
	basename: string,
): {
	basename: string;
	pathParts: string[];
	kind: typeof SplitPathKind.Folder;
} => ({
	basename,
	kind: SplitPathKind.Folder,
	pathParts,
});

const spMdFile = (
	pathParts: string[],
	basename: string,
): {
	basename: string;
	pathParts: string[];
	kind: typeof SplitPathKind.MdFile;
	extension: MD;
} => ({
	basename,
	extension: MD,
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

const evFolderDeleted = (
	sp: ReturnType<typeof spFolder>,
): FolderDeletedVaultEvent => ({
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
}): LibraryBulk => ({
	events: events ?? [],
	roots: roots ?? [],
});

describe("makeBulkInterpreter", () => {
	it("returns tree and invalid-codex outcomes from one interpretation", () => {
		const interpretation = interpretBulk(
			bulk({
				events: [
					evFileCreated(spMdFile(["Library", "A"], "Note-A")),
					evFileCreated(spMdFile(["Library", "A"], "__-Wrong")),
				],
			}),
		);

		expect(interpretation.treeActions).toHaveLength(1);
		expect(interpretation.invalidCodexActions).toEqual([
			{
				kind: "DeleteMdFile",
				payload: {
					splitPath: spMdFile(["Library", "A"], "__-Wrong"),
				},
			},
		]);
	});

	describe("A) Create mapping", () => {
		it("FileCreated inside flat => Create", () => {
			const bulkEvent = bulk({
				events: [
					evFileCreated(spMdFile(["Library"], "Note-Child-Parent")),
				],
			});

			const actions = interpretBulk(bulkEvent).treeActions;

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Create);
			expect(getNodeName(action.targetLocator)).toBe("Note");
			expect(action.targetLocator.targetKind).toBe(TreeNodeKind.Scroll);
		});

		it("FileCreated inside nested => Create", () => {
			const bulkEvent = bulk({
				events: [
					evFileCreated(
						spMdFile(
							["Library", "Parent", "Child"],
							"Note-Child-Parent",
						),
					),
				],
			});

			const actions = interpretBulk(bulkEvent).treeActions;

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

			const actions = interpretBulk(bulkEvent).treeActions;

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
				roots: [
					evFileDeleted(
						spMdFile(["Library", "Section"], "Note-Section"),
					),
				],
			});

			const actions = interpretBulk(bulkEvent).treeActions;

			expect(actions).toHaveLength(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Delete);
		});

		it("FolderDeleted inside root => Delete", () => {
			const bulkEvent = bulk({
				roots: [evFolderDeleted(spFolder(["Library"], "Section"))],
			});

			const actions = interpretBulk(bulkEvent).treeActions;

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Delete);
			expect(getNodeName(action.targetLocator)).toBe("Section");
			expect(action.targetLocator.targetKind).toBe(TreeNodeKind.Section);
		});

		it("FileRenamed inside→outside => Delete", () => {
			const rename = evFileRenamed(
				spMdFile(["Library", "A"], "x-A"),
				spMdFile(["Inbox"], "x"),
			);
			const bulkEvent = bulk({
				events: [rename],
				roots: [rename],
			});

			const actions = interpretBulk(bulkEvent).treeActions;

			expect(actions).toHaveLength(1);
			expect(actions[0]?.actionType).toBe(TreeActionType.Delete);
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

			const actions = interpretBulk(bulkEvent).treeActions;

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

			const actions = interpretBulk(bulkEvent).treeActions;

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

			const actions = interpretBulk(bulkEvent).treeActions;

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

			const actions = interpretBulk(bulkEvent).treeActions;

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

			const actions = interpretBulk(bulkEvent).treeActions;

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

			const actions = interpretBulk(bulkEvent).treeActions;

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

			const actions = interpretBulk(bulkEvent).treeActions;

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

			const actions = interpretBulk(bulkEvent).treeActions;

			expect(actions.length).toBe(1);
			const action = actions[0];
			if (!action) throw new Error("Expected action");
			expect(action.actionType).toBe(TreeActionType.Move);
			expect(getNodeName(action.targetLocator)).toBe("parent");
		});
	});
});
