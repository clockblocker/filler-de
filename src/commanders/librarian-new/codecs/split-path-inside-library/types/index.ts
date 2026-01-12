import type {
	SplitPathKind,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../../../managers/obsidian/vault-action-manager/types/split-path";

export type SplitPathToFolderInsideLibrary = SplitPathToFolder & {
	kind: typeof SplitPathKind.Folder;
};

export type SplitPathToFileInsideLibrary = SplitPathToFile & {
	kind: typeof SplitPathKind.File;
};

export type SplitPathToMdFileInsideLibrary = SplitPathToMdFile & {
	kind: typeof SplitPathKind.MdFile;
};

export type SplitPathInsideLibrary =
	| SplitPathToFolderInsideLibrary
	| SplitPathToFileInsideLibrary
	| SplitPathToMdFileInsideLibrary;
