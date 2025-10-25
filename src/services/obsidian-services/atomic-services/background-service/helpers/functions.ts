import { TFolder } from "obsidian";
import type { PrettyPath } from "../../../../../types/common-interface/dtos";
import { SLASH } from "../../../../../types/literals";
import type { AbstractFile, SplitPath, SplitPathToFile } from "../types";

export function splitPathToMdFileFromPrettyPath(
	prettyPath: PrettyPath,
): SplitPathToFile {
	return {
		...prettyPath,
		extension: "md",
		type: "file",
	};
}

export function splitPathFromAbstractFile<T extends SplitPath>(
	abstractFile: AbstractFile<T>,
): T {
	const path = abstractFile.path;
	const splitPath = path.split(SLASH).filter(Boolean);
	const title = splitPath.pop() ?? "";

	if (abstractFile instanceof TFolder) {
		return {
			basename: title,
			pathParts: splitPath,
			type: "folder",
		} as T;
	}

	return {
		basename: abstractFile.basename,
		extension: abstractFile.extension,
		pathParts: splitPath,
		type: "file",
	} as T;
}

export function systemPathFromSplitPath(splitPath: SplitPath): string {
	const { pathParts, basename: title } = splitPath;
	const extension =
		splitPath.type === "file" ? `.${splitPath.extension}` : "";
	return joinPosix(
		pathToFolderFromPathParts(pathParts),
		safeFileName(title) + extension,
	);
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
