import { describe, expect, it } from "bun:test";
import { Librarian } from "../../../../src/commanders/librarian/librarian";
import type { ObsidianVaultActionManager } from "../../../../src/obsidian-vault-action-manager";
import { splitPathKey } from "../../../../src/obsidian-vault-action-manager";
import type { SplitPath } from "../../../../src/obsidian-vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionType,
} from "../../../../src/obsidian-vault-action-manager/types/vault-action";

function createManagerRecorder(readers: { basename: string; pathParts: string[] }[]) {
	const executedActions: VaultAction[][] = [];
	const manager = {
		dispatch: async (actions: readonly VaultAction[]) => {
			executedActions.push([...actions]);
		},
		exists: async () => false,
		getReadersToAllMdFilesInFolder: async () =>
			readers.map((r) => ({
				basename: `${r.basename}.md`,
				extension: "md",
				pathParts: r.pathParts,
				readContent: async () => "",
				type: "MdFile",
			})),
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
		openFile: async () => {},
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
		} as unknown;

		const librarian = new Librarian({ manager });

		await librarian.initTrees();

		const flatActions = executedActions.flat();
		const renameActions = flatActions.filter(
			(a) => a.type === VaultActionType.RenameMdFile,
		);

		expect(renameActions).toHaveLength(2);
		const fromBasenames = renameActions.map(
			(a) => a.payload.from.basename,
		);
		const toBasenames = renameActions.map((a) => a.payload.to.basename);
		expect(fromBasenames).toEqual(
			expect.arrayContaining(["child-parent.md", "NewName.md"]),
		);
		expect(toBasenames).toEqual(
			expect.arrayContaining(["child", "NewName.md-Parent"]),
		);

		const folderCreates = flatActions.filter(
			(a) => a.type === VaultActionType.CreateFolder,
		);

		expect(
			folderCreates.some(
				(a) =>
					"coreSplitPath" in a.payload &&
					a.payload.coreSplitPath.basename === "parent",
			),
		).toBe(false);
	});
});
