import type { TFile } from "obsidian";
import { TFolder } from "obsidian";
import type {
	ObsidianVaultActionManager,
	VaultEvent,
} from "../../obsidian-vault-action-manager";
import { systemPathFromSplitPath } from "../../obsidian-vault-action-manager/helpers/pathfinder";
import type {
	SplitPathToFile,
	SplitPathToFileWithTRef,
	SplitPathToFolder,
	SplitPathToMdFile,
	SplitPathToMdFileWithTRef,
} from "../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../obsidian-vault-action-manager/types/vault-action";
import { extractMetaInfo } from "../../services/dto-services/meta-info-manager/interface";
import { collectImpactedSections, generateCodexContent } from "./codex";
import {
	type DragInResult,
	detectRenameMode,
	type EventMode,
	handleDragIn,
	healOnInit,
	type InitHealResult,
	type RenameIntent,
	resolveRuntimeIntent,
} from "./healing";
import { LibraryTree } from "./library-tree";
import { translateVaultAction } from "./reconciliation";
import {
	type DragInSubtype,
	HealingMode,
	RuntimeSubtype,
	TreeActionType,
} from "./types/literals";
import type { CoreNameChainFromRoot } from "./types/split-basename";
import {
	type SectionNode,
	TreeNodeStatus,
	TreeNodeType,
} from "./types/tree-node";
import { buildCodexBasename, isCodexBasename } from "./utils/codex-utils";
import {
	splitPathToLeaf,
	withStatusFromMeta,
} from "./utils/split-path-to-leaf";

export class Librarian {
	private tree: LibraryTree | null = null;
	/** Track paths we're currently processing to avoid self-event loops */
	private processingPaths = new Set<string>();
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
				if (event.type === "FileRenamed") {
					const oldPath = systemPathFromSplitPath(event.from);
					const newPath = systemPathFromSplitPath(event.to);
					await this.handleRename(oldPath, newPath, false);
				} else if (event.type === "FolderRenamed") {
					const oldPath = systemPathFromSplitPath(event.from);
					const newPath = systemPathFromSplitPath(event.to);
					await this.handleRename(oldPath, newPath, true);
				} else if (event.type === "FileCreated") {
					const path = systemPathFromSplitPath(event.splitPath);
					await this.handleCreate(path, false);
				} else if (event.type === "FolderCreated") {
					// Folders don't need healing, skip
				} else if (event.type === "FileTrashed") {
					const path = systemPathFromSplitPath(event.splitPath);
					await this.handleDelete(path, false);
				} else if (event.type === "FolderTrashed") {
					const path = systemPathFromSplitPath(event.splitPath);
					await this.handleDelete(path, true);
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
		const allSectionChains = this.collectAllSectionChains();
		console.log(
			"[Librarian] regenerating all codexes:",
			allSectionChains.length,
		);

		await this.regenerateCodexes(allSectionChains);
	}

	/**
	 * Collect chains for all sections in tree (including root).
	 */
	private collectAllSectionChains(): CoreNameChainFromRoot[] {
		if (!this.tree) {
			return [];
		}

		const chains: CoreNameChainFromRoot[] = [[]]; // Start with root

		const collectRecursive = (
			node: SectionNode,
			currentChain: CoreNameChainFromRoot,
		) => {
			for (const child of node.children) {
				if (child.type === TreeNodeType.Section) {
					const childChain = [...currentChain, child.coreName];
					chains.push(childChain);
					collectRecursive(child as SectionNode, childChain);
				}
			}
		};

		const root = this.tree.getNode([]);
		if (root && root.type === TreeNodeType.Section) {
			collectRecursive(root as SectionNode, []);
		}

		return chains;
	}

	/**
	 * Get current tree (null if not initialized).
	 */
	getTree(): LibraryTree | null {
		return this.tree;
	}

