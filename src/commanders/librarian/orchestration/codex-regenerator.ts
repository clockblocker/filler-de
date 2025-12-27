import { getParsedUserSettings } from "../../../global-state/global-state";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { VaultActionType } from "../../../obsidian-vault-action-manager/types/vault-action";
import { logger } from "../../../utils/logger";
import type { LibraryTree } from "../library-tree";
import { makeNodeNameChainFromPathParts } from "../naming/codecs/atomic/path-parts-and-node-name-chain";
import {
	buildCanonicalBasenameForCodex,
	tryParseJoinedSuffixedBasenameForCodex,
} from "../naming/codecs/codexes/interface";
import type { NodeNameChain } from "../naming/types/node-name";
import type { SectionNode } from "../types/tree-node";
import { TreeNodeType } from "../types/tree-node";
import {
	addCodexPrefixDeprecated,
	isBasenamePrefixedAsCodexDeprecated,
} from "../utils/codex-utils";
import { buildCodexVaultActions } from "./codex-builder";
import { collectAllSectionChains } from "./tree-utils";

export type CodexRegeneratorContext = {
	dispatch: (
		actions: import("../../../obsidian-vault-action-manager/types/vault-action").VaultAction[],
	) => Promise<unknown>;
	getNode: (chain: NodeNameChain) => SectionNode | null;
	listAllFilesWithMdReaders?: (
		splitPath: import("../../../obsidian-vault-action-manager/types/split-path").SplitPathToFolder,
	) => Promise<
		import("../../../obsidian-vault-action-manager/types/split-path").SplitPathWithReader[]
	>;
	splitPath?: (
		path: string,
	) => import("../../../obsidian-vault-action-manager/types/split-path").SplitPath;
};

/**
 * Regenerate codexes for impacted sections and dispatch.
 * Pure function that takes tree and context.
 */
export async function regenerateCodexes(
	impactedChains: NodeNameChain[],
	context: CodexRegeneratorContext,
): Promise<void> {
	if (impactedChains.length === 0) {
		return;
	}

	// Filter out chains that don't point to sections (only sections have codexes)
	const sectionChains = impactedChains.filter((chain) => {
		const node = context.getNode(chain);
		return node !== null; // getNode returns null for non-sections
	});

	if (sectionChains.length === 0) {
		return;
	}

	try {
		const codexActions = buildCodexVaultActions(
			sectionChains,
			context.getNode,
		);

		if (codexActions.length > 0) {
			await context.dispatch(codexActions);
		}

		// Cleanup orphaned codex files (e.g., from folder renames)
		if (context.listAllFilesWithMdReaders && context.splitPath) {
			await cleanupOrphanedCodexes(sectionChains, context);
		} else {
			logger.warn(
				"[regenerateCodexes] cleanup skipped - missing listAllFilesWithMdReaders or splitPath",
			);
		}
	} catch (error) {
		logger.error(
			"[Librarian] codex regeneration failed:",
			error instanceof Error ? error.message : String(error),
		);
		// Don't throw - codex failure shouldn't break main healing flow
	}
}

/**
 * Cleanup orphaned codex files in the entire library.
 * Scans all files recursively and deletes any `__` files that aren't valid codexes.
 */
async function cleanupOrphanedCodexes(
	_sectionChains: NodeNameChain[],
	context: CodexRegeneratorContext,
): Promise<void> {
	if (!context.listAllFilesWithMdReaders || !context.splitPath) {
		return;
	}

	const settings = getParsedUserSettings();
	const deleteActions: VaultAction[] = [];

	// Get all files recursively from library root
	const allFiles = await context.listAllFilesWithMdReaders(
		settings.splitPathToLibraryRoot,
	);

	for (const file of allFiles) {
		if (
			file.type !== SplitPathType.MdFile ||
			tryParseJoinedSuffixedBasenameForCodex(file.basename).isErr()
		) {
			continue;
		}

		const splitPathToCodex = file;

		const nodeNameChainToParent = makeNodeNameChainFromPathParts(
			splitPathToCodex.pathParts,
		);
		const parentSectionNode = context.getNode(nodeNameChainToParent);

		if (
			!parentSectionNode ||
			parentSectionNode.type !== TreeNodeType.Section
		) {
			deleteActions.push({
				payload: { splitPath: splitPathToCodex },
				type: VaultActionType.TrashMdFile,
			});
			continue;
		}

		const canonicalBasenameForCodex = buildCanonicalBasenameForCodex(
			nodeNameChainToParent,
		);

		if (file.basename !== canonicalBasenameForCodex) {
			deleteActions.push({
				payload: { splitPath: splitPathToCodex },
				type: VaultActionType.TrashMdFile,
			});
		}
	}

	if (deleteActions.length > 0) {
		await context.dispatch(deleteActions);
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
