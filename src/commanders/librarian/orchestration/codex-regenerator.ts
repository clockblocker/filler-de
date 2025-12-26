import { getParsedUserSettings } from "../../../global-state/global-state";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { VaultActionType } from "../../../obsidian-vault-action-manager/types/vault-action";
import { logger } from "../../../utils/logger";
import type { LibraryTree } from "../library-tree";
import type { NodeNameChain } from "../naming/parsed-basename";
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

	// Extract section chain from pathParts (remove library root)
	const libraryRootBasename = settings.splitPathToLibraryRoot.basename;

	for (const file of allFiles) {
		if (
			file.type !== SplitPathType.MdFile ||
			!isBasenamePrefixedAsCodexDeprecated(file.basename)
		) {
			continue;
		}

		// Extract section chain from file pathParts
		// pathParts = [libraryRoot, ...sectionChain] or [..., libraryRoot, ...sectionChain]
		const rootIndex = file.pathParts.findIndex(
			(part) => part === libraryRootBasename,
		);

		if (rootIndex === -1) {
			logger.warn(
				"[cleanupOrphanedCodexes] codex file outside library root:",
				JSON.stringify(file.pathParts),
			);
			continue;
		}

		// Section chain is everything after library root
		// Codex file is IN the section folder, so section chain = pathParts after root
		const sectionChain: NodeNameChain = file.pathParts.slice(rootIndex + 1);

		// Get section node
		const node = context.getNode(sectionChain);
		if (!node || node.type !== TreeNodeType.Section) {
			deleteActions.push({
				payload: { splitPath: file },
				type: VaultActionType.TrashMdFile,
			});
			continue;
		}

		// Build expected codex basename (same logic as buildCodexVaultActions)
		const section = node as SectionNode;
		const expectedCodexBasename = addCodexPrefixDeprecated(section);

		// Check if codex name matches expected
		if (file.basename !== expectedCodexBasename) {
			deleteActions.push({
				payload: { splitPath: file },
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
