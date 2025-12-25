import { getParsedUserSettings } from "../../../global-state/global-state";
import { makeSystemPathForSplitPath } from "../../../obsidian-vault-action-manager/impl/split-path";
import type { TreeLeaf } from "../types/tree-node";
import { buildCanonicalBasenameDeprecated } from "./path-suffix-utils";

/** @deprecated */
export function joinPathPartsDeprecated(parts: string[]): string {
	return parts.filter(Boolean).join("/");
}

/** @deprecated */
export function buildCanonicalPathForLeafDeprecated(leaf: TreeLeaf): string {
	const settings = getParsedUserSettings();
	const libraryRootPath = makeSystemPathForSplitPath(
		settings.splitPathToLibraryRoot,
	);

	const canonicalBasename = buildCanonicalBasenameDeprecated(
		leaf.coreName,
		leaf.coreNameChainToParent,
	);

	const pathChain =
		leaf.coreNameChainToParent.length > 0
			? `${joinPathPartsDeprecated(leaf.coreNameChainToParent)}/`
			: "";
	return `${libraryRootPath}/${pathChain}${canonicalBasename}.${leaf.extension}`;
}

/** @deprecated */
export function buildCanonicalBasenameForLeafDeprecated(
	leaf: TreeLeaf,
): string {
	return buildCanonicalBasenameDeprecated(
		leaf.coreName,
		leaf.coreNameChainToParent,
	);
}
