import z from "zod";
import { MD } from "../../../../types/literals";
import {
	type AnySplitPath,
	SplitPathKind,
	SplitPathSchema,
} from "../../../../types/split-path";
import {
	pathToFolderFromPathParts,
	SPLIT_PATH_TO_ROOT_FOLDER,
} from "../../path-utils";

function joinPosix(...parts: string[]): string {
	const cleaned = parts
		.filter(Boolean)
		.map((p) => p.replace(/(^[\\/]+)|([\\/]+$)/g, ""))
		.filter((p) => p.length > 0);
	return cleaned.join("/");
}

function safeFileName(s: string): string {
	return s.replace(/[\\/]/g, " ").trim();
}

export const systemPathToSplitPath = z.codec(z.string(), SplitPathSchema, {
	decode: (systemPath: string): AnySplitPath => {
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
					kind: SplitPathKind.MdFile,
					pathParts: parts.slice(0, -1),
				};
			}

			return {
				basename,
				extension,
				kind: SplitPathKind.File,
				pathParts: parts.slice(0, -1),
			};
		}

		return {
			basename: last,
			kind: SplitPathKind.Folder,
			pathParts: parts.slice(0, -1),
		};
	},
	encode: (splitPath: AnySplitPath): string => {
		const { pathParts, basename: title } = splitPath;
		const extension =
			splitPath.kind === SplitPathKind.MdFile ||
			splitPath.kind === SplitPathKind.File
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

export function systemPathFromSplitPathInternal(
	splitPath: AnySplitPath,
): string {
	return systemPathToSplitPath.encode(splitPath);
}

export function splitPathFromSystemPathInternal(
	systemPath: string,
): AnySplitPath {
	return systemPathToSplitPath.decode(systemPath);
}
