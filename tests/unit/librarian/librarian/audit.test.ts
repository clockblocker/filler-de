import { describe, expect, it } from "bun:test";
import { LibrarianLegacy } from "../../../../src/commanders/librarian/librarian";
import type { ReadablePrettyFile } from "../../../../src/services/obsidian-services/file-services/background/background-file-service";
import {
	type LegacyVaultAction,
	LegacyVaultActionType,
} from "../../../../src/services/obsidian-services/file-services/background/background-vault-actions";
import type { VaultActionExecutor } from "../../../../src/services/obsidian-services/file-services/background/vault-action-executor";
import { VaultActionQueueLegacy } from "../../../../src/services/obsidian-services/file-services/vault-action-queue";
import type { TexfresserObsidianServices } from "../../../../src/services/obsidian-services/interface";

function createQueueRecorder() {
	const executedActions: LegacyVaultAction[][] = [];
	const executor = {
		execute: async (actions: readonly LegacyVaultAction[]) => {
			executedActions.push([...actions]);
		},
	};

	return {
		executedActions,
		queue: new VaultActionQueueLegacy(executor as VaultActionExecutor, { flushDelayMs: 0 }),
	};
}

describe("LibrarianLegacy audit", () => {
	it("enqueues folder creation and renames to canonical paths", async () => {
		const readers: ReadablePrettyFile[] = [
			{
				basename: "child-parent",
				pathParts: ["Library"],
				readContent: async () => "",
			},
			{
				basename: "NewName",
				pathParts: ["Library", "Parent"],
				readContent: async () => "",
			},
		];

		const { executedActions, queue } = createQueueRecorder();

		// Test double: only methods touched by initTrees/audit
		const backgroundFileService =
			{
				getReadersToAllMdFilesInFolder: async () => readers,
			} as unknown as TexfresserObsidianServices["backgroundFileService"];

		// Test double: opened file service unused in audit path
		const openedFileService =
			{} as TexfresserObsidianServices["openedFileService"];

		const librarian = new LibrarianLegacy({
			actionQueue: queue,
			backgroundFileService,
			openedFileService,
		});

		await librarian.initTrees();

		const flatActions = executedActions.flat();
		const renameActions = flatActions.filter(
			(a) => a.type === LegacyVaultActionType.RenameFile,
		);

		expect(renameActions).toEqual([
			{
				payload: {
					from: { basename: "child-parent", pathParts: ["Library"] },
					to: { basename: "child", pathParts: ["Library"] },
				},
				type: LegacyVaultActionType.RenameFile,
			},
			{
				payload: {
					from: { basename: "NewName", pathParts: ["Library", "Parent"] },
					to: { basename: "NewName-Parent", pathParts: ["Library", "Parent"] },
				},
				type: LegacyVaultActionType.RenameFile,
			},
		]);

		const folderCreates = flatActions.filter(
			(a) => a.type === LegacyVaultActionType.UpdateOrCreateFolder,
		);

		expect(
			folderCreates.some(
				(a) =>
					"prettyPath" in a.payload &&
					a.payload.prettyPath.basename === "parent",
			),
		).toBe(false);
	});
});
