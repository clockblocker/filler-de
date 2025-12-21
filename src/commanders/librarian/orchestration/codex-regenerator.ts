import { getParsedUserSettings } from "../../../global-state/global-state";
import type { SplitPathToFolder } from "../../../obsidian-vault-action-manager/types/split-path";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../../obsidian-vault-action-manager/types/vault-action";
import { VaultActionType } from "../../../obsidian-vault-action-manager/types/vault-action";
import { logger } from "../../../utils/logger";
import type { LibraryTree } from "../library-tree";
import type { CoreNameChainFromRoot } from "../types/split-basename";
import type { SectionNode } from "../types/tree-node";
import { TreeNodeType } from "../types/tree-node";
import { buildCodexBasename, isCodexBasename } from "../utils/codex-utils";
import { buildCodexVaultActions } from "./codex-builder";
import { collectAllSectionChains } from "./tree-utils";

export type CodexRegeneratorContext = {
	dispatch: (
		actions: import("../../../obsidian-vault-action-manager/types/vault-action").VaultAction[],
	) => Promise<unknown>;
	getNode: (chain: CoreNameChainFromRoot) => SectionNode | null;
	listAllFilesWithMdReaders?: (
		splitPath: import("../../../obsidian-vault-action-manager/types/split-path").SplitPathToFolder,
	) => Promise<
		import("../../../obsidian-vault-action-manager/types/split-path").SplitPathWithReader[]
	>;
	splitPath?: (path: string) => import("../../../obsidian-vault-action-manager/types/split-path").SplitPath;
};

/**
 * Regenerate codexes for impacted sections and dispatch.
 * Pure function that takes tree and context.
 */
export async function regenerateCodexes(
	impactedChains: CoreNameChainFromRoot[],
	context: CodexRegeneratorContext,
): Promise<void> {
	logger.info(
		"[regenerateCodexes] impactedChains:",
		JSON.stringify(impactedChains),
	);
	if (impactedChains.length === 0) {
		logger.info("[regenerateCodexes] no chains to regenerate");
		return;
	}

	// Filter out chains that don't point to sections (only sections have codexes)
	const sectionChains = impactedChains.filter((chain) => {
		const node = context.getNode(chain);
		return node !== null; // getNode returns null for non-sections
	});

	logger.info(
		"[regenerateCodexes] filtered to section chains:",
		JSON.stringify(sectionChains),
	);

	if (sectionChains.length === 0) {
		logger.info("[regenerateCodexes] no section chains to regenerate");
		return;
	}

	try {
		const codexActions = buildCodexVaultActions(
			sectionChains,
			context.getNode,
		);

		logger.info(
			"[regenerateCodexes] created actions:",
			String(codexActions.length),
			"actions",
		);

		if (codexActions.length > 0) {
			logger.info(
				"[regenerateCodexes] dispatching actions:",
				JSON.stringify(
					codexActions.map((a) => ({
						type: a.type,
						pathParts: a.payload.splitPath.pathParts,
						basename: a.payload.splitPath.basename,
						contentLength: a.payload.content.length,
					})),
				),
			);
			await context.dispatch(codexActions);
			logger.info("[regenerateCodexes] actions dispatched");
		} else {
			logger.info("[regenerateCodexes] no actions to dispatch");
		}

		// Cleanup orphaned codex files (e.g., from folder renames)
		if (context.listAllFilesWithMdReaders && context.splitPath) {
			logger.info(
				"[regenerateCodexes] starting cleanup for",
				String(sectionChains.length),
				"sections",
			);
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
	_sectionChains: CoreNameChainFromRoot[],
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
	logger.info(
		"[cleanupOrphanedCodexes] scanning",
		String(allFiles.length),
		"files in library",
	);

	// Extract section chain from pathParts (remove library root)
	const libraryRootBasename = settings.splitPathToLibraryRoot.basename;

	for (const file of allFiles) {
		if (file.type !== SplitPathType.MdFile || !isCodexBasename(file.basename)) {
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
		const sectionChain: CoreNameChainFromRoot = file.pathParts.slice(
			rootIndex + 1,
		);

		// Get section node
		const node = context.getNode(sectionChain);
		if (!node || node.type !== TreeNodeType.Section) {
			logger.info(
				"[cleanupOrphanedCodexes] codex in non-existent section, deleting:",
				JSON.stringify({
					sectionChain,
					basename: file.basename,
				}),
			);
			deleteActions.push({
				payload: { splitPath: file },
				type: VaultActionType.TrashMdFile,
			});
			continue;
		}

		// Build expected codex basename (same logic as buildCodexVaultActions)
		const section = node as SectionNode;
		const sectionName =
			sectionChain.length === 0
				? settings.splitPathToLibraryRoot.basename
				: section.coreName;
		const coreCodexName = buildCodexBasename(sectionName);
		const suffix =
			sectionChain.length > 0
				? sectionChain
						.slice(0, -1) // Parent chain (exclude self)
						.reverse()
						.join(settings.suffixDelimiter)
				: "";
		const expectedCodexBasename = suffix
			? `${coreCodexName}${settings.suffixDelimiter}${suffix}`
			: coreCodexName;

		// Check if codex name matches expected
		if (file.basename !== expectedCodexBasename) {
			logger.info(
				"[cleanupOrphanedCodexes] deleting orphaned codex:",
				JSON.stringify({
					sectionChain,
					expected: expectedCodexBasename,
					actual: file.basename,
				}),
			);
			deleteActions.push({
				payload: { splitPath: file },
				type: VaultActionType.TrashMdFile,
			});
		}
	}

	if (deleteActions.length > 0) {
		logger.info(
			"[cleanupOrphanedCodexes] deleting",
			String(deleteActions.length),
			"orphaned codex files",
		);
		await context.dispatch(deleteActions);
	} else {
		logger.info("[cleanupOrphanedCodexes] no orphaned codexes found");
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
	logger.info(
		"[regenerateAllCodexes] collected section chains:",
		JSON.stringify(allSectionChains),
	);
	await regenerateCodexes(allSectionChains, context);
}
