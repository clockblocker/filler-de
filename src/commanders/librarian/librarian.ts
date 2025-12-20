import type { TFile } from "obsidian";
import { TFolder } from "obsidian";
import type {
	ObsidianVaultActionManager,
	VaultEvent,
} from "../../obsidian-vault-action-manager";
import { SplitPathType } from "../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../obsidian-vault-action-manager/types/vault-action";
import { collectImpactedSections } from "./codex";
import { detectRenameMode, healOnInit, type InitHealResult } from "./healing";
import type { LibraryTree } from "./library-tree";
import {
	buildCodexVaultActions,
	buildWriteStatusAction,
	collectAllSectionChains,
	computeCreateAction,
	extractBasenameWithoutExt,
	parseDeletePathToChain,
	parseEventToHandler,
	readTreeFromVault,
	resolveActions,
	shouldIgnorePath,
} from "./orchestration";
import { translateVaultAction } from "./reconciliation";
import { TreeActionType } from "./types/literals";
import type { CoreNameChainFromRoot } from "./types/split-basename";
import {
	type SectionNode,
	TreeNodeStatus,
	TreeNodeType,
} from "./types/tree-node";
import { isCodexBasename } from "./utils/codex-utils";

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
		} catch (error) {
			console.error("[Librarian] Failed to read tree from vault:", error);
			// Return empty result if tree can't be read
			return { deleteActions: [], renameActions: [] };
		}

		const leaves = this.tree.serializeToLeaves();

		const healResult = healOnInit(
			leaves,
			this.libraryRoot,
			this.suffixDelimiter,
		);

		if (healResult.renameActions.length > 0) {
			await this.vaultActionManager.dispatch(healResult.renameActions);

			// Apply to tree and collect impacted chains
			const impactedChains = this.applyActionsToTree(
				healResult.renameActions,
			);
			console.log("[Librarian] init impacted chains:", impactedChains);

			// Regenerate codexes for impacted sections
			await this.regenerateCodexes(impactedChains);
		} else {
			// No healing needed, but still regenerate all codexes
			await this.regenerateAllCodexes();
		}

		// Subscribe to vault events after initialization
		this.subscribeToVaultEvents();

		return healResult;
	}

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

				if (
					handlerInfo.type === "rename" &&
					handlerInfo.oldPath &&
					handlerInfo.newPath
				) {
					await this.handleRename(
						handlerInfo.oldPath,
						handlerInfo.newPath,
						handlerInfo.isFolder,
					);
				} else if (handlerInfo.type === "create") {
					if (!handlerInfo.isFolder) {
						await this.handleCreate(handlerInfo.path, false);
					}
					// Folders don't need healing, skip
				} else if (handlerInfo.type === "delete") {
					await this.handleDelete(
						handlerInfo.path,
						handlerInfo.isFolder,
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
	 * Regenerate codexes for ALL sections in tree.
	 * Used on init when no healing needed.
	 */
	private async regenerateAllCodexes(): Promise<void> {
		if (!this.tree) {
			return;
		}

		// Collect all section chains
		const allSectionChains = collectAllSectionChains(this.tree);

		await this.regenerateCodexes(allSectionChains);
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
			console.warn("[Librarian] setStatus called before init");
			return;
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
			try {
				await this.writeStatusToMetadata(node.tRef, status);
			} catch (error) {
				console.error(
					"[Librarian] setStatus: failed to write metadata:",
					error,
				);
			}
		} else {
		}

		// Expand to ancestors for codex regeneration
		const { expandToAncestors, dedupeChains } = await import(
			"./codex/impacted-chains"
		);

		// impactedChain is the parent chain (CoreNameChainFromRoot)
		// ChangeNodeStatus always returns single chain, never tuple
		const baseChain = impactedChain as CoreNameChainFromRoot;
		const impactedSections = dedupeChains(expandToAncestors(baseChain));

		await this.regenerateCodexes(impactedSections);
	}

	/**
	 * Write status to metadata in file.
	 */
	private async writeStatusToMetadata(
		tFile: TFile,
		status: TreeNodeStatus,
	): Promise<void> {
		const splitPath = this.vaultActionManager.splitPath(tFile);
		if (splitPath.type !== SplitPathType.MdFile) {
			return;
		}

		const currentContent =
			await this.vaultActionManager.readContent(splitPath);

		const action = buildWriteStatusAction(
			currentContent,
			splitPath,
			status,
		);

		if (!action) {
			return;
		}

		const result = await this.vaultActionManager.dispatch([action]);

		if (result.isErr()) {
			const errors = result.error;
			console.error(
				"[Librarian] writeStatusToMetadata: dispatch errors:",
				errors,
			);
			throw new Error(
				`Failed to write metadata: ${errors.map((e) => e.error).join(", ")}`,
			);
		}

		console.log("[Librarian] writeStatusToMetadata: success");
	}

	/**
	 * Handle delete event from vault.
	 * Removes node from tree and regenerates impacted codexes.
	 */
	async handleDelete(path: string, isFolder: boolean): Promise<void> {
		// Skip codex files
		const basenameWithoutExt = extractBasenameWithoutExt(path);
		if (
			shouldIgnorePath(
				path,
				basenameWithoutExt,
				this.libraryRoot,
				isCodexBasename,
			)
		) {
			return;
		}

		if (!this.tree) {
			return;
		}

		// Parse path to get coreNameChain
		const coreNameChain = parseDeletePathToChain(
			path,
			isFolder,
			this.libraryRoot,
			this.suffixDelimiter,
		);

		if (!coreNameChain) {
			return;
		}

		const impactedChain = this.tree.applyTreeAction({
			payload: { coreNameChain },
			type: TreeActionType.DeleteNode,
		});

		const { expandToAncestors, dedupeChains } = await import(
			"./codex/impacted-chains"
		);
		const impactedSections = dedupeChains(
			expandToAncestors(impactedChain as CoreNameChainFromRoot),
		);

		await this.regenerateCodexes(impactedSections);
	}

	/**
	 * Handle a rename event from vault.
	 * Detects mode and generates appropriate healing actions.
	 */
	async handleRename(
		oldPath: string,
		newPath: string,
		isFolder: boolean,
	): Promise<VaultAction[]> {
		const mode = detectRenameMode(
			{ isFolder, newPath, oldPath },
			this.libraryRoot,
		);

		if (!mode) {
			return [];
		}

		// Init mode is handled separately, skip here
		if (mode.mode === "Init") {
			return [];
		}

		const actions = await resolveActions(
			mode as
				| {
						mode: "Runtime";
						subtype: "BasenameOnly" | "PathOnly" | "Both";
				  }
				| { mode: "DragIn"; subtype: "File" | "Folder" },
			oldPath,
			newPath,
			isFolder,
			{
				listAll: (sp) => this.vaultActionManager.listAll(sp),
				splitPath: (p) => this.vaultActionManager.splitPath(p),
			},
			this.libraryRoot,
			this.suffixDelimiter,
		);

		const actionArray = Array.isArray(actions) ? actions : await actions;

		if (actionArray.length > 0) {
			try {
				await this.vaultActionManager.dispatch(actionArray);
				const impactedChains = this.applyActionsToTree(actionArray);
				await this.regenerateCodexes(impactedChains);
			} finally {
			}
		} else {
			// No healing needed, but still update tree and codexes for user's rename
			await this.updateTreeAndCodexesForRename(newPath);
		}

		return actionArray;
	}

	/**
	 * Update tree and regenerate codexes for a user rename that needs no healing.
	 */
	private async updateTreeAndCodexesForRename(
		newPath: string,
	): Promise<void> {
		// Re-read tree to get latest state
		this.tree = await this.readTreeFromVault();

		// Compute impacted chain from new file location
		const newSplitPath = this.vaultActionManager.splitPath(newPath);
		if (newSplitPath.type === SplitPathType.Folder) {
			return;
		}

		const parentChain = newSplitPath.pathParts.slice(1);

		const { expandToAncestors } = await import("./codex/impacted-chains");
		const impactedChains = expandToAncestors(parentChain);
		await this.regenerateCodexes(impactedChains);
	}

	/**
	 * Handle file creation event.
	 * Adds correct suffix to match the file's location.
	 */
	async handleCreate(
		path: string,
		isFolder: boolean,
	): Promise<VaultAction[]> {
		// Ignore folders - we only heal files
		if (isFolder) {
			return [];
		}

		// Ignore files outside library
		if (!path.startsWith(`${this.libraryRoot}/`)) {
			return [];
		}

		// Skip codex files - they're generated, not source data
		const basenameWithoutExt = extractBasenameWithoutExt(path);
		if (isCodexBasename(basenameWithoutExt)) {
			return [];
		}

		const splitPath = this.vaultActionManager.splitPath(path);

		// Only handle files, not folders
		if (splitPath.type === SplitPathType.Folder) {
			return [];
		}

		const { action, parentChain } = computeCreateAction(
			splitPath,
			this.libraryRoot,
			this.suffixDelimiter,
		);

		if (!action) {
			return [];
		}

		try {
			await this.vaultActionManager.dispatch([action]);

			// Re-read tree to include the new file
			this.tree = await this.readTreeFromVault();

			// Expand to ancestors and regenerate codexes
			const { expandToAncestors } = await import(
				"./codex/impacted-chains"
			);
			const impactedChains = expandToAncestors(parentChain);
			await this.regenerateCodexes(impactedChains);
		} finally {
		}

		return [action];
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

	// ────────────────────────────────────────────────────────────────────────────
	// Phase 6: Tree Reconciliation & Codex Integration
	// ────────────────────────────────────────────────────────────────────────────

	/**
	 * Apply VaultActions to tree and collect impacted chains.
	 * Translates VaultActions to TreeActions, applies them, returns impacted sections.
	 */
	private applyActionsToTree(
		actions: VaultAction[],
	): CoreNameChainFromRoot[] {
		if (!this.tree) {
			return [];
		}

		const actionResults: Array<
			| CoreNameChainFromRoot
			| [CoreNameChainFromRoot, CoreNameChainFromRoot]
		> = [];

		for (const action of actions) {
			const treeAction = translateVaultAction(action, {
				getTRef: (path) => this.getTRefForPath(path),
				libraryRoot: this.libraryRoot,
			});

			if (treeAction) {
				const result = this.tree.applyTreeAction(treeAction);
				actionResults.push(result);
			}
		}

		return collectImpactedSections(actionResults);
	}

	/**
	 * Get TFile ref for a path via vaultActionManager.
	 */
	private getTRefForPath(path: string): TFile | null {
		try {
			const splitPath = this.vaultActionManager.splitPath(path);
			if (splitPath.type === SplitPathType.Folder) {
				return null;
			}
			// getAbstractFile is async, but we need sync access
			// Use Obsidian's vault.getAbstractFileByPath directly
			const app = (
				this.vaultActionManager as unknown as {
					app: {
						vault: {
							getAbstractFileByPath: (p: string) => unknown;
						};
					};
				}
			).app;
			const file = app?.vault?.getAbstractFileByPath?.(path);
			return file instanceof TFolder ? null : (file as TFile | null);
		} catch {
			return null;
		}
	}

	/**
	 * Regenerate codexes for impacted sections and dispatch.
	 * Codexes are NOT added to tree - they're generated outputs, not source data.
	 */
	private async regenerateCodexes(
		impactedChains: CoreNameChainFromRoot[],
	): Promise<void> {
		if (!this.tree || impactedChains.length === 0) {
			return;
		}

		try {
			const codexActions = this.buildCodexVaultActions(impactedChains);

			if (codexActions.length > 0) {
				await this.vaultActionManager.dispatch(codexActions);
			}
		} catch (error) {
			console.error("[Librarian] codex regeneration failed:", error);
			// Don't throw - codex failure shouldn't break main healing flow
		}
	}

	/**
	 * Build VaultActions to create/update codex files for impacted sections.
	 */
	private buildCodexVaultActions(
		impactedChains: CoreNameChainFromRoot[],
	): VaultAction[] {
		if (!this.tree) {
			return [];
		}

		const tree = this.tree;
		return buildCodexVaultActions(
			impactedChains,
			(chain) => {
				if (!tree) return null;
				const node = tree.getNode(chain);
				return node?.type === TreeNodeType.Section
					? (node as SectionNode)
					: null;
			},
			{
				libraryRoot: this.libraryRoot,
				suffixDelimiter: this.suffixDelimiter,
			},
		);
	}
}
