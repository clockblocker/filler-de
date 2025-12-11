import {
	splitPath as managerSplitPath,
	type ObsidianVaultActionManager,
} from "../../../obsidian-vault-action-manager";
import type {
	CoreSplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../obsidian-vault-action-manager/types/split-path";

export type ManagerFsReader = SplitPathToMdFile & {
	readContent: () => Promise<string>;
};

export type ManagerFsAdapter = {
	getReadersToAllMdFilesInFolder(
		folder: SplitPathToFolder,
	): Promise<ManagerFsReader[]>;
	readContent(target: CoreSplitPath): Promise<string>;
	exists(target: CoreSplitPath): Promise<boolean>;
};

export function makeManagerFsAdapter(
	manager: ObsidianVaultActionManager,
): ManagerFsAdapter {
	const toFolder = (core: CoreSplitPath): SplitPathToFolder => ({
		basename: core.basename,
		pathParts: core.pathParts,
		type: "Folder",
	});

	const toMdFile = (core: CoreSplitPath): SplitPathToMdFile => ({
		basename: core.basename,
		extension: "md",
		pathParts: core.pathParts,
		type: "MdFile",
	});

	const toSplitPath = (core: CoreSplitPath) =>
		managerSplitPath([...core.pathParts, core.basename].join("/"));

	return {
		exists(target) {
			return manager.exists(toSplitPath(target));
		},
		async getReadersToAllMdFilesInFolder(folder) {
			const readers = await manager.getReadersToAllMdFilesInFolder(
				toFolder(folder),
			);
			const list = Array.isArray(readers) ? readers : [readers];
			return list.map(
				(reader): ManagerFsReader => ({
					...reader,
					extension: "md",
					type: "MdFile",
				}),
			);
		},
		readContent(target) {
			return manager.readContent(toMdFile(target));
		},
	};
}
