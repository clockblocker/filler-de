import { type TFile, TFolder } from "obsidian";
import z from "zod/v4";
import { MD } from "../types/literals";
import {
	type CoreSplitPath,
	type SplitPath,
	SplitPathSchema,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	SplitPathType,
} from "../types/split-path";

export function splitPathToMdFileFromCore(
	core: CoreSplitPath,
): SplitPathToMdFile {
	return {
		...core,
		extension: MD,
		type: SplitPathType.MdFile,
	};
}

export function splitPathToFolderFromCore(
	core: CoreSplitPath,
): SplitPathToFolder {
	return {
		...core,
		type: SplitPathType.Folder,
	};
}

export function getSplitPathForAbstractFile(file: TFile): SplitPathToMdFile;
export function getSplitPathForAbstractFile(folder: TFolder): SplitPathToFolder;
export function getSplitPathForAbstractFile<SP extends SplitPath>(
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

export const systemPathToSplitPath = z.codec(z.string(), SplitPathSchema, {
	decode: (systemPath: string): SplitPath => {
		const normalized = systemPath.replace(/^[\\/]+|[\\/]+$/g, "");
		if (!normalized) {
			return { ...SPLIT_PATH_TO_ROOT_FOLDER };
		}
		const parts = normalized.split("/").filter(Boolean);

		const last = parts[parts.length - 1] ?? "";
		const hasExtension = last.includes(".");

		if (hasExtension) {
			const dotIdx = last.lastIndexOf(".");
			const basename = last.substring(0, dotIdx);
			const extension = last.substring(dotIdx + 1);
			if (extension === MD) {
				return {
					basename,
					extension: MD,
					pathParts: parts.slice(0, -1),
					type: SplitPathType.MdFile,
				};
			}

			return {
				basename,
				extension,
				pathParts: parts.slice(0, -1),
				type: SplitPathType.File,
			};
		}

		return {
			basename: last,
			pathParts: parts.slice(0, -1),
			type: SplitPathType.Folder,
		};
	},
	encode: (splitPath: SplitPath): string => {
		const { pathParts, basename: title } = splitPath;
		const extension =
			splitPath.type === SplitPathType.MdFile ||
			splitPath.type === SplitPathType.File
				? `.${splitPath.extension}`
				: "";
		return joinPosix(
			pathToFolderFromPathParts(pathParts),
			safeFileName(title) + extension,
		);
	},
});

// Legacy function wrappers for backward compatibility
export function systemPathFromSplitPath(splitPath: SplitPath): string {
	return systemPathToSplitPath.encode(splitPath);
}

export function splitPathFromSystemPath(systemPath: string): SplitPath {
	return systemPathToSplitPath.decode(systemPath);
}

export function safeFileName(s: string): string {
	// Replace invalid filename characters with spaces
	// Invalid chars: \ / | : * ? " < > [ ] #
	return s.replace(/[\\/|:*?"<>[\]#]/g, " ").trim();
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

export type AbstractFileForSplitPath<SP extends SplitPath> = SP extends {
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
