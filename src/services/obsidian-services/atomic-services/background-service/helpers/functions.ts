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

export function getPrettyPath<T extends SplitPath>(
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
