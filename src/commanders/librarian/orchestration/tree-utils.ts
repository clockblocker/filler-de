import type { LibraryTree } from "../library-tree";
import type { CoreNameChainFromRoot } from "../naming/parsed-basename";
import type { SectionNode } from "../types/tree-node";
import { TreeNodeType } from "../types/tree-node";

/**
 * Collect chains for all sections in tree (including root).
 * Pure function that takes tree and returns all section chains.
 */
export function collectAllSectionChains(
	tree: LibraryTree,
): CoreNameChainFromRoot[] {
	const chains: CoreNameChainFromRoot[] = [[]]; // Start with root

	const collectRecursive = (
		node: SectionNode,
		currentChain: CoreNameChainFromRoot,
	) => {
		for (const child of node.children) {
			if (child.type === TreeNodeType.Section) {
				const childChain = [...currentChain, child.coreName];
				chains.push(childChain);
				collectRecursive(child, childChain);
			}
		}
	};

	const root = tree.getNode([]);
	if (root && root.type === TreeNodeType.Section) {
		collectRecursive(root, []);
	}

	return chains;
}
