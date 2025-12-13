import type { LegacyFullPath } from "../../../services/obsidian-services/atomic-services/pathfinder";
import type { PrettyPath } from "../../../types/common-interface/dtos";
import { isRootName, type RootName } from "../constants";
import {
	toNodeName,
	treePathToCodexBasename,
	treePathToPageBasename,
	treePathToScrollBasename,
} from "../indexing/codecs";
import { canonicalizePrettyPath } from "../invariants/path-canonicalizer";
import type { TreePath } from "../types";

function isBookPage(segment: string | undefined): boolean {
	return !!segment && /^\d{3}$/.test(segment);
}

export function treePathToPrettyPath(
	treePath: TreePath,
	rootName: RootName,
): PrettyPath {
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

export function prettyPathToTreePath(prettyPath: PrettyPath): TreePath {
	const rootName = prettyPath.pathParts[0];

	if (rootName && isRootName(rootName)) {
		const canonical = canonicalizePrettyPath({ prettyPath, rootName });
		if ("reason" in canonical) {
			const sanitized = [
				...prettyPath.pathParts.slice(1),
				toNodeName(prettyPath.basename),
			];
			return sanitized;
		}
		return canonical.treePath;
	}

	return [
		...prettyPath.pathParts.slice(1).map((segment) => toNodeName(segment)),
		toNodeName(prettyPath.basename),
	];
}

export function fullPathToTreePath(fullPath: LegacyFullPath): TreePath {
	const prettyPath: PrettyPath = {
		basename: toNodeName(fullPath.basename),
		pathParts: fullPath.pathParts,
	};

	return prettyPathToTreePath(prettyPath);
}
