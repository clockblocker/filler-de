import type { PrettyPath } from "../../../types/common-interface/dtos";
import { SLASH } from "../../../types/literals";

export function systemPathToPrettyPath(path: string): PrettyPath {
	if (!path || path === "/") return { pathParts: [], title: "" };

	const splitPath = path.split(SLASH).filter(Boolean);

	return {
		pathParts: splitPath,
		title: splitPath.pop() ?? "",
	};
}

export function systemPathToFileFromPrettyPath(prettyPath: PrettyPath) {
	return systemPathFromPrettyPath({ isFile: true, prettyPath });
}

export function systemPathToFolderFromPrettyPath(prettyPath: PrettyPath) {
	return systemPathFromPrettyPath({ isFile: false, prettyPath });
}

export function systemPathFromPrettyPath({
	prettyPath: { pathParts, title },
	isFile,
}: {
	prettyPath: PrettyPath;
	isFile: boolean;
}): string {
	return joinPosix(
		pathToFolderFromPathParts(pathParts),
		safeFileName(title) + (isFile ? ".md" : ""),
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
