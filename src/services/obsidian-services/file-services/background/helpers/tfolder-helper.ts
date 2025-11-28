import { type FileManager, TFolder, type Vault } from "obsidian";
import {
	type Maybe,
	unwrapMaybeByThrowing,
} from "../../../../../types/common-interface/maybe";
import type { FullPathToFolder } from "../../../atomic-services/pathfinder";
import { systemPathFromFullPath } from "../../../atomic-services/pathfinder";

/**
 * Low-level folder operations.
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

	async getFolder(fullPath: FullPathToFolder): Promise<TFolder> {
		const mbFolder = await this.getMaybeFolder(fullPath);
		return unwrapMaybeByThrowing(mbFolder);
	}

	async getMaybeFolder(fullPath: FullPathToFolder): Promise<Maybe<TFolder>> {
		const systemPath = systemPathFromFullPath(fullPath);
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
			description: `Expected folder type missmatched the found type: ${fullPath}`,
			error: true,
		};
	}

	/**
	 * Create a single folder.
	 * Assumes parent folder exists.
	 */
	async createFolder(fullPath: FullPathToFolder): Promise<TFolder> {
		const mbFolder = await this.getMaybeFolder(fullPath);
		if (!mbFolder.error) {
			return mbFolder.data; // Already exists
		}

		const systemPath = systemPathFromFullPath(fullPath);
		try {
			return await this.vault.createFolder(systemPath);
		} catch (error) {
			if (error.message?.includes("already exists")) {
				return this.getFolder(fullPath);
			}
			throw error;
		}
	}

	/**
	 * Trash a single folder
	 */
	async trashFolder(fullPath: FullPathToFolder): Promise<void> {
		const mbFolder = await this.getMaybeFolder(fullPath);
		if (mbFolder.error) {
			return; // Already gone
		}
		await this.fileManager.trashFile(mbFolder.data);
	}

	/**
	 * Rename/move a folder.
	 */
	async renameFolder(
		from: FullPathToFolder,
		to: FullPathToFolder,
	): Promise<void> {
		const folder = await this.getFolder(from);
		const toSystemPath = systemPathFromFullPath(to);
		await this.fileManager.renameFile(folder, toSystemPath);
	}
}
