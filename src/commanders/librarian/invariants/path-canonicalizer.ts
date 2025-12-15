import type { PrettyPathLegacy } from "../../../types/common-interface/dtos";
import type { RootNameLegacy } from "../constants";
import { UNTRACKED_FOLDER_NAME } from "../constants";
import {
	CodexBaseameSchemaLegacy,
	PageBasenameLegacySchemaLegacy,
	ScrollBasenameSchemaLegacy,
	toNodeNameLegacy,
	treePathToCodexBasename,
	treePathToPageBasenameLegacy,
	treePathToScrollBasename,
} from "../indexing/codecs";

import type { TreePathLegacyLegacy } from "../types";

export type CanonicalFileKindLegacy = "scroll" | "page" | "codex";

export type CanonicalizedFileLegacy = {
	canonicalPrettyPathLegacy: PrettyPathLegacy;
	currentPrettyPathLegacy: PrettyPathLegacy;
	kind: CanonicalFileKindLegacy;
	treePath: TreePathLegacyLegacy;
};

export type QuarantinedFileLegacy = {
	currentPrettyPathLegacy: PrettyPathLegacy;
	destination: PrettyPathLegacy;
	reason: "undecodable";
};

export type DecodedBasenameLegacy = {
	kind: CanonicalFileKindLegacy;
	treePath: TreePathLegacyLegacy;
};

export function decodeBasenameLegacy(
	basename: string,
): DecodedBasenameLegacy | null {
	const codexResult = CodexBaseameSchemaLegacy.safeParse(basename);
	if (codexResult.success) {
		return {
			kind: "codex",
			treePath: treePathToCodexBasename.decode(codexResult.data),
		};
	}

	const pageResult = PageBasenameLegacySchemaLegacy.safeParse(basename);
	if (pageResult.success) {
		return {
			kind: "page",
			treePath: treePathToPageBasenameLegacy.decode(pageResult.data),
		};
	}

	const scrollResult = ScrollBasenameSchemaLegacy.safeParse(basename);
	if (scrollResult.success) {
		return {
			kind: "scroll",
			treePath: treePathToScrollBasename.decode(scrollResult.data),
		};
	}

	return null;
}

function sanitizeSegments(segments: readonly string[]): string[] {
	return segments.map((segment) => toNodeNameLegacy(segment));
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
	prettyPath: PrettyPathLegacy;
	rootName: RootNameLegacy;
}): PrettyPathLegacy {
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
	currentPrettyPathLegacy,
}: {
	authority: Authority;
	decoded: DecodedBasenameLegacy;
	folderPath: string[];
	rootName: RootNameLegacy;
	currentPrettyPathLegacy: PrettyPathLegacy;
}): CanonicalizedFileLegacy {
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

		const canonicalPrettyPathLegacy: PrettyPathLegacy = {
			basename:
				sectionPath.length === 0
					? treePathToCodexBasename.encode([rootName])
					: treePathToCodexBasename.encode(sectionPath),
			pathParts: [rootName, ...sectionPath],
		};

		const treePath: TreePathLegacyLegacy =
			sectionPath.length === 0 ? [rootName] : sectionPath;

		return {
			canonicalPrettyPathLegacy,
			currentPrettyPathLegacy,
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

		const treePath: TreePathLegacyLegacy = [...parentPath, pageNumber];

		const canonicalPrettyPathLegacy: PrettyPathLegacy = {
			basename: treePathToPageBasenameLegacy.encode(treePath),
			pathParts: [rootName, ...parentPath],
		};

		return {
			canonicalPrettyPathLegacy,
			currentPrettyPathLegacy,
			kind: decoded.kind,
			treePath,
		};
	}

	const decodedParent = decodedPath.slice(0, -1);
	const name = toNodeNameLegacy(decodedPath[decodedPath.length - 1] ?? "");
	const parentPath =
		authority === "folder"
			? stripRedundantSuffix(
					decodedParent.length > 0 &&
						arraysEqual(decodedParent, sanitizedFolderPath)
						? decodedParent
						: sanitizedFolderPath.slice(),
				)
			: stripRedundantSuffix(decodedParent);

	const treePath: TreePathLegacyLegacy = [...parentPath, name];

	const canonicalPrettyPathLegacy: PrettyPathLegacy = {
		basename: treePathToScrollBasename.encode(treePath),
		pathParts: [rootName, ...parentPath],
	};

	return {
		canonicalPrettyPathLegacy,
		currentPrettyPathLegacy,
		kind: decoded.kind,
		treePath,
	};
}

export function canonicalizePrettyPathLegacy({
	rootName,
	prettyPath,
}: {
	rootName: RootNameLegacy;
	prettyPath: PrettyPathLegacy;
}): CanonicalizedFileLegacy | QuarantinedFileLegacy {
	const decoded = decodeBasenameLegacy(prettyPath.basename);

	if (!decoded) {
		return {
			currentPrettyPathLegacy: prettyPath,
			destination: quarantinePath({ prettyPath, rootName }),
			reason: "undecodable",
		};
	}

	return computeCanonicalPath({
		authority: "folder",
		currentPrettyPathLegacy: prettyPath,
		decoded,
		folderPath: prettyPath.pathParts.slice(1),
		rootName,
	});
}

export function isCanonical(
	prettyPath: PrettyPathLegacy,
	canonical: PrettyPathLegacy,
): boolean {
	// Case-insensitive compare to avoid unnecessary renames on macOS
	return (
		prettyPath.basename.toLowerCase() ===
			canonical.basename.toLowerCase() &&
		prettyPath.pathParts.join("/").toLowerCase() ===
			canonical.pathParts.join("/").toLowerCase()
	);
}
