import { type FileManager, TFolder, type Vault } from "obsidian";
import {
	type Maybe,
	unwrapMaybeByThrowing,
} from "../../../../../types/common-interface/maybe";
import { systemPathFromSplitPath } from "../../pathfinder";
import type { SplitPathToFolder } from "../../types";

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

	async createFolderChains(
		splitPaths: readonly SplitPathToFolder[],
	): Promise<TFolder[]> {
		const folders: TFolder[] = [];
		for (const splitPath of splitPaths) {
			folders.push(await this.createFolderChain(splitPath));
		}

		return folders;
	}

	async trashFolder(splitPaths: SplitPathToFolder): Promise<void> {
		const folder = await this.getFolder(splitPaths);
		await this.fileManager.trashFile(folder);
	}

	async trashFolders(splitPaths: SplitPathToFolder[]): Promise<void> {
		for (const splitPath of splitPaths) {
			await this.trashFolder(splitPath);
		}
	}

	async cleanUpFolderChains(
		splitPathsToLastFolders: SplitPathToFolder[],
	): Promise<void> {
		for (const splitPath of splitPathsToLastFolders) {
			await this.cleanUpFolderChain(splitPath);
		}
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

	private async cleanUpFolderChain(
		splitPathsToLastFolder: SplitPathToFolder,
	): Promise<void> {
		const folder = await this.getMaybeFolder(splitPathsToLastFolder);

		if (folder.error) {
			return;
		}

		let currentFolder = unwrapMaybeByThrowing(folder);

		while (currentFolder.children.length === 0) {
			const parentFolder = currentFolder.parent as TFolder;
			await this.fileManager.trashFile(currentFolder);
			currentFolder = parentFolder;
		}
	}

	private async createFolderChain(
		splitPath: SplitPathToFolder,
	): Promise<TFolder> {
		for (const [index, part] of splitPath.pathParts.entries()) {
			const currentSplitPath: SplitPathToFolder = {
				basename: part,
				pathParts: splitPath.pathParts.slice(0, index),
				type: "folder",
			};

			await this.getOrCreateOneFolder(currentSplitPath);
		}

		const folder = await this.getOrCreateOneFolder(splitPath);
		return folder;
	}

	private async getOrCreateOneFolder(
		splitPath: SplitPathToFolder,
	): Promise<TFolder> {
		const mbFolder = await this.getMaybeFolder(splitPath);

		return mbFolder.error
			? await this.safelyCreateOneFolder(splitPath)
			: mbFolder.data;
	}

	private async safelyCreateOneFolder(
		splitPath: SplitPathToFolder,
	): Promise<TFolder> {
		const systemPath = systemPathFromSplitPath(splitPath);
		try {
			const folder = await this.vault.createFolder(systemPath);
			return folder;
		} catch (error) {
			console.error("Error creating folder", splitPath, error);
			if (error.message.includes("already exists")) {
				return this.getFolder(splitPath);
			}
			throw error;
		}
	}
}
