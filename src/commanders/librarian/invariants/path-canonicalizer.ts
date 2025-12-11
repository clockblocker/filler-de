import type { CoreSplitPath } from "../../obsidian-vault-action-manager/types/split-path";
import type { RootName } from "../constants";
import { UNTRACKED_FOLDER_NAME } from "../constants";
import {
	CodexBaseameSchema,
	PageBasenameSchema,
	ScrollBasenameSchema,
	toNodeName,
	treePathToCodexBasename,
	treePathToPageBasename,
	treePathToScrollBasename,
} from "../indexing/codecs";

import type { TreePath } from "../types";

export type CanonicalFileKind = "scroll" | "page" | "codex";

export type CanonicalizedFile = {
	canonicalPath: CoreSplitPath;
	currentPath: CoreSplitPath;
	kind: CanonicalFileKind;
	treePath: TreePath;
};

export type QuarantinedFile = {
	currentPath: CoreSplitPath;
	destination: CoreSplitPath;
	reason: "undecodable";
};

export type DecodedBasename = {
	kind: CanonicalFileKind;
	treePath: TreePath;
};

export function decodeBasename(basename: string): DecodedBasename | null {
	const codexResult = CodexBaseameSchema.safeParse(basename);
	if (codexResult.success) {
		return {
			kind: "codex",
			treePath: treePathToCodexBasename.decode(codexResult.data),
		};
	}

	const pageResult = PageBasenameSchema.safeParse(basename);
	if (pageResult.success) {
		return {
			kind: "page",
			treePath: treePathToPageBasename.decode(pageResult.data),
		};
	}

	const scrollResult = ScrollBasenameSchema.safeParse(basename);
	if (scrollResult.success) {
		return {
			kind: "scroll",
			treePath: treePathToScrollBasename.decode(scrollResult.data),
		};
	}

	return null;
}

function sanitizeSegments(segments: readonly string[]): string[] {
	return segments.map((segment) => toNodeName(segment));
}

function stripRedundantSuffix(path: string[]): string[] {
	if (path.length < 2) return path;

	const leaf = path[path.length - 1];
	const parent = path[path.length - 2];

	if (leaf && parent && leaf.endsWith(`-${parent}`)) {
		const trimmed = leaf.slice(0, leaf.length - parent.length - 1);
		if (trimmed) {
			const copy = [...path];
			copy[copy.length - 1] = trimmed;
			return copy;
		}
	}
	return path;
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
	if (a.length !== b.length) return false;
	return a.every((v, i) => v === b[i]);
}

function quarantinePath({
	path,
	rootName,
}: {
	path: CoreSplitPath;
	rootName: RootName;
}): CoreSplitPath {
	const folderPath = path.pathParts.slice(1);

	return {
		basename: path.basename,
		pathParts: [rootName, UNTRACKED_FOLDER_NAME, ...folderPath],
	};
}

export type Authority = "folder" | "basename";

export function computeCanonicalPath({
	authority,
	decoded,
	folderPath,
	rootName,
	currentPath,
}: {
	authority: Authority;
	decoded: DecodedBasename;
	folderPath: string[];
	rootName: RootName;
	currentPath: CoreSplitPath;
}): CanonicalizedFile {
	const sanitizedFolderPath = sanitizeSegments(folderPath);
	const decodedPath = sanitizeSegments(decoded.treePath);

	const useFolderPathForCodex =
		authority === "folder" &&
		decodedPath.length > 0 &&
		sanitizedFolderPath.length > 0 &&
		sanitizedFolderPath[sanitizedFolderPath.length - 1] ===
			decodedPath[decodedPath.length - 1];

	if (decoded.kind === "codex") {
		const sectionPath =
			authority === "basename"
				? decodedPath.length === 1 && decodedPath[0] === rootName
					? []
					: decodedPath
				: useFolderPathForCodex
					? sanitizedFolderPath
					: decodedPath.length === 1 && decodedPath[0] === rootName
						? []
						: decodedPath;

		const canonicalPath: CoreSplitPath = {
			basename:
				sectionPath.length === 0
					? treePathToCodexBasename.encode([rootName])
					: treePathToCodexBasename.encode(sectionPath),
			pathParts: [rootName, ...sectionPath],
		};

		const treePath: TreePath =
			sectionPath.length === 0 ? [rootName] : sectionPath;

		return {
			canonicalPath,
			currentPath,
			kind: decoded.kind,
			treePath,
		};
	}

	if (decoded.kind === "page") {
		const decodedParent = decodedPath.slice(0, -1);
		const pageNumber = decodedPath[decodedPath.length - 1] ?? "000";

		const parentPath =
			authority === "folder"
				? stripRedundantSuffix(
						decodedParent.length > 0 &&
							arraysEqual(decodedParent, sanitizedFolderPath)
							? decodedParent
							: sanitizedFolderPath.slice(),
					)
				: stripRedundantSuffix(decodedParent);

		const treePath: TreePath = [...parentPath, pageNumber];

		const canonicalPath: CoreSplitPath = {
			basename: treePathToPageBasename.encode(treePath),
			pathParts: [rootName, ...parentPath],
		};

		return {
			canonicalPath,
			currentPath,
			kind: decoded.kind,
			treePath,
		};
	}

	const decodedParent = decodedPath.slice(0, -1);
	const name = toNodeName(decodedPath[decodedPath.length - 1] ?? "");
	const parentPath =
		authority === "folder"
			? stripRedundantSuffix(
					decodedParent.length > 0 &&
						arraysEqual(decodedParent, sanitizedFolderPath)
						? decodedParent
						: sanitizedFolderPath.slice(),
				)
			: stripRedundantSuffix(decodedParent);

	const treePath: TreePath = [...parentPath, name];

	const canonicalPath: CoreSplitPath = {
		basename: treePathToScrollBasename.encode(treePath),
		pathParts: [rootName, ...parentPath],
	};

	return {
		canonicalPath,
		currentPath,
		kind: decoded.kind,
		treePath,
	};
}

export function canonicalizePath({
	rootName,
	path,
}: {
	rootName: RootName;
	path: CoreSplitPath;
}): CanonicalizedFile | QuarantinedFile {
	const decoded = decodeBasename(path.basename);

	if (!decoded) {
		return {
			currentPath: path,
			destination: quarantinePath({ path, rootName }),
			reason: "undecodable",
		};
	}

	return computeCanonicalPath({
		authority: "folder",
		currentPath: path,
		decoded,
		folderPath: path.pathParts.slice(1),
		rootName,
	});
}

export function isCanonical(
	path: CoreSplitPath,
	canonical: CoreSplitPath,
): boolean {
	// Case-insensitive compare to avoid unnecessary renames on macOS
	return (
		path.basename.toLowerCase() === canonical.basename.toLowerCase() &&
		path.pathParts.join("/").toLowerCase() ===
			canonical.pathParts.join("/").toLowerCase()
	);
}
