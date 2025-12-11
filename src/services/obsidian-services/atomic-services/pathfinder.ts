import { type TFile, TFolder } from "obsidian";
import type {
	CoreSplitPath,
	SplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../obsidian-vault-action-manager/types/split-path";
import { SLASH } from "../../../types/literals";

export function splitPathToMdFile(path: CoreSplitPath): SplitPathToMdFile {
	return { ...path, extension: "md", type: "MdFile" };
}

export function splitPathToFolder(path: CoreSplitPath): SplitPathToFolder {
	return { ...path, type: "Folder" };
}

export function getFullPathForAbstractFile(file: TFile): SplitPathToMdFile;
export function getFullPathForAbstractFile(folder: TFolder): SplitPathToFolder;
export function getFullPathForAbstractFile<T extends SplitPath>(
	abstractFile: AbstractFile<T>,
): T {
	const path = abstractFile.path;
	const fullPath = path.split(SLASH).filter(Boolean);
	const title = fullPath.pop() ?? "";

	if (abstractFile instanceof TFolder) {
		return {
			basename: title,
			pathParts: fullPath,
			type: "Folder",
		} as T;
	}

	return {
		basename: abstractFile.basename,
		extension: abstractFile.extension,
		pathParts: fullPath,
		type: "MdFile",
	} as T;
}

export function systemPathFromFullPath(fullPath: SplitPath): string {
	const { pathParts, basename: title } = fullPath;
	const extension =
		fullPath.type === "Folder" ? "" : `.${fullPath.extension}`;
	return joinPosix(
		pathToFolderFromPathParts(pathParts),
		safeFileName(title) + extension,
	);
}

// SystemPath shall point to folder or MD file
export function fullPathFromSystemPath(systemPath: string): SplitPath {
	// TODO: replace manual string parsing with codec if/when available
	const normalized = systemPath.replace(/^[\\/]+|[\\/]+$/g, "");
	if (!normalized) {
		// Edge case: root path
		return {
			basename: "",
			pathParts: [],
			type: "Folder",
		};
	}
	const parts = normalized.split("/").filter(Boolean);

	const last = parts[parts.length - 1] ?? "";
	const hasExtension = last.includes(".");

	if (hasExtension) {
		const dotIdx = last.lastIndexOf(".");
		const basename = last.substring(0, dotIdx);
		const extension = last.substring(dotIdx + 1);
		if (extension !== "md") {
			throw new Error(`Invalid extension: ${extension}`);
		}

		return {
			basename,
			extension,
			pathParts: parts.slice(0, -1),
			type: "MdFile",
		};
	}

	return {
		basename: last,
		pathParts: parts.slice(0, -1),
		type: "Folder",
	};
}

export function safeFileName(s: string): string {
	return s.replace(/[\\/]/g, " ").trim();
}

export function pathToFolderFromPathParts(pathParts: string[]): string {
	return joinPosix(...pathParts);
}

export function joinPosix(...parts: string[]): string {
	const cleaned = parts
		.filter(Boolean)
		.map((p) => p.replace(/(^[\\/]+)|([\\/]+$)/g, "")) // trim leading/trailing slashes/backslashes
		.filter((p) => p.length > 0);
	return cleaned.join("/");
}

export type FullPathToFolder = SplitPathToFolder;
export type FullPathToMdFile = SplitPathToMdFile;
export type FullPath = SplitPath;

export type AbstractFile<T extends FullPath> = T extends { type: "MdFile" }
	? TFile
	: TFolder;

export type FileWithContent = {
	fullPath: FullPathToMdFile;
	content?: string;
};

export type FileFromTo = {
	from: FullPathToMdFile;
	to: FullPathToMdFile;
};
