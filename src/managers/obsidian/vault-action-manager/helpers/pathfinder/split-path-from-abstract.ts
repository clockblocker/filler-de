import type { TAbstractFile } from "obsidian";
import { TFile, TFolder } from "obsidian";
import { MD } from "../../types/literals";
import type { AnySplitPath } from "../../types/split-path";
import { SplitPathType } from "../../types/split-path";

/**
 * Core function to split TAbstractFile into SplitPath.
 * Uses Obsidian's basename property (already excludes extension).
 */
export function splitPathFromAbstractInternal(
	file: TAbstractFile,
): AnySplitPath {
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
