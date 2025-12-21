import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { logger } from "../../../utils/logger";
import { collectImpactedSections } from "../codex";
import type { LibraryTree } from "../library-tree";
import { translateVaultAction } from "../reconciliation";
import type { CoreNameChainFromRoot } from "../types/split-basename";

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
): CoreNameChainFromRoot[] {
	const actionResults: Array<
		CoreNameChainFromRoot | [CoreNameChainFromRoot, CoreNameChainFromRoot]
	> = [];

	for (const action of actions) {
		const treeAction = translateVaultAction(action, {});

		if (treeAction) {
			const result = context.tree.applyTreeAction(treeAction);
			logger.info(
				"[applyActionsToTree] treeAction:",
				JSON.stringify({ type: treeAction.type }),
				"result:",
				JSON.stringify(result),
			);
			actionResults.push(result);
		}
	}

	// Note: tRef removed - TFile references become stale when files are renamed/moved

	const impacted = collectImpactedSections(actionResults);
	logger.info(
		"[applyActionsToTree] collected impacted sections:",
		JSON.stringify(impacted),
	);
	return impacted;
}

// Note: getTRefForPath removed - tRefs are no longer stored in tree nodes
