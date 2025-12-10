import type { TAbstractFile } from "obsidian";
import { TFile, TFolder } from "obsidian";
import type {
	CoreSplitPath,
	SplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../types/split-path";

const MD_EXTENSION = "md";

export function splitPathKey(splitPath: CoreSplitPath): string {
	return [...splitPath.pathParts, splitPath.basename].join("/");
}

export function splitPath(path: string): SplitPath;
export function splitPath(file: TFile): SplitPathToFile | SplitPathToMdFile;
export function splitPath(folder: TFolder): SplitPathToFolder;
export function splitPath(file: TAbstractFile): SplitPath;
export function splitPath(
	input: string | TAbstractFile,
): SplitPath | SplitPathToFile | SplitPathToMdFile | SplitPathToFolder {
	if (typeof input === "string") {
		return splitPathFromString(input);
	}
	return splitPathFromAbstract(input);
}

function splitPathFromAbstract(file: TAbstractFile): SplitPath {
	const parts = file.path.split("/").filter(Boolean);
	const basename = parts.pop() ?? "";
	const pathParts = parts;

	if (file instanceof TFolder) {
		return { basename, pathParts, type: "Folder" };
	}

	const extension = file instanceof TFile ? (file.extension ?? "") : "";
	if (extension === MD_EXTENSION) {
		return { basename, extension, pathParts, type: "MdFile" };
	}

	return { basename, extension, pathParts, type: "File" };
}

function splitPathFromString(path: string): SplitPath {
	const parts = path.split("/").filter(Boolean);
	const basename = parts.pop() ?? "";
	const pathParts = parts;

	const hasDot = basename.includes(".");
	const ext = hasDot ? basename.slice(basename.lastIndexOf(".") + 1) : "";

	if (ext === MD_EXTENSION) {
		return { basename, extension: "md", pathParts, type: "MdFile" };
	}

	if (hasDot) {
		return { basename, extension: ext, pathParts, type: "File" };
	}

	// Default: treat as folder when no extension present
	return { basename, pathParts, type: "Folder" };
}
