import type { LibraryTree } from "../library-tree";
import type { CoreNameChainFromRoot } from "../types/split-basename";
import type { SectionNode } from "../types/tree-node";
import { TreeNodeType } from "../types/tree-node";
import { buildCodexVaultActions } from "./codex-builder";
import { collectAllSectionChains } from "./tree-utils";

export type CodexRegeneratorContext = {
	dispatch: (actions: import("../../../obsidian-vault-action-manager/types/vault-action").VaultAction[]) => Promise<unknown>;
	getNode: (chain: CoreNameChainFromRoot) => SectionNode | null;
	libraryRoot: string;
	suffixDelimiter: string;
};

/**
 * Regenerate codexes for impacted sections and dispatch.
 * Pure function that takes tree and context.
 */
export async function regenerateCodexes(
	impactedChains: CoreNameChainFromRoot[],
	context: CodexRegeneratorContext,
): Promise<void> {
	if (impactedChains.length === 0) {
		return;
	}

	try {
		const codexActions = buildCodexVaultActions(
			impactedChains,
			context.getNode,
			{
				libraryRoot: context.libraryRoot,
				suffixDelimiter: context.suffixDelimiter,
			},
		);

		if (codexActions.length > 0) {
			await context.dispatch(codexActions);
		}
	} catch (error) {
		console.error("[Librarian] codex regeneration failed:", error);
		// Don't throw - codex failure shouldn't break main healing flow
	}
}

/**
 * Regenerate codexes for ALL sections in tree.
 */
export async function regenerateAllCodexes(
	tree: LibraryTree,
	context: CodexRegeneratorContext,
): Promise<void> {
	const allSectionChains = collectAllSectionChains(tree);
	await regenerateCodexes(allSectionChains, context);
}

