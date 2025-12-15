import type { LegacyFullPath } from "../../../services/obsidian-services/atomic-services/pathfinder";
import type { PrettyPathLegacy } from "../../../types/common-interface/dtos";
import { isRootNameLegacy, type RootNameLegacy } from "../constants";
import {
	toNodeNameLegacy,
	treePathToCodexBasename,
	treePathToPageBasenameLegacy,
	treePathToScrollBasename,
} from "../indexing/codecs";
import { canonicalizePrettyPathLegacy } from "../invariants/path-canonicalizer";
import type { TreePathLegacyLegacy } from "../types";

function isBookPage(segment: string | undefined): boolean {
	return !!segment && /^\d{3}$/.test(segment);
}

export function treePathToPrettyPathLegacy(
	treePath: TreePathLegacyLegacy,
	rootName: RootNameLegacy,
): PrettyPathLegacy {
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
			basename: treePathToPageBasenameLegacy.encode(treePath),
			pathParts,
		};
	}

	return {
		basename: treePathToScrollBasename.encode(treePath),
		pathParts,
	};
}

export function prettyPathToTreePathLegacyLegacy(
	prettyPath: PrettyPathLegacy,
): TreePathLegacyLegacy {
	const rootName = prettyPath.pathParts[0];

	if (rootName && isRootNameLegacy(rootName)) {
		const canonical = canonicalizePrettyPathLegacy({
			prettyPath,
			rootName,
		});
		if ("reason" in canonical) {
			const sanitized = [
				...prettyPath.pathParts.slice(1),
				toNodeNameLegacy(prettyPath.basename),
			];
			return sanitized;
		}
		return canonical.treePath;
	}

	return [
		...prettyPath.pathParts
			.slice(1)
			.map((segment) => toNodeNameLegacy(segment)),
		toNodeNameLegacy(prettyPath.basename),
	];
}

export function fullPathToTreePathLegacyLegacy(
	fullPath: LegacyFullPath,
): TreePathLegacyLegacy {
	const prettyPath: PrettyPathLegacy = {
		basename: toNodeNameLegacy(fullPath.basename),
		pathParts: fullPath.pathParts,
	};

	return prettyPathToTreePathLegacyLegacy(prettyPath);
}
