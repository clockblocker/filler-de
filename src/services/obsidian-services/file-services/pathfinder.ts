import { type TFile, TFolder } from "obsidian";
import { SLASH } from "../../../types/literals";
import type { PrettyFileDto } from "./background/background-file-service";
import type {
	AbstractFile,
	SplitPath,
	SplitPathToFile,
	SplitPathToFolder,
} from "./types";

export function splitPathToMdFileFromPrettyPath(
	prettyPath: PrettyFileDto,
): SplitPathToFile {
	return {
		...prettyPath,
		extension: "md",
		type: "file",
	};
}

export function splitPathFromAbstractFile(file: TFile): SplitPathToFile;
export function splitPathFromAbstractFile(folder: TFolder): SplitPathToFolder;
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

export function splitPathFromSystemPath(systemPath: string): SplitPath {
	// Remove leading/trailing slashes and normalize
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
