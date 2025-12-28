import type { TAbstractFile, TFile, TFolder } from "obsidian";
import {
	splitPathFromAbstractInternal,
	splitPathFromSystemPathInternal,
	systemPathFromSplitPathInternal,
} from "../helpers/pathfinder";
import type {
	SplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../types/split-path";

/**
 * Build system path from SplitPath.
 * For files: pathParts/basename.extension
 * For folders: pathParts/basename
 *
 * @example
 * makeSystemPathForSplitPath({ pathParts: ["root", "notes"], basename: "file", extension: "md", type: "MdFile" })
 * // "root/notes/file.md"
 * @example
 * makeSystemPathForSplitPath({ pathParts: ["root"], basename: "folder", type: "Folder" })
 * // "root/folder"
 */
export function makeSystemPathForSplitPath(splitPath: SplitPath): string {
	return systemPathFromSplitPathInternal(splitPath);
}

/**
 * Convert string path or TAbstractFile to SplitPath.
 * External API wrapper around internal pathfinder functions.
 */
export function makeSplitPath(path: string): SplitPath;
export function makeSplitPath(file: TFile): SplitPathToFile | SplitPathToMdFile;
export function makeSplitPath(folder: TFolder): SplitPathToFolder;
export function makeSplitPath(file: TAbstractFile): SplitPath;
export function makeSplitPath(
	input: string | TAbstractFile,
): SplitPath | SplitPathToFile | SplitPathToMdFile | SplitPathToFolder {
	if (typeof input === "string") {
		const result = splitPathFromSystemPathInternal(input);
		// Convert SplitPathType enum to string literals for external API compatibility
		return convertToExternalFormat(result);
	}
	const result = splitPathFromAbstractInternal(input);
	return convertToExternalFormat(result);
}

/**
 * Convert internal SplitPath to external format.
 * SplitPathType enum values are string literals, so types are compatible.
 */
function convertToExternalFormat(
	splitPath: SplitPath,
): SplitPath | SplitPathToFile | SplitPathToMdFile | SplitPathToFolder {
	return splitPath;
}
