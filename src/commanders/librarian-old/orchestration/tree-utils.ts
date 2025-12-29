import { getParsedUserSettings } from "../../../global-state/global-state";
import type { LibraryTreeDeprecated } from "../library-tree";
import type { NodeNameChainDeprecated } from "../types/schemas/node-name";
import type { SectionNodeDeprecated } from "../types/tree-node";
import { TreeNodeTypeDeprecated } from "../types/tree-node";

/**
 * Collect chains for all sections in tree (including root).
 * Pure function that takes tree and returns all section chains.
 * Chains include library root.
 */
export function collectAllSectionChains(
	tree: LibraryTreeDeprecated,
): NodeNameChainDeprecated[] {
	const {
		splitPathToLibraryRoot: { basename: libraryRoot },
	} = getParsedUserSettings();
	const chains: NodeNameChainDeprecated[] = [[libraryRoot]]; // Start with root library

	const collectRecursive = (
		node: SectionNodeDeprecated,
		currentChain: NodeNameChainDeprecated,
	) => {
		for (const child of node.children) {
			if (child.type === TreeNodeTypeDeprecated.Section) {
				const childChain = [...currentChain, child.nodeName];
				chains.push(childChain);
				collectRecursive(child, childChain);
			}
		}
	};

	const root = tree.getNode([]);
	if (root && root.type === TreeNodeTypeDeprecated.Section) {
		collectRecursive(root, [libraryRoot]);
	}

	return chains;
}
