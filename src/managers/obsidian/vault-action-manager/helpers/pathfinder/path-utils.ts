import type { TFile } from "obsidian";
import { TFolder } from "obsidian";
import { MD } from "../../types/literals";
import type {
	AnySplitPath,
	CommonSplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../types/split-path";
import { SplitPathType } from "../../types/split-path";

export function splitPathToMdFileFromCore(
	core: CommonSplitPath,
): SplitPathToMdFile {
	return {
		...core,
		extension: MD,
		type: SplitPathType.MdFile,
	};
}

export function splitPathToFolderFromCore(
	core: CommonSplitPath,
): SplitPathToFolder {
	return {
		...core,
		type: SplitPathType.Folder,
	};
}

export function getSplitPathForAbstractFile(file: TFile): SplitPathToMdFile;
export function getSplitPathForAbstractFile(folder: TFolder): SplitPathToFolder;
export function getSplitPathForAbstractFile<SP extends AnySplitPath>(
	abstractFile: AbstractFileForSplitPath<SP>,
): SP {
	const path = abstractFile.path;
	const fullPath = path.split("/").filter(Boolean);
	const title = fullPath.pop() ?? "";

	if (abstractFile instanceof TFolder) {
		return {
			basename: title,
			pathParts: fullPath,
			type: SplitPathType.Folder,
		} as SP;
	}

	const extension = abstractFile.extension ?? "";
	if (extension === MD) {
		return {
			basename: abstractFile.basename,
			extension: MD,
			pathParts: fullPath,
			type: SplitPathType.MdFile,
		} as SP;
	}

	return {
		basename: abstractFile.basename,
		extension,
		pathParts: fullPath,
		type: SplitPathType.File,
	} as SP;
}

export function safeFileName(s: string): string {
	// Replace truly invalid filename characters with spaces
	// Path separators must be sanitized: \ /
	// Other characters are preserved - Obsidian's behavior is the golden source
	// Obsidian accepts: ! @ # $ % and many other special chars
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

export type AbstractFileForSplitPath<SP extends AnySplitPath> = SP extends {
	type: "Folder";
}
	? TFolder
	: SP extends { type: "MdFile" }
		? TFile
		: SP extends { type: "File" }
			? TFile
			: never;

export type MdFileWithContentDto = {
	splitPath: SplitPathToMdFile;
	content?: string;
};

export const SPLIT_PATH_TO_ROOT_FOLDER: SplitPathToFolder = {
	basename: "",
	pathParts: [],
	type: SplitPathType.Folder,
} as const;

/**
 * Finds the first available indexed filename in the target folder.
 * Pattern: `${index}_${basename}.md` (e.g., `1_file.md`, `2_file.md`)
 */
export async function findFirstAvailableIndexedPath<SP extends AnySplitPath>(
	target: SP,
	existingBasenames: Set<string>,
): Promise<SP> {
	let index = 1;
	let indexedBasename: string;

	while (true) {
		indexedBasename = `${index}_${target.basename}`;
		if (!existingBasenames.has(indexedBasename)) {
			break;
		}
		index += 1;
	}

	return {
		...target,
		basename: indexedBasename,
	};
}
