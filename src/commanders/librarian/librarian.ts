import { getParsedUserSettings } from "../../global-state/global-state";
import type {
	ObsidianVaultActionManager,
	VaultEvent,
} from "../../obsidian-vault-action-manager";
import type { VaultAction } from "../../obsidian-vault-action-manager/types/vault-action";
import { logger } from "../../utils/logger";
import {
	dedupeChains,
	expandAllToAncestors,
	flattenActionResult,
} from "./codex/impacted-chains";
import { healOnInit, type InitHealResult } from "./healing";
import type { LibraryTree } from "./library-tree";
import type { CoreNameChainFromRoot } from "./naming/parsed-basename";
import {
	type CodexRegeneratorContext,
	type EventHandlerContext,
	handleCreate,
	handleDelete,
	handleRename,
	parseEventToHandler,
	readTreeFromSplitFilesWithReaders,
	regenerateAllCodexes,
	regenerateCodexes,
	writeStatusToMetadata,
} from "./orchestration";
import { TreeActionType } from "./types/literals";
import { TreeNodeStatus, TreeNodeType } from "./types/tree-node";
import { buildCanonicalPathForLeafDeprecated } from "./utils/tree-path-utils";

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

		let allFiles: Awaited<
			ReturnType<typeof this.vaultActionManager.listAllFilesWithMdReaders>
		>;
		try {
			allFiles =
				await this.vaultActionManager.listAllFilesWithMdReaders(
					rootSplitPath,
				);
		} catch (error) {
			logger.error(
				"[Librarian] Failed to list files from vault:",
				error instanceof Error ? error.message : String(error),
			);
			return { deleteActions: [], renameActions: [] };
		}

		try {
			this.tree = await readTreeFromSplitFilesWithReaders({
				files: allFiles,
				splitPathToLibraryRoot: rootSplitPath,
			});
		} catch (error) {
			logger.error(
				"[Librarian] Failed to read tree from vault:",
				error instanceof Error ? error.message : String(error),
			);
			// Return empty result if tree can't be read
			return { deleteActions: [], renameActions: [] };
		}

		const leaves = this.tree.serializeToLeaves();

		// Heal using actual files from manager
		const healResult = await healOnInit(leaves, allFiles);

		if (healResult.renameActions.length > 0) {
			await this.vaultActionManager.dispatch(healResult.renameActions);
		}

		// Re-read tree from vault to ensure it's up-to-date (after healing or if no healing)
		this.tree = await this.readTreeFromVault();

		// Regenerate all codexes with up-to-date tree
		await regenerateAllCodexes(this.tree, this.getCodexContext());

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
	 * Get codex regeneration context.
	 */
	private getCodexContext(): CodexRegeneratorContext {
		return {
			dispatch: (actions) => this.vaultActionManager.dispatch(actions),
			getNode: (chain) => {
				const node = this.tree.getSectionNode(chain);
				return node;
			},
			listAllFilesWithMdReaders: (sp) =>
				this.vaultActionManager.listAllFilesWithMdReaders(sp),
			splitPath: (p) => this.vaultActionManager.splitPath(p),
		};
	}

	/**
	 * Get event handler context.
	 */
	private getEventHandlerContext(): EventHandlerContext {
		return {
			dispatch: (actions) => this.vaultActionManager.dispatch(actions),
			getNode: (chain) => {
				return this.tree.getSectionNode(chain);
			},
			listAllFilesWithMdReaders: (sp) =>
				this.vaultActionManager.listAllFilesWithMdReaders(sp),
			readTree: () => this.readTreeFromVault(),
			setTree: (tree) => {
				this.tree = tree;
			},
			splitPath: (p) => this.vaultActionManager.splitPath(p),
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
		coreNameChain: CoreNameChainFromRoot,
		status: TreeNodeStatus,
	): Promise<void> {
		const newStatus =
			status === TreeNodeStatus.Done
				? TreeNodeStatus.Done
				: TreeNodeStatus.NotStarted;

		// Get node before updating (to access tRef for Scroll nodes)
		const node = this.tree.getNode(coreNameChain);

		const impactedChain = this.tree.applyTreeAction({
			payload: { coreNameChain, newStatus },
			type: TreeActionType.ChangeNodeStatus,
		});

		// Write metadata to file if this is a Scroll node
		if (node?.type === TreeNodeType.Scroll) {
			// Build canonical path from tree structure
			const path = buildCanonicalPathForLeafDeprecated(node);

			try {
				await writeStatusToMetadata(path, status, {
					dispatch: (actions) =>
						this.vaultActionManager.dispatch(actions),
					readContent: (sp) => {
						if (sp.type === "MdFile") {
							return this.vaultActionManager.readContent(sp);
						}
						return Promise.resolve("");
					},
					splitPath: (p) => this.vaultActionManager.splitPath(p),
				});
			} catch (error) {
				logger.error(
					"[Librarian] setStatus: failed to write metadata:",
					error instanceof Error ? error.message : String(error),
				);
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

		await regenerateCodexes(impactedSections, this.getCodexContext());
	}

	/**
	 * Read tree from existing vault.
	 * Lists all files in the library root and builds a LibraryTree.
	 */
	async readTreeFromVault(): Promise<LibraryTree> {
		const settings = getParsedUserSettings();
		const libraryRoot = settings.splitPathToLibraryRoot.basename;
		const rootSplitPath = this.vaultActionManager.splitPath(libraryRoot);
		if (rootSplitPath.type !== "Folder") {
			throw new Error(`Library root is not a folder: ${libraryRoot}`);
		}

		const files =
			await this.vaultActionManager.listAllFilesWithMdReaders(
				rootSplitPath,
			);

		return readTreeFromSplitFilesWithReaders({
			files,
			splitPathToLibraryRoot: rootSplitPath,
		});
	}

	// Note: getTRefForPath removed - tRefs are no longer stored in tree nodes
}
