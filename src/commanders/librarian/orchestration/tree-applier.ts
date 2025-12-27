import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { collectImpactedSections } from "../codex";
import type { LibraryTree } from "../library-tree";
import type { NodeNameChain } from "../naming/types/node-name";
import { translateVaultAction } from "../reconciliation";

export type TreeApplierContext = {
	tree: LibraryTree;
};

/**
 * Apply VaultActions to tree and collect impacted chains.
 * Pure function that takes tree and actions, returns impacted chains.
 * Reads libraryRoot and suffixDelimiter from global settings.
 */
export function applyActionsToTree(
	actions: VaultAction[],
	context: TreeApplierContext,
): NodeNameChain[] {
	const actionResults: Array<NodeNameChain | [NodeNameChain, NodeNameChain]> =
		[];

	for (const action of actions) {
		const treeAction = translateVaultAction(action);

		if (treeAction) {
			const result = context.tree.applyTreeAction(treeAction);
			actionResults.push(result);
		}
	}

	// Note: tRef removed - TFile references become stale when files are renamed/moved

	const impacted = collectImpactedSections(actionResults);
	return impacted;
}

// Note: getTRefForPath removed - tRefs are no longer stored in tree nodes
