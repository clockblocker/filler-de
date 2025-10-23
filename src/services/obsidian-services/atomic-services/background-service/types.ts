import type { TFile, TFolder } from "obsidian";
import type { PrettyPathToMdFile } from "../../../../types/common-interface/dtos";

export type SplitPathToFolder = PrettyPathToMdFile & {
	type: "folder";
};

export type SplitPathToFile = PrettyPathToMdFile & {
	type: "file";
	extension: "md" | string;
};

export type SplitPath = SplitPathToFolder | SplitPathToFile;

export type AbstractFile<T extends SplitPath> = T extends { type: "file" }
	? TFile
	: TFolder;
