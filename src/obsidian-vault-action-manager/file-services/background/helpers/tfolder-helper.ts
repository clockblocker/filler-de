import { err, ok, type Result } from "neverthrow";
import { type FileManager, TFolder, type Vault } from "obsidian";
import {
	logError,
	logWarning,
} from "../../../../obsidian-vault-action-manager/helpers/issue-handlers";
import {
	findFirstAvailableIndexedPath,
	systemPathToSplitPath,
} from "../../../../obsidian-vault-action-manager/helpers/pathfinder";
import type {
	SplitPathFromTo,
	SplitPathToFolder,
} from "../../../../obsidian-vault-action-manager/types/split-path";
import { type CollisionStrategy, getExistingBasenamesInFolder } from "./common";

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

	async getFolder(splitPath: SplitPathToFolder): Promise<TFolder> {
		const result = await this.getFolderResult(splitPath);
		return result.match(
			(folder) => folder,
			(error) => {
				throw new Error(error);
			},
		);
	}

	private async getFolderResult(
		splitPath: SplitPathToFolder,
	): Promise<Result<TFolder, string>> {
		const systemPath = systemPathToSplitPath.encode(splitPath);
		const tAbstractFile = this.vault.getAbstractFileByPath(systemPath);
		if (!tAbstractFile) {
			return err(`Failed to get folder by path: ${systemPath}`);
		}

		if (tAbstractFile instanceof TFolder) {
			return ok(tAbstractFile);
		}

		return err(
			`Expected folder type missmatched the found type: ${systemPath}`,
		);
	}

	async createFolders(
		splitPaths: readonly SplitPathToFolder[],
	): Promise<TFolder[]> {
		const folders: TFolder[] = [];
		for (const splitPath of splitPaths) {
			folders.push(await this.createFolder(splitPath));
		}
		return folders;
	}

	async trashFolders(
		splitPaths: readonly SplitPathToFolder[],
	): Promise<void> {
		for (const splitPath of splitPaths) {
			await this.trashFolder(splitPath);
		}
	}

	async renameFolders(
		fromTos: readonly SplitPathFromTo<SplitPathToFolder>[],
		collisionStrategy?: CollisionStrategy,
	): Promise<void> {
		for (const fromTo of fromTos) {
			await this.renameFolder({ ...fromTo, collisionStrategy });
		}
	}

	/**
	 * Create a single folder.
	 * Assumes parent folder exists.
	 */
	async createFolder(splitPath: SplitPathToFolder): Promise<TFolder> {
		const result = await this.createFolderResult(splitPath);
		return result.match(
			(folder) => folder,
			(error) => {
				throw new Error(error);
			},
		);
	}

	private async createFolderResult(
		splitPath: SplitPathToFolder,
	): Promise<Result<TFolder, string>> {
		const folderResult = await this.getFolderResult(splitPath);
		if (folderResult.isOk()) {
			return ok(folderResult.value); // Already exists
		}

		const systemPath = systemPathToSplitPath.encode(splitPath);
		try {
			const createdFolder = await this.vault.createFolder(systemPath);
			return ok(createdFolder);
		} catch (error) {
			if (error.message?.includes("already exists")) {
				// Race condition: folder was created by another process
				const existingResult = await this.getFolderResult(splitPath);
				if (existingResult.isOk()) {
					return ok(existingResult.value);
				}
				return err(
					`Folder creation race condition: ${systemPath} was created but cannot be retrieved: ${existingResult.error}`,
				);
			}
			return err(
				`Failed to create folder: ${systemPath}: ${error.message}`,
			);
		}
	}

	/**
	 * Trash a single folder
	 */
	async trashFolder(splitPath: SplitPathToFolder): Promise<void> {
		const result = await this.trashFolderResult(splitPath);
		result.match(
			() => {
				// Folder successfully trashed
			},
			(error) => {
				logError({
					description: `Failed to trash folder: ${systemPathToSplitPath.encode(splitPath)}: ${error}`,
					location: "TFolderHelper.trashFolder",
				});
				throw new Error(error);
			},
		);
	}

	private async trashFolderResult(
		splitPath: SplitPathToFolder,
	): Promise<Result<TFolder, string>> {
		const folderResult = await this.getFolderResult(splitPath);
		if (folderResult.isErr()) {
			return err(
				`Folder not found: ${systemPathToSplitPath.encode(splitPath)}`,
			);
		}
		await this.fileManager.trashFile(folderResult.value);
		return ok(folderResult.value);
	}

	/**
	 * Rename/move a folder.
	 */
	async renameFolder({
		from,
		to,
		collisionStrategy = "rename",
	}: SplitPathFromTo<SplitPathToFolder> & {
		collisionStrategy?: CollisionStrategy;
	}): Promise<void> {
		const fromResult = await this.getFolderResult(from);
		const toResult = await this.getFolderResult(to);

		if (fromResult.isErr()) {
			if (toResult.isErr()) {
				const fromPath = systemPathToSplitPath.encode(from);
				const toPath = systemPathToSplitPath.encode(to);
				const error = toResult.error;
				logError({
					description: `Both source \n(${fromPath}) \n and target \n (${toPath}) \n folders not found: ${error}`,
					location: "TFolderHelper.renameFolder",
				});
				throw new Error(
					`Both source (${fromPath}) and target (${toPath}) folders not found`,
				);
			}
			// FromFolder not found, but ToFolder found. Assume already moved.
			return;
		}

		// If source and target are the same folder, no-op
		if (toResult.isOk() && fromResult.value === toResult.value) {
			return;
		}

		if (toResult.isOk()) {
			// Target exists
			if (collisionStrategy === "skip") {
				logWarning({
					description: `Target folder (${systemPathToSplitPath.encode(to)}) exists, skipping rename`,
					location: "TFolderHelper.renameFolder",
				});
				return;
			}

			// collisionStrategy === "rename" - find first available indexed name
			const existingBasenames = await getExistingBasenamesInFolder(
				to,
				this.vault,
			);

			const indexedPath = await findFirstAvailableIndexedPath(
				to,
				existingBasenames,
			);

			await this.fileManager.renameFile(
				fromResult.value,
				systemPathToSplitPath.encode(indexedPath),
			);
			return;
		}

		await this.fileManager.renameFile(
			fromResult.value,
			systemPathToSplitPath.encode(to),
		);
	}
}
