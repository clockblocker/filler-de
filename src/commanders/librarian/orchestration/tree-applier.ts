import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { collectImpactedSections } from "../codex";
import type { LibraryTree } from "../library-tree";
import { translateVaultAction } from "../reconciliation";
import type { CoreNameChainFromRoot } from "../types/split-basename";

export type TreeApplierContext = {
	libraryRoot: string;
	suffixDelimiter?: string;
	tree: LibraryTree;
};

/**
 * Apply VaultActions to tree and collect impacted chains.
 * Pure function that takes tree and actions, returns impacted chains.
 */
export function applyActionsToTree(
	actions: VaultAction[],
	context: TreeApplierContext,
): CoreNameChainFromRoot[] {
	const actionResults: Array<
		CoreNameChainFromRoot | [CoreNameChainFromRoot, CoreNameChainFromRoot]
	> = [];

	for (const action of actions) {
		const treeAction = translateVaultAction(action, {
			libraryRoot: context.libraryRoot,
			suffixDelimiter: context.suffixDelimiter,
		});

		if (treeAction) {
			const result = context.tree.applyTreeAction(treeAction);
			actionResults.push(result);
		}
	}

	// Note: tRef removed - TFile references become stale when files are renamed/moved

	return collectImpactedSections(actionResults);
}

// Note: getTRefForPath removed - tRefs are no longer stored in tree nodes
