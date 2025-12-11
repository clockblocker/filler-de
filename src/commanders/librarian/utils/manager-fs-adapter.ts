import {
	splitPath as managerSplitPath,
	type ObsidianVaultActionManager,
} from "../../../obsidian-vault-action-manager";
import type {
	CoreSplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../obsidian-vault-action-manager/types/split-path";

export type ManagerFsReader = CoreSplitPath & {
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
		getReadersToAllMdFilesInFolder(folder) {
			return manager.getReadersToAllMdFilesInFolder(toFolder(folder));
		},
		readContent(target) {
			return manager.readContent(toMdFile(target));
		},
	};
}
