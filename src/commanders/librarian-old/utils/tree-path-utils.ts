import { getParsedUserSettings } from "../../../global-state/global-state";
import { makeSystemPathForSplitPath } from "../../../obsidian-vault-action-manager/impl/common/split-path-and-system-path";
import { makeJoinedSuffixedBasenameFromNodeNameChain } from "../naming/functions/basename-and-chain";
import { buildCanonicalSplitPathFromNode } from "../naming/functions/split-path-and-leaf";
import type {
	FileNodeDeprecated,
	ScrollNodeDeprecated,
	TreeLeafDeprecated,
} from "../types/tree-node";
import { TreeNodeTypeDeprecated } from "../types/tree-node";

export function joinPathParts(parts: string[]): string {
	return parts.filter(Boolean).join("/");
}

export function buildCanonicalPathForLeaf(leaf: TreeLeafDeprecated): string {
	const settings = getParsedUserSettings();
	const splitPath =
		leaf.type === TreeNodeTypeDeprecated.Scroll
			? buildCanonicalSplitPathFromNode(leaf as ScrollNodeDeprecated)
			: buildCanonicalSplitPathFromNode(leaf as FileNodeDeprecated);

	// If library root has path parts, prepend them to the file's path parts
	if (settings.splitPathToLibraryRoot.pathParts.length > 0) {
		const splitPathWithLibraryRoot = {
			...splitPath,
			pathParts: [
				...settings.splitPathToLibraryRoot.pathParts,
				...splitPath.pathParts,
			],
		};
		return makeSystemPathForSplitPath(splitPathWithLibraryRoot);
	}

	return makeSystemPathForSplitPath(splitPath);
}

export function buildCanonicalBasenameForLeaf(
	leaf: TreeLeafDeprecated,
): string {
	const fullChain = [...leaf.nodeNameChainToParent, leaf.nodeName];
	return makeJoinedSuffixedBasenameFromNodeNameChain(fullChain);
}