	/**
	 * Set status for a node (scroll or section).
	 * Updates tree and regenerates impacted codexes.
	 */
	async setStatus(
		coreNameChain: CoreNameChainFromRoot,
		status: "Done" | "NotStarted",
	): Promise<void> {
		if (!this.tree) {
			console.warn("[Librarian] setStatus called before init");
			return;
		}

		const newStatus =
			status === "Done" ? TreeNodeStatus.Done : TreeNodeStatus.NotStarted;

		const impactedChain = this.tree.applyTreeAction({
			payload: { coreNameChain, newStatus },
			type: TreeActionType.ChangeNodeStatus,
		});

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
	 * Handle delete event from vault.
	 * Removes node from tree and regenerates impacted codexes.
	 */
	async handleDelete(path: string, isFolder: boolean): Promise<void> {
		// Skip self-triggered events
		if (this.processingPaths.has(path)) {
			console.log("[Librarian] skipping self-event delete:", path);
			return;
		}

		// Ignore files outside library
		if (!path.startsWith(this.libraryRoot + "/")) {
			return;
		}

		// Skip codex files
		const basename = path.split("/").pop() ?? "";
		const basenameWithoutExt = basename.includes(".")
			? basename.slice(0, basename.lastIndexOf("."))
			: basename;
		if (isCodexBasename(basenameWithoutExt)) {
			return;
		}

		if (!this.tree) {
			return;
		}

		console.log("[Librarian] handleDelete:", path, "isFolder:", isFolder);

		// Parse path to get coreNameChain
		// Use isFolder param instead of splitPath.type (deleted item may not exist)
		const pathParts = path.split("/");
		const libraryRootIndex = pathParts.indexOf(this.libraryRoot);
		if (libraryRootIndex === -1) {
			console.log("[Librarian] handleDelete: library root not found");
			return;
		}

		// Chain = parts after library root
		const partsAfterRoot = pathParts.slice(libraryRootIndex + 1);

		let coreNameChain: CoreNameChainFromRoot;

		if (isFolder) {
			// Folder delete: chain is just the folder path (no basename parsing)
			coreNameChain = partsAfterRoot;
		} else {
			// File delete: last part is filename, parse to get coreName
			const { parseBasename } = await import("./utils/parse-basename");
			const filename = partsAfterRoot.pop() ?? "";
			// Remove extension
			const basenameWithoutExt = filename.includes(".")
				? filename.slice(0, filename.lastIndexOf("."))
				: filename;
			const parsed = parseBasename(
				basenameWithoutExt,
				this.suffixDelimiter,
			);
			coreNameChain = [...partsAfterRoot, parsed.coreName];
		}

		console.log("[Librarian] handleDelete coreNameChain:", coreNameChain);

		const impactedChain = this.tree.applyTreeAction({
			payload: { coreNameChain },
			type: TreeActionType.DeleteNode,
		});

		console.log("[Librarian] handleDelete impactedChain:", impactedChain);

		const { expandToAncestors, dedupeChains } = await import(
			"./codex/impacted-chains"
		);
		const impactedSections = dedupeChains(
			expandToAncestors(impactedChain as CoreNameChainFromRoot),
		);

		console.log(
			"[Librarian] handleDelete impactedSections:",
			impactedSections,
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
		// Skip if this is a self-triggered event (from our own dispatch)
		if (
			this.processingPaths.has(oldPath) ||
			this.processingPaths.has(newPath)
		) {
			console.log(
				"[Librarian] skipping self-event:",
				oldPath,
				"→",
				newPath,
			);
			return [];
		}

		console.log(
			"[Librarian] handleRename:",
			oldPath,
			"→",
			newPath,
			"isFolder:",
			isFolder,
		);

		const mode = detectRenameMode(
			{ isFolder, newPath, oldPath },
			this.libraryRoot,
		);
		console.log("[Librarian] detected mode:", mode);

		if (!mode) {
			console.log("[Librarian] no mode detected, skipping");
			return [];
		}

		const actions = await this.resolveActions(
			mode,
			oldPath,
			newPath,
			isFolder,
		);
		console.log("[Librarian] resolved actions:", actions.length, actions);

		if (actions.length > 0) {
			// Track paths we're about to modify to filter self-events
			for (const action of actions) {
				if ("from" in action.payload && "to" in action.payload) {
					const fromPath = [
						...action.payload.from.pathParts,
						action.payload.from.basename,
					].join("/");

					const toPath = [
						...action.payload.to.pathParts,
						action.payload.to.basename,
					].join("/");

					this.processingPaths.add(fromPath);
					this.processingPaths.add(toPath);
					// Also add with extension for md files
					if (action.payload.from.type === "MdFile") {
						this.processingPaths.add(fromPath + ".md");
						this.processingPaths.add(toPath + ".md");
					}
				}
			}

			console.log("[Librarian] dispatching actions...");
			try {
				await this.vaultActionManager.dispatch(actions);

				// Apply to tree and collect impacted chains
				const impactedChains = this.applyActionsToTree(actions);
				console.log("[Librarian] impacted chains:", impactedChains);

				// Regenerate codexes for impacted sections
				await this.regenerateCodexes(impactedChains);

				console.log("[Librarian] dispatch complete");
			} finally {
				// Clear tracked paths after a delay to allow events to settle
				setTimeout(() => {
					this.processingPaths.clear();
				}, 500);
			}
		} else {
			// No healing needed, but still update tree and codexes for user's rename
			await this.updateTreeAndCodexesForRename(oldPath, newPath);
		}

		return actions;
	}

	/**
	 * Update tree and regenerate codexes for a user rename that needs no healing.
	 */
	private async updateTreeAndCodexesForRename(
		oldPath: string,
		newPath: string,
	): Promise<void> {
		// Re-read tree to get latest state
		this.tree = await this.readTreeFromVault();

		// Compute impacted chain from new file location
		const newSplitPath = this.vaultActionManager.splitPath(newPath);
		if (newSplitPath.type === "Folder") {
			return;
		}

		// Parent chain (without library root)
		const parentChain = newSplitPath.pathParts.slice(1);
		console.log(
			"[Librarian] rename (no healing) impacted chain:",
			parentChain,
		);

		// Expand to ancestors and regenerate codexes
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
		if (!path.startsWith(this.libraryRoot + "/")) {
			return [];
		}

		// Skip codex files - they're generated, not source data
		const basename = path.split("/").pop() ?? "";
		const basenameWithoutExt = basename.includes(".")
			? basename.slice(0, basename.lastIndexOf("."))
			: basename;
		console.log("[Librarian] handleCreate check:", {
			basename,
			basenameWithoutExt,
			isCodex: isCodexBasename(basenameWithoutExt),
		});
		if (isCodexBasename(basenameWithoutExt)) {
			console.log("[Librarian] skipping codex file:", path);
			return [];
		}

		// Skip if we're already processing this path
		if (this.processingPaths.has(path)) {
			console.log("[Librarian] skipping self-event create:", path);
			return [];
		}

		console.log("[Librarian] handleCreate:", path);

		const splitPath = this.vaultActionManager.splitPath(path);

		// Only handle files, not folders
		if (splitPath.type === "Folder") {
			return [];
		}

		// Compute relative path (without library root)
		const relativePathParts = splitPath.pathParts.slice(1); // Remove library root

		// If at root, no suffix needed
		if (relativePathParts.length === 0) {
			console.log("[Librarian] file at root, no suffix needed");
			return [];
		}

		// Parse current basename to get coreName
		const { parseBasename } = await import("./utils/parse-basename");
		const { buildBasename, computeSuffixFromPath } = await import(
			"./utils/path-suffix-utils"
		);

		const parsed = parseBasename(splitPath.basename, this.suffixDelimiter);
		const expectedSuffix = computeSuffixFromPath(relativePathParts);

		// Check if suffix already correct
		const suffixMatches =
			parsed.splitSuffix.length === expectedSuffix.length &&
			parsed.splitSuffix.every((s, i) => s === expectedSuffix[i]);

		if (suffixMatches) {
			console.log("[Librarian] suffix already correct");
			return [];
		}

		// Build correct basename with suffix
		const newBasename = buildBasename(
			parsed.coreName,
			expectedSuffix,
			this.suffixDelimiter,
		);

		// Track paths before dispatch
		const fromPathStr = [...splitPath.pathParts, splitPath.basename].join(
			"/",
		);
		const toPathStr = [...splitPath.pathParts, newBasename].join("/");
		this.processingPaths.add(fromPathStr);
		this.processingPaths.add(toPathStr);

		// Build action based on file type
		let action: VaultAction;
		if (splitPath.type === "MdFile") {
			const mdPath = splitPath as SplitPathToMdFile;
			action = {
				payload: {
					from: mdPath,
					to: { ...mdPath, basename: newBasename },
				},
				type: "RenameMdFile",
			};
			this.processingPaths.add(`${fromPathStr}.md`);
			this.processingPaths.add(`${toPathStr}.md`);
		} else {
			const filePath = splitPath as SplitPathToFile;
			action = {
				payload: {
					from: filePath,
					to: { ...filePath, basename: newBasename },
				},
				type: "RenameFile",
			};
		}

		console.log("[Librarian] create action:", action);

		try {
			await this.vaultActionManager.dispatch([action]);

			// Re-read tree to include the new file
			this.tree = await this.readTreeFromVault();

			// Compute impacted chain from new file location
			// The new file is at: pathParts (without root) + newBasename
			const impactedChain = relativePathParts; // parent chain
			console.log("[Librarian] create impacted chain:", impactedChain);

			// Expand to ancestors and regenerate codexes
			const { expandToAncestors } = await import(
				"./codex/impacted-chains"
			);
			const impactedChains = expandToAncestors(impactedChain);
			await this.regenerateCodexes(impactedChains);
		} finally {
			setTimeout(() => {
				this.processingPaths.clear();
			}, 500);
		}

		return [action];
	}

	/**
	 * Resolve actions based on detected mode.
	 */
	private async resolveActions(
		mode: EventMode,
		oldPath: string,
		newPath: string,
		isFolder: boolean,
	): Promise<VaultAction[]> {
		switch (mode.mode) {
			case HealingMode.Runtime:
				return this.resolveRuntimeActions(
					oldPath,
					newPath,
					mode.subtype,
					isFolder,
				);

			case HealingMode.DragIn:
				return this.resolveDragInActions(newPath, mode.subtype);

			case HealingMode.Init:
				// Init is handled separately via init()
				return [];
		}
	}

	/**
	 * Resolve Mode 1 (Runtime) actions.
	 */
	private async resolveRuntimeActions(
		oldPath: string,
		newPath: string,
		subtype: RuntimeSubtype,
		isFolder: boolean,
	): Promise<VaultAction[]> {
		console.log("[Librarian] resolveRuntimeActions input:", {
			newPath,
			oldPath,
			subtype,
		});
		const oldSplitPath = this.vaultActionManager.splitPath(oldPath);
		const newSplitPath = this.vaultActionManager.splitPath(newPath);
		console.log("[Librarian] splitPath results:", {
			newSplitPath,
			oldSplitPath,
		});

		// Folder renames: handled via handleFolderRename
		if (
			isFolder ||
			oldSplitPath.type === "Folder" ||
			newSplitPath.type === "Folder"
		) {
			if (newSplitPath.type === "Folder") {
				return this.handleFolderRename(newSplitPath);
			}
			return [];
		}

		const intent = resolveRuntimeIntent(
			oldSplitPath as SplitPathToFile | SplitPathToMdFile,
			newSplitPath as SplitPathToFile | SplitPathToMdFile,
			subtype,
			this.libraryRoot,
			this.suffixDelimiter,
		);

		if (!intent) {
			return [];
		}

		return this.intentToActions(intent);
	}

	/**
	 * Handle folder rename: list all files in folder and heal each.
	 * Obsidian does NOT emit file events for children when folder is renamed.
	 * Returns the generated actions (dispatch handled by caller).
	 */
	private async handleFolderRename(
		folderPath: SplitPathToFolder,
	): Promise<VaultAction[]> {
		const allEntries = await this.vaultActionManager.listAll(folderPath);
		const fileEntries = allEntries.filter(
			(
				entry,
			): entry is SplitPathToFileWithTRef | SplitPathToMdFileWithTRef =>
				entry.type === "File" || entry.type === "MdFile",
		);

		const actions: VaultAction[] = [];

		for (const entry of fileEntries) {
			// For each file, compute expected suffix from its current path
			const intent = resolveRuntimeIntent(
				entry, // "from" - same as current path (we don't know old path)
				entry, // "to" - current path
				RuntimeSubtype.PathOnly, // Path changed, fix suffix
				this.libraryRoot,
				this.suffixDelimiter,
			);

			if (intent) {
				actions.push(...this.intentToActions(intent));
			}
		}

		return actions;
	}

	/**
	 * Resolve Mode 3 (DragIn) actions.
	 */
	private resolveDragInActions(
		newPath: string,
		subtype: DragInSubtype,
	): VaultAction[] {
		const splitPath = this.vaultActionManager.splitPath(newPath);

		const result: DragInResult = handleDragIn(
			subtype,
			splitPath as
				| SplitPathToFile
				| SplitPathToMdFile
				| SplitPathToFolder,
			this.libraryRoot,
			this.suffixDelimiter,
		);

		return result.actions;
	}

	/**
	 * Convert RenameIntent to VaultActions.
	 */
	private intentToActions(intent: RenameIntent): VaultAction[] {
		if (intent.from.type === "MdFile") {
			return [
				{
					payload: {
						from: intent.from as SplitPathToMdFile,
						to: intent.to as SplitPathToMdFile,
					},
					type: "RenameMdFile" as const,
				},
			];
		}

		return [
			{
				payload: {
					from: intent.from as SplitPathToFile,
					to: intent.to as SplitPathToFile,
				},
				type: "RenameFile" as const,
			},
		];
	}

	/**
	 * Read tree from existing vault.
	 * Lists all files in the library root and builds a LibraryTree.
	 */
	async readTreeFromVault(): Promise<LibraryTree> {
		const rootSplitPath = this.vaultActionManager.splitPath(
			this.libraryRoot,
		);
		if (rootSplitPath.type !== "Folder") {
			throw new Error(
				`Library root is not a folder: ${this.libraryRoot}`,
			);
		}

		const rootFolder =
			await this.vaultActionManager.getAbstractFile(rootSplitPath);
		if (!(rootFolder instanceof TFolder)) {
			throw new Error(`Library root not found: ${this.libraryRoot}`);
		}

		const allEntries = await this.vaultActionManager.listAll(rootSplitPath);
		const fileEntries = allEntries.filter(
			(
				entry,
			): entry is SplitPathToFileWithTRef | SplitPathToMdFileWithTRef =>
				(entry.type === "File" || entry.type === "MdFile") &&
				// Skip codex files - they're generated, not source data
				!isCodexBasename(entry.basename),
		);

		const leavesWithoutStatus = fileEntries.map((entry) =>
			splitPathToLeaf(entry, this.libraryRoot, this.suffixDelimiter),
		);

		const readContent = (tRef: import("obsidian").TFile) => {
			const sp = this.vaultActionManager.splitPath(tRef);
			if (sp.type !== "MdFile") {
				return Promise.resolve("");
			}
			return this.vaultActionManager.readContent(sp);
		};

		const leaves = await Promise.all(
			leavesWithoutStatus.map((leaf) =>
				withStatusFromMeta(leaf, readContent, extractMetaInfo),
			),
		);

		return new LibraryTree(leaves, rootFolder);
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
			if (splitPath.type === "Folder") {
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
				console.log(
					"[Librarian] regenerating codexes:",
					codexActions.length,
				);
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

		const actions: VaultAction[] = [];

		for (const chain of impactedChains) {
			const node = this.tree.getNode(chain);
			if (!node || node.type !== TreeNodeType.Section) {
				continue;
			}

			const section = node as SectionNode;
			const content = generateCodexContent(section, {
				libraryRoot: this.libraryRoot,
				suffixDelimiter: this.suffixDelimiter,
			});

			// Build codex basename with suffix (same pattern as regular files)
			// Root: __Library (no suffix, use libraryRoot name)
			// Nested: __Salad-Recipe (suffix = parent chain reversed)
			const sectionName =
				chain.length === 0 ? this.libraryRoot : section.coreName;
			const coreCodexName = buildCodexBasename(sectionName);
			const suffix =
				chain.length > 0
					? chain
							.slice(0, -1) // Parent chain (exclude self)
							.reverse()
							.join(this.suffixDelimiter)
					: "";
			const codexBasename = suffix
				? `${coreCodexName}${this.suffixDelimiter}${suffix}`
				: coreCodexName;

			// Codex path: inside the section folder
			const pathParts = [this.libraryRoot, ...chain];
			const codexSplitPath: SplitPathToMdFile = {
				basename: codexBasename,
				extension: "md",
				pathParts,
				type: "MdFile",
			};

			// Always use ReplaceContentMdFile - it creates if not exists
			// This avoids triggering handleCreate which would add suffixes
			actions.push({
				payload: { content, splitPath: codexSplitPath },
				type: "ReplaceContentMdFile",
			});
		}

		return actions;
	}
}
