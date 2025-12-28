import { getParsedUserSettings } from "../../../global-state/global-state";
import { makeSystemPathForSplitPath } from "../../../obsidian-vault-action-manager/impl/split-path";
import { makeJoinedSuffixedBasenameFromNodeNameChain } from "../naming/functions/basename-and-chain";
import { buildCanonicalSplitPathFromNode } from "../naming/functions/split-path-and-leaf";
import type { FileNode, ScrollNode, TreeLeaf } from "../types/tree-node";
import { TreeNodeType } from "../types/tree-node";

export function joinPathParts(parts: string[]): string {
	return parts.filter(Boolean).join("/");
}

export function buildCanonicalPathForLeaf(leaf: TreeLeaf): string {
	const settings = getParsedUserSettings();
	const splitPath =
		leaf.type === TreeNodeType.Scroll
			? buildCanonicalSplitPathFromNode(leaf as ScrollNode)
			: buildCanonicalSplitPathFromNode(leaf as FileNode);

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

export function buildCanonicalBasenameForLeaf(leaf: TreeLeaf): string {
	const fullChain = [...leaf.nodeNameChainToParent, leaf.nodeName];
	return makeJoinedSuffixedBasenameFromNodeNameChain(fullChain);
}
