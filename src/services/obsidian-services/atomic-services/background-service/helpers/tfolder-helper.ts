import { FileManager, TFolder, type Vault } from "obsidian";
import {
	type Maybe,
	unwrapMaybeByThrowing,
} from "../../../../../types/common-interface/maybe";
import type { SplitPathToFolder } from "../types";
import { systemPathFromSplitPath } from "./functions";

export class TFolderHelper {
	private fileManager: FileManager;

	constructor(private vault: Vault) {
		this.fileManager = new FileManager();
	}

	async getFolder(splitPath: SplitPathToFolder): Promise<TFolder> {
		const mbFolder = await this.getMaybeFolder(splitPath);
		return unwrapMaybeByThrowing(mbFolder);
	}

	async createFolderChain(splitPath: SplitPathToFolder): Promise<TFolder> {
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

	async createFolderChains(
		splitPaths: SplitPathToFolder[],
	): Promise<TFolder[]> {
		const folders = await Promise.all(
			splitPaths.map(this.createFolderChain),
		);
		return folders;
	}

	async trashFolder(splitPaths: SplitPathToFolder): Promise<void> {
		const folder = await this.getFolder(splitPaths);
		await this.fileManager.trashFile(folder);
	}

	async trashFolders(splitPaths: SplitPathToFolder[]): Promise<void> {
		await Promise.all(splitPaths.map(this.trashFolder));
	}

	async cleanUpFolderChain(
		splitPathsToLastFolder: SplitPathToFolder,
	): Promise<void> {
		const folder = await this.getFolder(splitPathsToLastFolder);

		let currentFolder = folder;
		while (currentFolder.children.length === 0) {
			const parentFolder = currentFolder.parent as TFolder;
			await this.fileManager.trashFile(currentFolder);
			currentFolder = parentFolder;
		}
	}

	async cleanUpFolderChains(
		splitPathsToLastFolders: SplitPathToFolder[],
	): Promise<void> {
		await Promise.all(splitPathsToLastFolders.map(this.cleanUpFolderChain));
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
