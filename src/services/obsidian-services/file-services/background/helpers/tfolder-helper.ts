import { type FileManager, TFolder, type Vault } from "obsidian";
import {
	type Maybe,
	unwrapMaybeByThrowing,
} from "../../../../../types/common-interface/maybe";
import { systemPathFromSplitPath } from "../../pathfinder";
import type { SplitPathToFolder } from "../../types";

/**
 * Low-level folder operations.
 *
 * NOTE: Chain logic (create parent folders, cleanup empty folders)
 * is handled by DiffToActionsMapper, NOT here.
 *
 * @see src/commanders/librarian/diffing/diff-to-actions.ts
 */
export class TFolderHelper {
	private fileManager: FileManager;
	private vault: Vault;

	constructor({
		vault,
		fileManager,
	}: { vault: Vault; fileManager: FileManager }) {
		this.vault = vault;
		this.fileManager = fileManager;
	}

	async getFolder(splitPath: SplitPathToFolder): Promise<TFolder> {
		const mbFolder = await this.getMaybeFolder(splitPath);
		return unwrapMaybeByThrowing(mbFolder);
	}

	async getMaybeFolder(
		splitPath: SplitPathToFolder,
	): Promise<Maybe<TFolder>> {
		const systemPath = systemPathFromSplitPath(splitPath);
		const tAbstractFile = this.vault.getAbstractFileByPath(systemPath);
		if (!tAbstractFile) {
			return {
				description: `Failed to get file by path: ${systemPath}`,
				error: true,
			};
		}

		if (tAbstractFile instanceof TFolder) {
			return {
				data: tAbstractFile,
				error: false,
			};
		}

		return {
			description: `Expected folder type missmatched the found type: ${splitPath}`,
			error: true,
		};
	}

	/**
	 * Create a single folder. Does NOT create parent chain.
	 * Assumes parent folder exists.
	 */
	async createFolder(splitPath: SplitPathToFolder): Promise<TFolder> {
		const mbFolder = await this.getMaybeFolder(splitPath);
		if (!mbFolder.error) {
			return mbFolder.data; // Already exists
		}

		const systemPath = systemPathFromSplitPath(splitPath);
		try {
			return await this.vault.createFolder(systemPath);
		} catch (error) {
			if (error.message?.includes("already exists")) {
				return this.getFolder(splitPath);
			}
			throw error;
		}
	}

	/**
	 * Trash a single folder. Does NOT cleanup parent chain.
	 */
	async trashFolder(splitPath: SplitPathToFolder): Promise<void> {
		const mbFolder = await this.getMaybeFolder(splitPath);
		if (mbFolder.error) {
			return; // Already gone
		}
		await this.fileManager.trashFile(mbFolder.data);
	}

	/**
	 * Rename/move a folder.
	 */
	async renameFolder(
		from: SplitPathToFolder,
		to: SplitPathToFolder,
	): Promise<void> {
		const folder = await this.getFolder(from);
		const toSystemPath = systemPathFromSplitPath(to);
		await this.fileManager.renameFile(folder, toSystemPath);
	}
}
