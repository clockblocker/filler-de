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
	if ("extension" in splitPath) {
		const alreadyHasExt = splitPath.basename.endsWith(
			`.${splitPath.extension}`,
		);
		const base = alreadyHasExt
			? splitPath.basename
			: `${splitPath.basename}.${splitPath.extension}`;
		return [...splitPath.pathParts, base].join("/");
	}
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
	const rawBasename = parts.pop() ?? "";
	const pathParts = parts;

	if (file instanceof TFolder) {
		return { basename: rawBasename, pathParts, type: "Folder" };
	}

	const extension = file instanceof TFile ? (file.extension ?? "") : "";
	if (extension === MD_EXTENSION) {
		const basename =
			file instanceof TFile && file.basename
				? file.basename
				: rawBasename.replace(/\.md$/i, "");
		return { basename, extension: "md", pathParts, type: "MdFile" };
	}

	return { basename: rawBasename, extension, pathParts, type: "File" };
}

function splitPathFromString(path: string): SplitPath {
	const parts = path.split("/").filter(Boolean);
	const rawBasename = parts.pop() ?? "";
	const pathParts = parts;

	const hasDot = rawBasename.includes(".");
	const ext = hasDot
		? rawBasename.slice(rawBasename.lastIndexOf(".") + 1)
		: "";

	if (ext === MD_EXTENSION) {
		const basename = rawBasename.slice(0, rawBasename.lastIndexOf("."));
		return { basename, extension: "md", pathParts, type: "MdFile" };
	}

	if (hasDot) {
		return {
			basename: rawBasename,
			extension: ext,
			pathParts,
			type: "File",
		};
	}

	// Default: treat as folder when no extension present
	return { basename: rawBasename, pathParts, type: "Folder" };
}
