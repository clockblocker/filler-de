import z from "zod";
import { MD } from "../../types/literals";
import {
	type SplitPath,
	SplitPathSchema,
	SplitPathType,
} from "../../types/split-path";
import {
	joinPosix,
	pathToFolderFromPathParts,
	SPLIT_PATH_TO_ROOT_FOLDER,
	safeFileName,
} from "./path-utils";

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

		const basenameWithoutExt =
			extension && title.endsWith(extension)
				? title.slice(0, -extension.length)
				: title;
		return joinPosix(
			pathToFolderFromPathParts(pathParts),
			safeFileName(basenameWithoutExt) + extension,
		);
	},
});

export function systemPathFromSplitPath(splitPath: SplitPath): string {
	return systemPathToSplitPath.encode(splitPath);
}

export function splitPathFromSystemPath(systemPath: string): SplitPath {
	return systemPathToSplitPath.decode(systemPath);
}
