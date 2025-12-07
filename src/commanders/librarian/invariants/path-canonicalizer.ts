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

type DecodedBasename = {
	kind: CanonicalFileKind;
	treePath: TreePath;
};

function decodeBasename(basename: string): DecodedBasename | null {
	if (CodexBaseameSchema.safeParse(basename).success) {
		return {
			kind: "codex",
			treePath: treePathToCodexBasename.decode(basename),
		};
	}

	if (PageBasenameSchema.safeParse(basename).success) {
		return {
			kind: "page",
			treePath: treePathToPageBasename.decode(basename),
		};
	}

	if (ScrollBasenameSchema.safeParse(basename).success) {
		return {
			kind: "scroll",
			treePath: treePathToScrollBasename.decode(basename),
		};
	}

	return null;
}

function sanitizeSegments(segments: readonly string[]): string[] {
	return segments.map((segment) => toNodeName(segment));
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

	const folderPath = sanitizeSegments(prettyPath.pathParts.slice(1));

	if (decoded.kind === "codex") {
		const decodedPath =
			decoded.treePath.length === 1 && decoded.treePath[0] === rootName
				? []
				: sanitizeSegments(decoded.treePath);
		const useFolderPath =
			decodedPath.length > 0 &&
			folderPath.length > 0 &&
			folderPath[folderPath.length - 1] ===
				decodedPath[decodedPath.length - 1];
		const sectionPath = useFolderPath ? folderPath : decodedPath;

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
			currentPrettyPath: prettyPath,
			kind: decoded.kind,
			treePath,
		};
	}

	if (decoded.kind === "page") {
		const decodedParent = sanitizeSegments(decoded.treePath.slice(0, -1));
		const pageNumber =
			decoded.treePath[decoded.treePath.length - 1] ?? "000";

		const parentPath =
			decodedParent.length > 0 && arraysEqual(decodedParent, folderPath)
				? decodedParent
				: folderPath.slice();

		const treePath: TreePath = [...parentPath, pageNumber];

		const canonicalPrettyPath: PrettyPath = {
			basename: treePathToPageBasename.encode(treePath),
			pathParts: [rootName, ...parentPath],
		};

		return {
			canonicalPrettyPath,
			currentPrettyPath: prettyPath,
			kind: decoded.kind,
			treePath,
		};
	}

	const decodedParent = sanitizeSegments(decoded.treePath.slice(0, -1));
	const name = toNodeName(
		decoded.treePath[decoded.treePath.length - 1] ?? "",
	);
	const parentPath =
		decodedParent.length > 0 && arraysEqual(decodedParent, folderPath)
			? decodedParent
			: folderPath.slice();

	const treePath: TreePath = [...parentPath, name];

	const canonicalPrettyPath: PrettyPath = {
		basename: treePathToScrollBasename.encode(treePath),
		pathParts: [rootName, ...parentPath],
	};

	return {
		canonicalPrettyPath,
		currentPrettyPath: prettyPath,
		kind: decoded.kind,
		treePath,
	};
}

export function isCanonical(
	prettyPath: PrettyPath,
	canonical: PrettyPath,
): boolean {
	return (
		prettyPath.basename === canonical.basename &&
		prettyPath.pathParts.join("/") === canonical.pathParts.join("/")
	);
}
