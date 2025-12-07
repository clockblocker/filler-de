import { describe, expect, it } from "bun:test";
import { Librarian } from "../../../src/commanders/librarian/librarian";
import type { ReadablePrettyFile } from "../../../src/services/obsidian-services/file-services/background/background-file-service";
import {
	type VaultAction,
	VaultActionType,
} from "../../../src/services/obsidian-services/file-services/background/background-vault-actions";
import { VaultActionQueue } from "../../../src/services/obsidian-services/file-services/vault-action-queue";
import type { TexfresserObsidianServices } from "../../../src/services/obsidian-services/interface";

function createQueueRecorder() {
	const executedActions: VaultAction[][] = [];
	const executor = {
		execute: async (actions: readonly VaultAction[]) => {
			executedActions.push([...actions]);
		},
	};

	return {
		executedActions,
		queue: new VaultActionQueue(executor, { flushDelayMs: 0 }),
	};
}

describe("Librarian audit", () => {
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

		const librarian = new Librarian({
			actionQueue: queue,
			backgroundFileService,
			openedFileService,
		});

		await librarian.initTrees();

		const flatActions = executedActions.flat();
		const renameActions = flatActions.filter(
			(a) => a.type === VaultActionType.RenameFile,
		);

		expect(renameActions).toEqual([
			{
				payload: {
					from: { basename: "child-parent", pathParts: ["Library"] },
					to: { basename: "child", pathParts: ["Library"] },
				},
				type: VaultActionType.RenameFile,
			},
			{
				payload: {
					from: { basename: "NewName", pathParts: ["Library", "Parent"] },
					to: { basename: "NewName-Parent", pathParts: ["Library", "Parent"] },
				},
				type: VaultActionType.RenameFile,
			},
		]);

		const folderCreates = flatActions.filter(
			(a) => a.type === VaultActionType.UpdateOrCreateFolder,
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
