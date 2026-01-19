import type {
	AnySplitPath,
	SplitPathKind,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type {
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../../../../../../../../codecs";

export type DescopedSplitPath<SK extends SplitPathKind> =
	SK extends typeof SplitPathKind.Folder
		? SplitPathToFolder
		: SK extends typeof SplitPathKind.MdFile
			? SplitPathToMdFile
			: SplitPathToFile;

export type ExtractKind<SP extends AnySplitPath> = SP["kind"];

export type EnscopedSplitPath<T extends AnySplitPath> =
	T extends SplitPathToFolder
		? SplitPathToFolderInsideLibrary
		: T extends SplitPathToMdFile
			? SplitPathToMdFileInsideLibrary
			: T extends SplitPathToFile
				? SplitPathToFileInsideLibrary
				: AnySplitPath;
