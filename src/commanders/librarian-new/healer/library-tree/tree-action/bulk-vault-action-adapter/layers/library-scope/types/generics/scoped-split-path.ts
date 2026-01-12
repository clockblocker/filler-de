import type {
	AnySplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type {
	AnySplitPathInsideLibrary,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../../../../../../../codecs";

export type DescopedSplitPath<T extends AnySplitPathInsideLibrary> =
	T extends SplitPathToFolderInsideLibrary
		? SplitPathToFolder
		: T extends SplitPathToMdFileInsideLibrary
			? SplitPathToMdFile
			: T extends SplitPathToFileInsideLibrary
				? SplitPathToFile
				: AnySplitPath;

export type EnscopedSplitPath<T extends AnySplitPath> =
	T extends SplitPathToFolder
		? SplitPathToFolderInsideLibrary
		: T extends SplitPathToMdFile
			? SplitPathToMdFileInsideLibrary
			: T extends SplitPathToFile
				? SplitPathToFileInsideLibrary
				: AnySplitPath;
