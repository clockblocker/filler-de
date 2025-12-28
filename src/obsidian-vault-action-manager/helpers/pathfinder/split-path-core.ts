import type { TAbstractFile } from "obsidian";
import { TFile, TFolder } from "obsidian";
import { MD } from "../../types/literals";
import type { SplitPath } from "../../types/split-path";
import { SplitPathType } from "../../types/split-path";

/**
 * Core function to split TAbstractFile into SplitPath.
 * Uses Obsidian's basename property (already excludes extension).
 */
export function splitPathFromAbstract(file: TAbstractFile): SplitPath {
	const parts = file.path.split("/").filter(Boolean);
	const fullBasename = parts.pop() ?? "";
	const pathParts = parts;

	if (file instanceof TFolder) {
		return {
			basename: fullBasename,
			pathParts,
			type: SplitPathType.Folder,
		};
	}

	const extension = file instanceof TFile ? (file.extension ?? "") : "";
	// basename should NOT include extension
	const basename = extension
		? fullBasename.slice(0, -(extension.length + 1))
		: fullBasename;

	if (extension === MD) {
		return {
			basename,
			extension: MD,
			pathParts,
			type: SplitPathType.MdFile,
		};
	}

	return { basename, extension, pathParts, type: SplitPathType.File };
}

/**
 * Core function to split string path into SplitPath.
 */
export function splitPathFromString(path: string): SplitPath {
	const parts = path.split("/").filter(Boolean);
	const fullBasename = parts.pop() ?? "";
	const pathParts = parts;

	const hasDot = fullBasename.includes(".");
	const ext = hasDot
		? fullBasename.slice(fullBasename.lastIndexOf(".") + 1)
		: "";
	// basename should NOT include extension
	const basename = hasDot
		? fullBasename.slice(0, fullBasename.lastIndexOf("."))
		: fullBasename;

	if (ext === MD) {
		return {
			basename,
			extension: MD,
			pathParts,
			type: SplitPathType.MdFile,
		};
	}

	if (hasDot) {
		return {
			basename,
			extension: ext,
			pathParts,
			type: SplitPathType.File,
		};
	}

	// Default: treat as folder when no extension present
	return { basename: fullBasename, pathParts, type: SplitPathType.Folder };
}

/**
 * Build system path from SplitPath.
 * For files: pathParts/basename.extension
 * For folders: pathParts/basename
 */
export function makeSystemPathForSplitPath(
	splitPath:
		| SplitPath
		| { basename: string; pathParts: string[]; extension?: string },
): string {
	const ext =
		"extension" in splitPath
			? (splitPath as { extension: string }).extension
			: "";

	const filename = ext ? `${splitPath.basename}.${ext}` : splitPath.basename;
	return [...splitPath.pathParts, filename].filter(Boolean).join("/");
}
