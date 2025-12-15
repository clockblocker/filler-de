import { type FileManager, TFolder, type Vault } from "obsidian";
import {
	type MaybeLegacy,
	unwrapMaybeLegacyByThrowing,
} from "../../../../../types/common-interface/maybe";
import type { LegacyFullPathToFolder } from "../../../atomic-services/pathfinder";
import { legacySystemPathFromFullPath } from "../../../atomic-services/pathfinder";

/**
 * Low-level folder operations.
 */
export class LegacyTFolderHelper {
	private fileManager: FileManager;
	private vault: Vault;

	constructor({
		vault,
		fileManager,
	}: { vault: Vault; fileManager: FileManager }) {
		this.vault = vault;
		this.fileManager = fileManager;
	}

	async getFolder(fullPath: LegacyFullPathToFolder): Promise<TFolder> {
		const mbFolder = await this.getMaybeLegacyFolder(fullPath);
		return unwrapMaybeLegacyByThrowing(mbFolder);
	}

	async getMaybeLegacyFolder(
		fullPath: LegacyFullPathToFolder,
	): Promise<MaybeLegacy<TFolder>> {
		const systemPath = legacySystemPathFromFullPath(fullPath);
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
	async createFolder(fullPath: LegacyFullPathToFolder): Promise<TFolder> {
		const mbFolder = await this.getMaybeLegacyFolder(fullPath);
		if (!mbFolder.error) {
			return mbFolder.data; // Already exists
		}

		const systemPath = legacySystemPathFromFullPath(fullPath);
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
	async trashFolder(fullPath: LegacyFullPathToFolder): Promise<void> {
		const mbFolder = await this.getMaybeLegacyFolder(fullPath);
		if (mbFolder.error) {
			return; // Already gone
		}
		await this.fileManager.trashFile(mbFolder.data);
	}

	/**
	 * Rename/move a folder.
	 */
	async renameFolder(
		from: LegacyFullPathToFolder,
		to: LegacyFullPathToFolder,
	): Promise<void> {
		const folder = await this.getFolder(from);
		const toSystemPath = legacySystemPathFromFullPath(to);
		await this.fileManager.renameFile(folder, toSystemPath);
	}
}
