import { getParsedUserSettings } from "../../global-state/global-state";
import type {
	ObsidianVaultActionManager,
	VaultEvent,
} from "../../obsidian-vault-action-manager";
import type { SplitPath } from "../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../obsidian-vault-action-manager/types/vault-action";
import { logger } from "../../utils/logger";
import {
	dedupeChains,
	expandAllToAncestors,
	flattenActionResult,
} from "./codex/impacted-chains";
import { healOnInit, type InitHealResult } from "./healing";
import type { LibraryTree } from "./library-tree";
import {
	buildActionsForCodexRegenerationInImpactedSections,
	buildWriteStatusToMetadataAction,
	type EventHandlerContext,
	handleCreate,
	handleDelete,
	handleRename,
	parseEventToHandler,
	readTreeFromSplitFilesWithReaders,
} from "./orchestration";
import { collectAllSectionChains } from "./orchestration/tree-utils";
import { TreeActionType } from "./types/literals";
import type { NodeNameChain } from "./types/schemas/node-name";
import { TreeNodeStatus, TreeNodeType } from "./types/tree-node";
import { buildCanonicalPathForLeaf } from "./utils/tree-path-utils";

export class Librarian {
	private tree: LibraryTree;
	/** Track paths we're currently processing to avoid self-event loops */
	private eventTeardown: (() => void) | null = null;

	constructor(
		private readonly vaultActionManager: ObsidianVaultActionManager,
	) {}

	/**
	 * Initialize librarian: read tree and heal mismatches.
	 * Mode 2: Path is king, suffix-only renames.
	 */
	async init(): Promise<InitHealResult> {
		const settings = getParsedUserSettings();
		const rootSplitPath = settings.splitPathToLibraryRoot;

		const allFilesResult =
			await this.vaultActionManager.listAllFilesWithMdReaders(
				rootSplitPath,
			);

		if (allFilesResult.isErr()) {
			logger.error(
				"[Librarian] Failed to list files from vault:",
				allFilesResult.error,
			);
			return { deleteActions: [], renameActions: [] };
		}
		const allFiles = allFilesResult.value;

		const treeResult = await readTreeFromSplitFilesWithReaders({
			files: allFiles,
			splitPathToLibraryRoot: rootSplitPath,
		});

		if (treeResult.isErr()) {
			logger.error(
				"[Librarian] Failed to read tree from vault:",
				treeResult.error,
			);
			// Return empty result if tree can't be read
			return { deleteActions: [], renameActions: [] };
		}
		this.tree = treeResult.value;

		const leaves = this.tree.serializeToLeaves();

		// Heal using actual files from manager
		const healResult = await healOnInit(leaves, allFiles);

		if (healResult.renameActions.length > 0) {
			await this.vaultActionManager.dispatch(healResult.renameActions);
		}

		// Re-read tree from vault to ensure it's up-to-date (after healing or if no healing)
		this.tree = await this.readTreeFromVault();

		// Regenerate all codexes with up-to-date tree
		const allSectionChains = collectAllSectionChains(this.tree);
		const allFilesForCodexResult =
			await this.vaultActionManager.listAllFilesWithMdReaders(
				rootSplitPath,
			);

		if (allFilesForCodexResult.isErr()) {
			return healResult;
		}

		const splitPathsToFiles = allFilesForCodexResult.value as SplitPath[];
		const actions = buildActionsForCodexRegenerationInImpactedSections(
			allSectionChains,
			splitPathsToFiles,
			(chain) => this.tree.getSectionNode(chain),
		);
		await this.vaultActionManager.dispatch(actions);

		// Subscribe to vault events after initialization
		this.subscribeToVaultEvents();

		return healResult;
	}

	/**
	 * Note: testTRefStaleness removed - tRefs are no longer stored in tree nodes.
	 * TFile references become stale when files are renamed/moved, so they're resolved on-demand.
	 */

	/**
	 * Subscribe to file system events from VaultActionManager.
	 * Converts VaultEvent to librarian handler calls.
	 */
	private subscribeToVaultEvents(): void {
		this.eventTeardown = this.vaultActionManager.subscribe(
			async (event: VaultEvent) => {
				logger.debug("event", JSON.stringify({ type: event.type }));
				const handlerInfo = parseEventToHandler(event);
				if (!handlerInfo) {
					return;
				}

				const eventContext = this.getEventHandlerContext();
				if (
					handlerInfo.type === "rename" &&
					handlerInfo.oldPath &&
					handlerInfo.newPath
				) {
					await handleRename(
						handlerInfo.oldPath,
						handlerInfo.newPath,
						handlerInfo.isFolder,
						eventContext,
					);
				} else if (handlerInfo.type === "create") {
					if (!handlerInfo.isFolder) {
						await handleCreate(
							handlerInfo.path,
							false,
							eventContext,
						);
					}
					// Folders don't need healing, skip
				} else if (handlerInfo.type === "delete") {
					await handleDelete(
						handlerInfo.path,
						handlerInfo.isFolder,
						eventContext,
					);
				}
			},
		);
	}

	/**
	 * Cleanup: unsubscribe from vault events.
	 */
	unsubscribeFromVaultEvents(): void {
		if (this.eventTeardown) {
			this.eventTeardown();
			this.eventTeardown = null;
		}
	}

