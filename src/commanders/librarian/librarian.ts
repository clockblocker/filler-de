import type {
	ObsidianVaultActionManager,
	VaultEvent,
} from "../../obsidian-vault-action-manager";
import { dedupeChains, expandToAncestors } from "./codex/impacted-chains";
import { healOnInit, type InitHealResult } from "./healing";
import type { LibraryTree } from "./library-tree";
import {
	applyActionsToTree,
	type CodexRegeneratorContext,
	type EventHandlerContext,
	handleCreate,
	handleDelete,
	handleRename,
	parseEventToHandler,
	readTreeFromVault,
	regenerateAllCodexes,
	regenerateCodexes,
	writeStatusToMetadata,
} from "./orchestration";
import { TreeActionType } from "./types/literals";
import type { CoreNameChainFromRoot } from "./types/split-basename";
import { TreeNodeStatus, TreeNodeType } from "./types/tree-node";
import { buildCanonicalBasename } from "./utils/path-suffix-utils";

export class Librarian {
	private tree: LibraryTree | null = null;
	/** Track paths we're currently processing to avoid self-event loops */
	private eventTeardown: (() => void) | null = null;

	constructor(
		private readonly vaultActionManager: ObsidianVaultActionManager,
		private readonly libraryRoot: string,
		private readonly suffixDelimiter: string = "-",
	) {}

	/**
	 * Initialize librarian: read tree and heal mismatches.
	 * Mode 2: Path is king, suffix-only renames.
	 */
	async init(): Promise<InitHealResult> {
		try {
			this.tree = await this.readTreeFromVault();
			console.log(
				"[Librarian] Tree initialized successfully, leaves:",
				this.tree.serializeToLeaves().length,
			);
		} catch (error) {
			console.error("[Librarian] Failed to read tree from vault:", error);
			this.tree = null;
			// Return empty result if tree can't be read
			return { deleteActions: [], renameActions: [] };
		}

		if (!this.tree) {
			console.error("[Librarian] Tree is null after readTreeFromVault");
			return { deleteActions: [], renameActions: [] };
		}

		const leaves = this.tree.serializeToLeaves();

		// Get current basename from path (tRef removed - resolve on-demand)
		const getCurrentBasename = (path: string): string | null => {
			const file = (
				this.vaultActionManager as unknown as {
					app?: {
						vault?: {
							getAbstractFileByPath?: (p: string) => unknown;
						};
					};
				}
			).app?.vault?.getAbstractFileByPath?.(path);
			if (
				file &&
				typeof file === "object" &&
				file !== null &&
				"basename" in file
			) {
				return (file as { basename: string }).basename;
			}
			return null;
		};

		const healResult = healOnInit(
			leaves,
			this.libraryRoot,
			this.suffixDelimiter,
			getCurrentBasename,
		);

		if (healResult.renameActions.length > 0) {
			await this.vaultActionManager.dispatch(healResult.renameActions);

			// Apply to tree and collect impacted chains
			if (this.tree) {
				const impactedChains = applyActionsToTree(
					healResult.renameActions,
					{
						libraryRoot: this.libraryRoot,
						suffixDelimiter: this.suffixDelimiter,
						tree: this.tree,
					},
				);
				console.log(
					"[Librarian] init impacted chains:",
					impactedChains,
				);

				// Regenerate codexes for impacted sections
				await regenerateCodexes(impactedChains, this.getCodexContext());
			}
		} else {
			// No healing needed, but still regenerate all codexes
			if (this.tree) {
				await regenerateAllCodexes(this.tree, this.getCodexContext());
			}
		}

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
				console.log("event", event);
				const handlerInfo = parseEventToHandler(
					event,
					this.libraryRoot,
				);
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
				if (!this.tree) return null;
				const node = this.tree.getNode(chain);
				return node?.type === TreeNodeType.Section ? node : null;
			},
			libraryRoot: this.libraryRoot,
			suffixDelimiter: this.suffixDelimiter,
		};
	}

	/**
	 * Get event handler context.
	 */
	private getEventHandlerContext(): EventHandlerContext {
		return {
			dispatch: (actions) => this.vaultActionManager.dispatch(actions),
			getNode: (chain) => {
				if (!this.tree) return null;
				const node = this.tree.getNode(chain);
				return node?.type === TreeNodeType.Section ? node : null;
			},
			libraryRoot: this.libraryRoot,
			listAll: (sp) => this.vaultActionManager.listAll(sp),
			readTree: () => this.readTreeFromVault(),
			setTree: (tree) => {
				this.tree = tree;
			},
			splitPath: (p) => this.vaultActionManager.splitPath(p),
			suffixDelimiter: this.suffixDelimiter,
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
	 * Set status for a node (scroll or section).
	 * Updates tree, writes metadata to file (for Scroll nodes), and regenerates impacted codexes.
	 */
	async setStatus(
		coreNameChain: CoreNameChainFromRoot,
		status: TreeNodeStatus,
	): Promise<void> {
		if (!this.tree) {
			console.warn(
				"[Librarian] setStatus called before init, attempting to reinitialize...",
			);
			try {
				await this.init();
				if (!this.tree) {
					console.error(
						"[Librarian] Failed to initialize tree in setStatus",
					);
					return;
				}
			} catch (error) {
				console.error(
					"[Librarian] Error reinitializing tree in setStatus:",
					error,
				);
				return;
			}
		}

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
			// Reconstruct canonical basename from tree structure (suffix = reversed path chain)
			const canonicalBasename = buildCanonicalBasename(
				node.coreName,
				node.coreNameChainToParent,
				this.suffixDelimiter,
			);
			// Build full path: libraryRoot + pathChain + canonicalBasename + extension
			const pathChain =
				node.coreNameChainToParent.length > 0
					? `${node.coreNameChainToParent.join("/")}/`
					: "";
			const path = `${this.libraryRoot}/${pathChain}${canonicalBasename}.${node.extension}`;

			console.log(
				`[TreeStalenessTest] writeStatusToMetadata: chain=${coreNameChain.join("/")} status=${status} canonicalBasename=${canonicalBasename} path=${path}`,
			);

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
				console.error(
					"[Librarian] setStatus: failed to write metadata:",
					error,
				);
			}
		}

		// Expand to ancestors for codex regeneration
		// impactedChain is the parent chain (CoreNameChainFromRoot)
		// ChangeNodeStatus always returns single chain, never tuple
		const baseChain = impactedChain as CoreNameChainFromRoot;
		const impactedSections = dedupeChains(expandToAncestors(baseChain));

		await regenerateCodexes(impactedSections, this.getCodexContext());
	}

	/**
	 * Read tree from existing vault.
	 * Lists all files in the library root and builds a LibraryTree.
	 */
	async readTreeFromVault(): Promise<LibraryTree> {
		return readTreeFromVault(this.libraryRoot, this.suffixDelimiter, {
			getAbstractFile: (sp) =>
				this.vaultActionManager.getAbstractFile(sp),
			listAll: (sp) => this.vaultActionManager.listAll(sp),
			readContent: (sp) => this.vaultActionManager.readContent(sp),
			splitPath: (p) => this.vaultActionManager.splitPath(p),
		});
	}

	// Note: getTRefForPath removed - tRefs are no longer stored in tree nodes
}
