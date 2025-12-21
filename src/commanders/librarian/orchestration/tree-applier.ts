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

	const typesStr = actions.map((a) => String(a.type)).join(", ");
	console.log(
		`[TreeStalenessTest] applyActionsToTree: count=${String(actions.length)} types=[${typesStr}]`,
	);

	// Note: tRef removed - TFile references become stale when files are renamed/moved

	for (const action of actions) {
		const treeAction = translateVaultAction(action, {
			libraryRoot: context.libraryRoot,
			suffixDelimiter: context.suffixDelimiter,
		});

		const vaultActionType = String(action.type);
		const treeActionType = treeAction ? String(treeAction.type) : "null";
		console.log(
			`[TreeStalenessTest] translateVaultAction: vaultAction=${vaultActionType} → treeAction=${treeActionType}`,
		);

		if (treeAction) {
			console.log(
				`[TreeStalenessTest] calling applyTreeAction: type=${treeAction.type}`,
			);
			const result = context.tree.applyTreeAction(treeAction);
			const resultStr =
				typeof result === "string"
					? result
					: `[${result[0]}, ${result[1]}]`;
			console.log(
				`[TreeStalenessTest] applyTreeAction returned: ${resultStr}`,
			);
			actionResults.push(result);
		} else {
			console.log(
				"[TreeStalenessTest] treeAction is null, skipping applyTreeAction",
			);
		}
	}

	// Note: tRef removed - TFile references become stale when files are renamed/moved

	return collectImpactedSections(actionResults);
}

// Note: getTRefForPath removed - tRefs are no longer stored in tree nodes