	/**
	 * Get event handler context.
	 */
	private getEventHandlerContext(): EventHandlerContext {
		return {
			dispatch: (actions) => this.vaultActionManager.dispatch(actions),
			getSectionNode: (chain) => {
				return this.tree.getSectionNode(chain);
			},
			listAllFilesWithMdReaders: (sp) =>
				this.vaultActionManager.listAllFilesWithMdReaders(sp),
			readTree: () => this.readTreeFromVault(),
			setTree: (tree) => {
				this.tree = tree;
			},
			splitPath: (p) => this.vaultActionManager.makeSplitPath(p),
			tree: this.tree,
		};
	}

	/**
	 * Get current tree (null if not initialized).
	 */
	getTree(): LibraryTree | null {
		return this.tree;
	}

	/**
	 * Test helper: Handle rename event.
	 * Exposed for e2e tests.
	 */
	async handleRename(
		oldPath: string,
		newPath: string,
		isFolder: boolean,
	): Promise<VaultAction[]> {
		const eventContext = this.getEventHandlerContext();
		return handleRename(oldPath, newPath, isFolder, eventContext);
	}

	/**
	 * Test helper: Handle create event.
	 * Exposed for e2e tests.
	 */
	async handleCreate(
		path: string,
		isFolder: boolean,
	): Promise<VaultAction[]> {
		const eventContext = this.getEventHandlerContext();
		return handleCreate(path, isFolder, eventContext);
	}

	/**
	 * Test helper: Handle delete event.
	 * Exposed for e2e tests.
	 */
	async handleDelete(path: string, isFolder: boolean): Promise<void> {
		const eventContext = this.getEventHandlerContext();
		return handleDelete(path, isFolder, eventContext);
	}

	/**
	 * Set status for a node (scroll or section).
	 * Updates tree, writes metadata to file (for Scroll nodes), and regenerates impacted codexes.
	 */
	async setStatus(
		nodeNameChain: NodeNameChain,
		status: TreeNodeStatus,
	): Promise<void> {
		const newStatus =
			status === TreeNodeStatus.Done
				? TreeNodeStatus.Done
				: TreeNodeStatus.NotStarted;

		// Get node before updating (to access tRef for Scroll nodes)
		const node = this.tree.getNode(nodeNameChain);

		const impactedChain = this.tree.applyTreeAction({
			payload: { newStatus, nodeNameChain },
			type: TreeActionType.ChangeNodeStatus,
		});

		// Write metadata to file if this is a Scroll node
		if (node?.type === TreeNodeType.Scroll) {
			// Build canonical path from tree structure
			const path = buildCanonicalPathForLeaf(node);
			const splitPath = this.vaultActionManager.makeSplitPath(path);

			if (splitPath.type === "MdFile") {
				const actions = [
					buildWriteStatusToMetadataAction(splitPath, status),
				].filter(Boolean) as VaultAction[];

				await this.vaultActionManager.dispatch(actions);
			}
		}

		// Expand to ancestors for codex regeneration
		// ChangeNodeStatus always returns single chain, but use flattenActionResult for type safety
		const chains = flattenActionResult(impactedChain);
		const impactedSections = dedupeChains(expandAllToAncestors(chains));

		logger.debug("[Librarian] setStatus: chains:", JSON.stringify(chains));
		logger.debug(
			"[Librarian] setStatus: impactedSections:",
			JSON.stringify(impactedSections),
		);

		const settings = getParsedUserSettings();
		const allFilesForCodexResult =
			await this.vaultActionManager.listAllFilesWithMdReaders(
				settings.splitPathToLibraryRoot,
			);
		if (allFilesForCodexResult.isErr()) {
			return;
		}
		const splitPathsToFiles = allFilesForCodexResult.value as SplitPath[];
		const actions = buildActionsForCodexRegenerationInImpactedSections(
			impactedSections,
			splitPathsToFiles,
			(chain) => this.tree.getSectionNode(chain),
		);
		await this.vaultActionManager.dispatch(actions);
	}

	/**
	 * Read tree from existing vault.
	 * Lists all files in the library root and builds a LibraryTree.
	 */
	async readTreeFromVault(): Promise<LibraryTree> {
		const settings = getParsedUserSettings();
		const libraryRoot = settings.splitPathToLibraryRoot.basename;
		const rootSplitPath = this.vaultActionManager.makeSplitPath(libraryRoot);
		if (rootSplitPath.type !== "Folder") {
			throw new Error(`Library root is not a folder: ${libraryRoot}`);
		}

		const filesResult =
			await this.vaultActionManager.listAllFilesWithMdReaders(
				rootSplitPath,
			);
		if (filesResult.isErr()) {
			throw new Error(`Failed to list files: ${filesResult.error}`);
		}

		const treeResult = await readTreeFromSplitFilesWithReaders({
			files: filesResult.value,
			splitPathToLibraryRoot: rootSplitPath,
		});
		if (treeResult.isErr()) {
			throw new Error(`Failed to read tree: ${treeResult.error}`);
		}
		return treeResult.value;
	}

	// Note: getTRefForPath removed - tRefs are no longer stored in tree nodes
}
