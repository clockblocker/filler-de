import { type TFile, TFolder } from "obsidian";
import type { PrettyPathLegacy } from "../../../types/common-interface/dtos";
import type { Prettify } from "../../../types/helpers";
import { SLASH } from "../../../types/literals";

export function legacyFullPathToMdFileFromPrettyPathLegacy(
	prettyPath: PrettyPathLegacy,
): LegacyFullPathToMdFile {
	return {
		...prettyPath,
		extension: "md",
		type: "file",
	};
}

export function legacyFullPathToFolderFromPrettyPathLegacy(
	prettyPath: PrettyPathLegacy,
): LegacyFullPathToFolder {
	return {
		...prettyPath,
		type: "folder",
	};
}

export function legacyGetFullPathForAbstractFile(
	file: TFile,
): LegacyFullPathToMdFile;
export function legacyGetFullPathForAbstractFile(
	folder: TFolder,
): LegacyFullPathToFolder;
export function legacyGetFullPathForAbstractFile<T extends LegacyFullPath>(
	abstractFile: LegacyAbstractFile<T>,
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

export function legacySystemPathFromFullPath(fullPath: LegacyFullPath): string {
	const { pathParts, basename: title } = fullPath;
	const extension = fullPath.type === "file" ? `.${fullPath.extension}` : "";
	return legacyJoinPosix(
		legacyPathToFolderFromPathParts(pathParts),
		legacySafeFileName(title) + extension,
	);
}

// SystemPath shall point to folder or MD file
export function fullPathFromSystemPathLegacy(
	systemPath: string,
): LegacyFullPath {
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

export function legacySafeFileName(s: string): string {
	return s.replace(/[\\/]/g, " ").trim();
}

export function legacyPathToFolderFromPathParts(pathParts: string[]): string {
	return legacyJoinPosix(...pathParts);
}

export function legacyJoinPosix(...parts: string[]): string {
	const cleaned = parts
		.filter(Boolean)
		.map((p) => p.replace(/(^[\\/]+)|([\\/]+$)/g, "")) // trim leading/trailing slashes/backslashes
		.filter((p) => p.length > 0);
	return cleaned.join("/");
}

export type LegacyFullPathToFolder = Prettify<
	PrettyPathLegacy & {
		type: "folder";
	}
>;

export type LegacyFullPathToMdFile = Prettify<
	PrettyPathLegacy & {
		type: "file";
		extension: "md";
	}
>;

export type LegacyFullPath = LegacyFullPathToFolder | LegacyFullPathToMdFile;

export type LegacyAbstractFile<T extends LegacyFullPath> = T extends {
	type: "file";
}
	? TFile
	: TFolder;

export type LegacyFileWithContent = {
	fullPath: LegacyFullPathToMdFile;
	content?: string;
};

export type LegacyFileFromTo = {
	from: LegacyFullPathToMdFile;
	to: LegacyFullPathToMdFile;
};
