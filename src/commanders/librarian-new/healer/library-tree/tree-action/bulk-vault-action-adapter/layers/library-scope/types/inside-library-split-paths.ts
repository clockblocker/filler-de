import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
	SplitPathKind,
} from "../../../../../../../../../managers/obsidian/vault-action-manager/types/split-path";

export type SplitPathToFolderInsideLibrary = SplitPathToFolder & {
	type: typeof SplitPathKind.Folder;
};
export type SplitPathToFileInsideLibrary = SplitPathToFile & {
	type: typeof SplitPathKind.File;
};
export type SplitPathToMdFileInsideLibrary = SplitPathToMdFile & {
	type: typeof SplitPathKind.MdFile;
};

export type SplitPathInsideLibrary =
	| SplitPathToFolderInsideLibrary
	| SplitPathToFileInsideLibrary
	| SplitPathToMdFileInsideLibrary;
