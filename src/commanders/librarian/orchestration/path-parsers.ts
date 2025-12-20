import type { CoreNameChainFromRoot } from "../types/split-basename";
import { parseBasename } from "../utils/parse-basename";

/**
 * Extract coreNameChain from delete path.
 * Pure function for parsing delete events.
 */
export function parseDeletePathToChain(
	path: string,
	isFolder: boolean,
	libraryRoot: string,
	suffixDelimiter: string,
): CoreNameChainFromRoot | null {
	const pathParts = path.split("/");
	const libraryRootIndex = pathParts.indexOf(libraryRoot);
	if (libraryRootIndex === -1) {
		return null;
	}

	const partsAfterRoot = pathParts.slice(libraryRootIndex + 1);

	if (isFolder) {
		// Folder delete: chain is just the folder path
		return partsAfterRoot;
	}

	// File delete: last part is filename, parse to get coreName
	const filename = partsAfterRoot[partsAfterRoot.length - 1] ?? "";
	const basenameWithoutExt = filename.includes(".")
		? filename.slice(0, filename.lastIndexOf("."))
		: filename;

	const parsed = parseBasename(basenameWithoutExt, suffixDelimiter);
	return [...partsAfterRoot.slice(0, -1), parsed.coreName];
}

/**
 * Extract basename without extension from path.
 */
export function extractBasenameWithoutExt(path: string): string {
	const basename = path.split("/").pop() ?? "";
	return basename.includes(".")
		? basename.slice(0, basename.lastIndexOf("."))
		: basename;
}

