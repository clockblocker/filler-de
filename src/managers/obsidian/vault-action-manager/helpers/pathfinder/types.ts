import type { TAbstractFile, TFile, TFolder } from "obsidian";
import type {
	AnySplitPath,
	SplitPathToAnyFile,
	SplitPathToFolder,
} from "../../types/split-path";

/**
 * Given a SplitPath, returns the corresponding Obsidian TAbstractFile type.
 *
 * @example
 * DiscriminatedTAbstractFile<SplitPathToFolder> // TFolder
 * DiscriminatedTAbstractFile<SplitPathToFile>   // TFile
 * DiscriminatedTAbstractFile<SplitPathToMdFile> // TFile
 */
export type DiscriminatedTAbstractFile<SP extends AnySplitPath> = SP extends {
	kind: "Folder";
}
	? TFolder
	: SP extends { kind: "MdFile" }
		? TFile
		: SP extends { kind: "File" }
			? TFile
			: never;

/**
 * Given a TAbstractFile, returns the corresponding SplitPath type.
 * Note: TFile maps to SplitPathToFile | SplitPathToMdFile since the
 * distinction requires runtime inspection of the extension.
 *
 * @example
 * DiscriminatedSplitPath<TFolder> // SplitPathToFolder
 * DiscriminatedSplitPath<TFile>   // SplitPathToFile | SplitPathToMdFile
 */
export type DiscriminatedSplitPath<T extends TAbstractFile> = T extends TFolder
	? SplitPathToFolder
	: SplitPathToAnyFile;
