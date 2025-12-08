import type { PrettyPath } from "../../../types/common-interface/dtos";
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
	canonicalPrettyPath: PrettyPath;
	currentPrettyPath: PrettyPath;
	kind: CanonicalFileKind;
	treePath: TreePath;
};

export type QuarantinedFile = {
	currentPrettyPath: PrettyPath;
	destination: PrettyPath;
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
	prettyPath,
	rootName,
}: {
	prettyPath: PrettyPath;
	rootName: RootName;
}): PrettyPath {
	const folderPath = prettyPath.pathParts.slice(1);

	return {
		basename: prettyPath.basename,
		pathParts: [rootName, UNTRACKED_FOLDER_NAME, ...folderPath],
	};
}

export type Authority = "folder" | "basename";

export function computeCanonicalPath({
	authority,
	decoded,
	folderPath,
	rootName,
	currentPrettyPath,
}: {
	authority: Authority;
	decoded: DecodedBasename;
	folderPath: string[];
	rootName: RootName;
	currentPrettyPath: PrettyPath;
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

		const canonicalPrettyPath: PrettyPath = {
			basename:
				sectionPath.length === 0
					? treePathToCodexBasename.encode([rootName])
					: treePathToCodexBasename.encode(sectionPath),
			pathParts: [rootName, ...sectionPath],
		};

		const treePath: TreePath =
			sectionPath.length === 0 ? [rootName] : sectionPath;

		return {
			canonicalPrettyPath,
			currentPrettyPath,
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

		const canonicalPrettyPath: PrettyPath = {
			basename: treePathToPageBasename.encode(treePath),
			pathParts: [rootName, ...parentPath],
		};

		return {
			canonicalPrettyPath,
			currentPrettyPath,
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

	const canonicalPrettyPath: PrettyPath = {
		basename: treePathToScrollBasename.encode(treePath),
		pathParts: [rootName, ...parentPath],
	};

	return {
		canonicalPrettyPath,
		currentPrettyPath,
		kind: decoded.kind,
		treePath,
	};
}

export function canonicalizePrettyPath({
	rootName,
	prettyPath,
}: {
	rootName: RootName;
	prettyPath: PrettyPath;
}): CanonicalizedFile | QuarantinedFile {
	const decoded = decodeBasename(prettyPath.basename);

	if (!decoded) {
		return {
			currentPrettyPath: prettyPath,
			destination: quarantinePath({ prettyPath, rootName }),
			reason: "undecodable",
		};
	}

	return computeCanonicalPath({
		authority: "folder",
		currentPrettyPath: prettyPath,
		decoded,
		folderPath: prettyPath.pathParts.slice(1),
		rootName,
	});
}

export function isCanonical(
	prettyPath: PrettyPath,
	canonical: PrettyPath,
): boolean {
	// Case-insensitive compare to avoid unnecessary renames on macOS
	return (
		prettyPath.basename.toLowerCase() ===
			canonical.basename.toLowerCase() &&
		prettyPath.pathParts.join("/").toLowerCase() ===
			canonical.pathParts.join("/").toLowerCase()
	);
}
