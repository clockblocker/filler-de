import type { TFile, TFolder } from "obsidian";
import type { PrettyPath } from "../../../types/common-interface/dtos";
import type { Prettify } from "../../../types/helpers";

export type SplitPathToFolder = Prettify<
	PrettyPath & {
		type: "folder";
	}
>;

export type SplitPathToFile = Prettify<
	PrettyPath & {
		type: "file";
		extension: "md" | string;
	}
>;

export type SplitPath = SplitPathToFolder | SplitPathToFile;

export type AbstractFile<T extends SplitPath> = T extends { type: "file" }
	? TFile
	: TFolder;

export type FileWithContent = {
	splitPath: SplitPathToFile;
	content?: string;
};

export type FileFromTo = {
	from: SplitPathToFile;
	to: SplitPathToFile;
};
