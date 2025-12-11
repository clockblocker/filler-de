import { describe, expect, it } from "bun:test";
import { Librarian } from "../../../../src/commanders/librarian/librarian";
import type { ObsidianVaultActionManager } from "../../../../src/commanders/obsidian-vault-action-manager";
import { splitPathKey } from "../../../../src/obsidian-vault-action-manager";
import type { SplitPath } from "../../../../src/obsidian-vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionType,
} from "../../../../src/obsidian-vault-action-manager/types/vault-action";
import type { LegacyOpenedFileService } from "../../../../src/services/obsidian-services/file-services/active-view/legacy-opened-file-service";

function createManagerRecorder(readers: { basename: string; pathParts: string[] }[]) {
	const executedActions: VaultAction[][] = [];
	const manager = {
		dispatch: async (actions: readonly VaultAction[]) => {
			executedActions.push([...actions]);
		},
		exists: async () => false,
		// Minimal list/read/exists to satisfy manager-fs-adapter recursion
		list: async (folder: SplitPath): Promise<SplitPath[]> => {
			const currentPath = splitPathKey(folder);
			const entries: SplitPath[] = [];
			for (const r of readers) {
				const parent = r.pathParts.join("/");
				if (parent === currentPath) {
					entries.push({
						basename: r.basename.replace(/\.md$/, ""),
						extension: "md",
						pathParts: r.pathParts,
						type: "MdFile",
					} as SplitPath);
				} else if (
					r.pathParts.length > 1 &&
					r.pathParts[0] !== undefined &&
					(currentPath === "" || currentPath === r.pathParts[0])
				) {
					entries.push({
						basename: r.pathParts[1] ?? "",
						pathParts: [r.pathParts[0] ?? ""],
						type: "Folder",
					} as SplitPath);
				}
			}
			return entries;
		},
		readContent: async () => "",
	} as unknown as ObsidianVaultActionManager;

	return { executedActions, manager };
}

describe("Librarian audit", () => {
	it("enqueues folder creation and renames to canonical paths", async () => {
		const readers = [
			{
				basename: "child-parent",
				pathParts: ["Library"],
			},
			{
				basename: "NewName",
				pathParts: ["Library", "Parent"],
			},
		];

		const { executedActions, manager } = createManagerRecorder(readers);
		const openedFileService = {
			cd: async () => {},
			getApp: () =>
				({
					workspace: {
						getActiveFile: () => null,
					},
				}) as unknown,
			pwd: async () => ({
				basename: "",
				pathParts: [],
				type: "Folder",
			}),
		} as unknown as LegacyOpenedFileService;

		const librarian = new Librarian({
			manager,
			openedFileService,
		});

		await librarian.initTrees();

		const flatActions = executedActions.flat();
		const renameActions = flatActions.filter(
			(a) => a.type === VaultActionType.RenameFile,
		);

		expect(renameActions).toEqual([
			expect.objectContaining({
				payload: {
					from: expect.objectContaining({
						basename: "child-parent.md",
						extension: "md",
						pathParts: ["Library"],
					}),
					to: expect.objectContaining({
						basename: "child.md",
						extension: "md",
						pathParts: ["Library"],
					}),
				},
				type: VaultActionType.RenameFile,
			}),
			expect.objectContaining({
				payload: {
					from: expect.objectContaining({
						basename: "NewName.md",
						extension: "md",
						pathParts: ["Library", "Parent"],
					}),
					to: expect.objectContaining({
						basename: "NewName-Parent.md",
						extension: "md",
						pathParts: ["Library", "Parent"],
					}),
				},
				type: VaultActionType.RenameFile,
			}),
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
