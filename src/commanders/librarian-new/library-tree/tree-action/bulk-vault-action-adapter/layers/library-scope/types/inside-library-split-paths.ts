import type {
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
