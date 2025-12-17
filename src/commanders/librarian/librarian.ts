import { TFolder } from "obsidian";
import type { ObsidianVaultActionManager } from "../../obsidian-vault-action-manager";
import type {
	SplitPathToFile,
	SplitPathToFileWithTRef,
	SplitPathToFolder,
	SplitPathToMdFile,
	SplitPathToMdFileWithTRef,
} from "../../obsidian-vault-action-manager/types/split-path";
import type { VaultAction } from "../../obsidian-vault-action-manager/types/vault-action";
import { extractMetaInfo } from "../../services/dto-services/meta-info-manager/interface";
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
import {
	type DragInSubtype,
	HealingMode,
	RuntimeSubtype,
} from "./types/literals";
import {
	splitPathToLeaf,
	withStatusFromMeta,
} from "./utils/split-path-to-leaf";

export class Librarian {
	private tree: LibraryTree | null = null;
	/** Track paths we're currently processing to avoid self-event loops */
	private processingPaths = new Set<string>();

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
			// Re-read tree after healing
			try {
				this.tree = await this.readTreeFromVault();
			} catch (error) {
				console.error(
					"[Librarian] Failed to re-read tree after healing:",
					error,
				);
			}
		}

		return healResult;
	}

	/**
	 * Get current tree (null if not initialized).
	 */
	getTree(): LibraryTree | null {
		return this.tree;
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
				// Refresh tree after changes
				this.tree = await this.readTreeFromVault();
				console.log("[Librarian] dispatch complete, tree refreshed");
			} finally {
				// Clear tracked paths after a delay to allow events to settle
				setTimeout(() => {
					this.processingPaths.clear();
				}, 500);
			}
		}

		return actions;
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
				entry.type === "File" || entry.type === "MdFile",
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
}
