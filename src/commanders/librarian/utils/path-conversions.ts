import { splitPath } from "../../../obsidian-vault-action-manager";
import type {
	CoreSplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../obsidian-vault-action-manager/types/split-path";
import type { FullPath } from "../../../services/obsidian-services/atomic-services/pathfinder";
import { isRootName, type RootName } from "../constants";
import {
	toNodeName,
	treePathToCodexBasename,
	treePathToPageBasename,
	treePathToScrollBasename,
} from "../indexing/codecs";
import { canonicalizePath } from "../invariants/path-canonicalizer";
import type { TreePath } from "../types";

function isBookPage(segment: string | undefined): boolean {
	return !!segment && /^\d{3}$/.test(segment);
}

export function treePathToCorePath(
	treePath: TreePath,
	rootName: RootName,
): CoreSplitPath {
	if (treePath.length === 0) {
		return {
			basename: treePathToCodexBasename.encode([rootName]),
			pathParts: [rootName],
		};
	}

	const parentParts = treePath.slice(0, -1);
	const leaf = treePath[treePath.length - 1] ?? "";
	const pathParts = [rootName, ...parentParts];

	if (isBookPage(leaf)) {
		return {
			basename: treePathToPageBasename.encode(treePath),
			pathParts,
		};
	}

	return {
		basename: treePathToScrollBasename.encode(treePath),
		pathParts,
	};
}

export function corePathToTreePath(path: CoreSplitPath): TreePath {
	const rootName = path.pathParts[0];

	if (rootName && isRootName(rootName)) {
		const canonical = canonicalizePath({ path, rootName });
		if ("reason" in canonical) {
			const sanitized = [
				...path.pathParts.slice(1),
				toNodeName(path.basename),
			];
			return sanitized;
		}
		return canonical.treePath;
	}

	return [
		...path.pathParts.slice(1).map((segment) => toNodeName(segment)),
		toNodeName(path.basename),
	];
}

export function fullPathToTreePath(fullPath: FullPath): TreePath {
	const path: CoreSplitPath = {
		basename: toNodeName(fullPath.basename),
		pathParts: fullPath.pathParts,
	};

	return corePathToTreePath(path);
}

export function corePathToFolder(path: CoreSplitPath): SplitPathToFolder {
	const raw = [...path.pathParts, path.basename].filter(Boolean).join("/");
	return splitPath(raw) as SplitPathToFolder;
}

export function corePathToMdFile(path: CoreSplitPath): SplitPathToMdFile {
	const raw = [...path.pathParts, path.basename].filter(Boolean).join("/");
	return splitPath(`${raw}.md`) as SplitPathToMdFile;
}
