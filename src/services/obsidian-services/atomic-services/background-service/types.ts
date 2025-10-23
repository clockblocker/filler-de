import type { TFile, TFolder } from "obsidian";
import type { SplitPathToMdFile } from "../../../../types/common-interface/dtos";

export type SplitPathToFolder = SplitPathToMdFile & {
	type: "folder";
};

export type SplitPathToFile = SplitPathToMdFile & {
	type: "file";
	extension: "md" | string;
};

export type SplitPath = SplitPathToFolder | SplitPathToFile;

export type AbstractFile<T extends SplitPath> = T extends { type: "file" }
	? TFile
	: TFolder;
