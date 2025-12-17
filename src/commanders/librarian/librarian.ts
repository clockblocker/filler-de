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
	type RuntimeSubtype,
} from "./types/literals";
import {
	splitPathToLeaf,
	withStatusFromMeta,
} from "./utils/split-path-to-leaf";

export class Librarian {
	private tree: LibraryTree | null = null;

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
		this.tree = await this.readTreeFromVault();
		const leaves = this.tree.serializeToLeaves();

		const healResult = healOnInit(
			leaves,
			this.libraryRoot,
			this.suffixDelimiter,
		);

		if (healResult.renameActions.length > 0) {
			await this.vaultActionManager.dispatch(healResult.renameActions);
			// Re-read tree after healing
			this.tree = await this.readTreeFromVault();
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
		const mode = detectRenameMode(
			{ isFolder, newPath, oldPath },
			this.libraryRoot,
		);

		if (!mode) {
			return [];
		}

		const actions = this.resolveActions(mode, oldPath, newPath, isFolder);

		if (actions.length > 0) {
			await this.vaultActionManager.dispatch(actions);
			// Refresh tree after changes
			this.tree = await this.readTreeFromVault();
		}

		return actions;
	}

	/**
	 * Resolve actions based on detected mode.
	 */
	private resolveActions(
		mode: EventMode,
		oldPath: string,
		newPath: string,
		isFolder: boolean,
	): VaultAction[] {
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
	private resolveRuntimeActions(
		oldPath: string,
		newPath: string,
		subtype: RuntimeSubtype,
		isFolder: boolean,
	): VaultAction[] {
		if (isFolder) {
			// Folder renames: all children need suffix updates
			// This is complex - for now, trigger full subtree heal
			// TODO: Implement folder rename handling
			return [];
		}

		const oldSplitPath = this.vaultActionManager.splitPath(oldPath);
		const newSplitPath = this.vaultActionManager.splitPath(newPath);

		if (oldSplitPath.type === "Folder" || newSplitPath.type === "Folder") {
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
