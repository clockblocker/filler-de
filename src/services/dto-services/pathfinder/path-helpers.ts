import type { PrettyPath } from "../../../types/common-interface/dtos";
import { SLASH } from "../../../types/literals";

/**
 * Converts a system path to a PrettyPath, defaulting to folder type.
 * For file paths, use systemFilePathToPrettyPath or provide the extension explicitly.
 */
export function systemPathToPrettyPath(path: string): PrettyPath {
	if (!path || path === "/")
		return { basename: "", pathParts: [], type: "folder" };

	const splitPath = path.split(SLASH).filter(Boolean);
	const title = splitPath.pop() ?? "";

	return {
		basename: title,
		pathParts: splitPath,
		type: "folder",
	};
}

/**
 * Converts a file path to a PrettyPath by extracting the extension from the filename.
 */
export function systemFilePathToPrettyPath(path: string): PrettyPath {
	if (!path || path === "/")
		return { basename: "", pathParts: [], type: "folder" };

	const splitPath = path.split(SLASH).filter(Boolean);
	const filename = splitPath.pop() ?? "";

	// Extract extension from filename
	const lastDotIndex = filename.lastIndexOf(".");
	const extension =
		lastDotIndex > 0 ? filename.substring(lastDotIndex + 1) : "";
	const title =
		lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;

	if (extension) {
		return {
			basename: title,
			extension,
			pathParts: splitPath,
			type: "file",
		};
	}

	// Fallback to folder if no extension found
	return {
		basename: filename,
		pathParts: splitPath,
		type: "folder",
	};
}

export function systemPathFromPrettyPath(prettyPath: PrettyPath): string {
	const { pathParts, basename: title } = prettyPath;
	const extension =
		prettyPath.type === "file" ? `.${prettyPath.extension}` : "";
	return joinPosix(
		pathToFolderFromPathParts(pathParts),
		safeFileName(title) + extension,
	);
}

// exports for testing
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
