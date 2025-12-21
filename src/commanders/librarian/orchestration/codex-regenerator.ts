import { getParsedUserSettings } from "../../../global-state/global-state";
import { makeSystemPathForSplitPath } from "../../../obsidian-vault-action-manager/impl/split-path";
import type { LibraryTree } from "../library-tree";
import type { CoreNameChainFromRoot } from "../types/split-basename";
import type { SectionNode } from "../types/tree-node";
import { buildCodexVaultActions } from "./codex-builder";
import { collectAllSectionChains } from "./tree-utils";

export type CodexRegeneratorContext = {
	dispatch: (
		actions: import("../../../obsidian-vault-action-manager/types/vault-action").VaultAction[],
	) => Promise<unknown>;
	getNode: (chain: CoreNameChainFromRoot) => SectionNode | null;
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
		console.log("[Librarian] regenerateCodexes: no impacted chains");
		return;
	}

	console.log("[Librarian] regenerateCodexes: impacted chains:", impactedChains);

	try {
		const codexActions = buildCodexVaultActions(
			impactedChains,
			context.getNode,
		);

		console.log("[Librarian] regenerateCodexes: codexActions:", codexActions.length);
		console.log("[Librarian] regenerateCodexes: codexActions details:", codexActions.map(a => ({
			type: a.type,
			path: a.payload.splitPath ? makeSystemPathForSplitPath(a.payload.splitPath) : 'N/A',
		})));

		if (codexActions.length > 0) {
			const result = await context.dispatch(codexActions);
			console.log("[Librarian] regenerateCodexes: dispatch result:", result);
		} else {
			console.log("[Librarian] regenerateCodexes: no actions to dispatch");
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
