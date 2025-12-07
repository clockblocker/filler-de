import { type TFile, TFolder } from "obsidian";
import type { PrettyPath } from "../../../types/common-interface/dtos";
import type { Prettify } from "../../../types/helpers";
import { SLASH } from "../../../types/literals";

export function fullPathToMdFileFromPrettyPath(
	prettyPath: PrettyPath,
): FullPathToMdFile {
	return {
		...prettyPath,
		extension: "md",
		type: "file",
	};
}

export function fullPathToFolderFromPrettyPath(
	prettyPath: PrettyPath,
): FullPathToFolder {
	return {
		...prettyPath,
		type: "folder",
	};
}

export function getFullPathForAbstractFile(file: TFile): FullPathToMdFile;
export function getFullPathForAbstractFile(folder: TFolder): FullPathToFolder;
export function getFullPathForAbstractFile<T extends FullPath>(
	abstractFile: AbstractFile<T>,
): T {
	const path = abstractFile.path;
	const fullPath = path.split(SLASH).filter(Boolean);
	const title = fullPath.pop() ?? "";

	if (abstractFile instanceof TFolder) {
		return {
			basename: title,
			pathParts: fullPath,
			type: "folder",
		} as T;
	}

	return {
		basename: abstractFile.basename,
		extension: abstractFile.extension,
		pathParts: fullPath,
		type: "file",
	} as T;
}

export function systemPathFromFullPath(fullPath: FullPath): string {
	const { pathParts, basename: title } = fullPath;
	const extension = fullPath.type === "file" ? `.${fullPath.extension}` : "";
	return joinPosix(
		pathToFolderFromPathParts(pathParts),
		safeFileName(title) + extension,
	);
}

// SystemPath shall point to folder or MD file
export function fullPathFromSystemPath(systemPath: string): FullPath {
	// TODO: replace manual string parsing with codec if/when available
	const normalized = systemPath.replace(/^[\\/]+|[\\/]+$/g, "");
	if (!normalized) {
		// Edge case: root path
		return {
			basename: "",
			pathParts: [],
			type: "folder",
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
			type: "file",
		};
	}

	return {
		basename: last,
		pathParts: parts.slice(0, -1),
		type: "folder",
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

export type FullPathToFolder = Prettify<
	PrettyPath & {
		type: "folder";
	}
>;

export type FullPathToMdFile = Prettify<
	PrettyPath & {
		type: "file";
		extension: "md";
	}
>;

export type FullPath = FullPathToFolder | FullPathToMdFile;

export type AbstractFile<T extends FullPath> = T extends { type: "file" }
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
