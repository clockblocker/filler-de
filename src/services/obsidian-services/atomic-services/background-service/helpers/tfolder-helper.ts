import { FileManager, TFolder, type Vault } from "obsidian";
import {
	type Maybe,
	unwrapMaybe,
} from "../../../../../types/common-interface/maybe";
import { systemPathFromSplitPath } from "../../../../dto-services/pathfinder/path-helpers";
import type { SplitPathToFolder } from "../types";

export class TFolderHelper {
	private fileManager: FileManager;

	constructor(private vault: Vault) {
		this.fileManager = new FileManager();
	}

	async getFolder(splitPath: SplitPathToFolder): Promise<TFolder> {
		const mbFolder = await this.getMaybeFolder(splitPath);
		return unwrapMaybe(mbFolder);
	}

	async createFolder(splitPath: SplitPathToFolder): Promise<TFolder> {
		for (const [index, part] of splitPath.pathParts.entries()) {
			const currentSplitPath: SplitPathToFolder = {
				basename: part,
				pathParts: splitPath.pathParts.slice(0, index),
				type: "folder",
			};

			await this.getOrCreateOneFolder(currentSplitPath);
		}

		return await this.getOrCreateOneFolder(splitPath);
	}

	async createFolders(splitPaths: SplitPathToFolder[]): Promise<TFolder[]> {
		const folders = await Promise.all(splitPaths.map(this.createFolder));
		return folders;
	}

	async trashFolder(splitPaths: SplitPathToFolder): Promise<void> {
		const folder = await this.getFolder(splitPaths);
		await this.fileManager.trashFile(folder);
	}

	async trashFolders(splitPaths: SplitPathToFolder[]): Promise<void> {
		await Promise.all(splitPaths.map(this.trashFolder));
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

	private async getOrCreateOneFolder(
		splitPath: SplitPathToFolder,
	): Promise<TFolder> {
		const mbFolder = await this.getMaybeFolder(splitPath);

		return mbFolder.error
			? await this.createOneFolder(splitPath)
			: mbFolder.data;
	}

	private async createOneFolder(
		splitPath: SplitPathToFolder,
	): Promise<TFolder> {
		const systemPath = systemPathFromSplitPath(splitPath);
		return await this.vault.createFolder(systemPath);
	}
}
