import { getParsedUserSettings } from "../../../global-state/global-state";
import type { LibraryTree } from "../library-tree";
import type { NodeNameChain } from "../types/schemas/node-name";
import type { SectionNode } from "../types/tree-node";
import { TreeNodeType } from "../types/tree-node";

/**
 * Collect chains for all sections in tree (including root).
 * Pure function that takes tree and returns all section chains.
 * Chains include library root.
 */
export function collectAllSectionChains(tree: LibraryTree): NodeNameChain[] {
	const {
		splitPathToLibraryRoot: { basename: libraryRoot },
	} = getParsedUserSettings();
	const chains: NodeNameChain[] = [[libraryRoot]]; // Start with root library

	const collectRecursive = (
		node: SectionNode,
		currentChain: NodeNameChain,
	) => {
		for (const child of node.children) {
			if (child.type === TreeNodeType.Section) {
				const childChain = [...currentChain, child.nodeName];
				chains.push(childChain);
				collectRecursive(child, childChain);
			}
		}
	};

	const root = tree.getNode([]);
	if (root && root.type === TreeNodeType.Section) {
		collectRecursive(root, [libraryRoot]);
	}

	return chains;
}
