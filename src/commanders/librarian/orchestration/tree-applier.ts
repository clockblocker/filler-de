import type { TFile } from "obsidian";
import { TFolder } from "obsidian";
import type { SplitPath } from "../../../obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { collectImpactedSections } from "../codex";
import type { LibraryTree } from "../library-tree";
import { translateVaultAction } from "../reconciliation";
import type { CoreNameChainFromRoot } from "../types/split-basename";

export type TreeApplierContext = {
	getTRef: (path: string) => TFile | null;
	libraryRoot: string;
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
		| CoreNameChainFromRoot
		| [CoreNameChainFromRoot, CoreNameChainFromRoot]
	> = [];

	for (const action of actions) {
		const treeAction = translateVaultAction(action, {
			getTRef: context.getTRef,
			libraryRoot: context.libraryRoot,
		});

		if (treeAction) {
			const result = context.tree.applyTreeAction(treeAction);
			actionResults.push(result);
		}
	}

	return collectImpactedSections(actionResults);
}

/**
 * Get TFile ref for a path via vaultActionManager.
 * Pure function that takes context.
 */
export function getTRefForPath(
	path: string,
	splitPath: (path: string) => SplitPath,
	getApp: () => {
		vault: {
			getAbstractFileByPath: (p: string) => unknown;
		};
	} | null,
): TFile | null {
	try {
		const sp = splitPath(path);
		if (sp.type === SplitPathType.Folder) {
			return null;
		}
		// getAbstractFile is async, but we need sync access
		// Use Obsidian's vault.getAbstractFileByPath directly
		const app = getApp();
		if (!app) {
			return null;
		}
		const file = app.vault?.getAbstractFileByPath?.(path);
		return file instanceof TFolder ? null : (file as TFile | null);
	} catch {
		return null;
	}
}

