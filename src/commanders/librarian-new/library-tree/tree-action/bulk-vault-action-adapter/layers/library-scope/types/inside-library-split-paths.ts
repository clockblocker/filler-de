import type {
	SplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
	SplitPathType,
} from "../../../../../../../../obsidian-vault-action-manager/types/split-path";

export type SplitPathToFolderInsideLibrary = SplitPathToFolder & {
	type: typeof SplitPathType.Folder;
};
export type SplitPathToFileInsideLibrary = SplitPathToFile & {
	type: typeof SplitPathType.File;
};
export type SplitPathToMdFileInsideLibrary = SplitPathToMdFile & {
	type: typeof SplitPathType.MdFile;
};

export type SplitPathInsideLibrary =
	| SplitPathToFolderInsideLibrary
	| SplitPathToFileInsideLibrary
	| SplitPathToMdFileInsideLibrary;

export type VaultScopedSplitPath<T extends SplitPathInsideLibrary> =
	T extends SplitPathToFolderInsideLibrary
		? SplitPathToFolder
		: T extends SplitPathToMdFileInsideLibrary
			? SplitPathToMdFile
			: T extends SplitPathToFileInsideLibrary
				? SplitPathToFile
				: SplitPath;

export type LibraryScopedSplitPath<T extends SplitPath> =
	T extends SplitPathToFolder
		? SplitPathToFolderInsideLibrary
		: T extends SplitPathToMdFile
			? SplitPathToMdFileInsideLibrary
			: T extends SplitPathToFile
				? SplitPathToFileInsideLibrary
				: SplitPath;
