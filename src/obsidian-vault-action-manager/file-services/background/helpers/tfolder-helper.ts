import { err, ok, type Result } from "neverthrow";
import { type FileManager, TFolder, type Vault } from "obsidian";
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

	async getFolder(
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

	/**
	 * Create a single folder.
	 * Assumes parent folder exists.
	 */
	async createFolder(
		splitPath: SplitPathToFolder,
	): Promise<Result<TFolder, string>> {
		const folderResult = await this.getFolder(splitPath);
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
				const existingResult = await this.getFolder(splitPath);
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

	async trashFolder(
		splitPath: SplitPathToFolder,
	): Promise<Result<void, string>> {
		const folderResult = await this.getFolder(splitPath);
		if (folderResult.isErr()) {
			// Folder already trashed
			return ok(undefined);
		}
		await this.fileManager.trashFile(folderResult.value);
		return ok(undefined);
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
	}): Promise<Result<TFolder, string>> {
		const fromResult = await this.getFolder(from);
		const toResult = await this.getFolder(to);

		if (fromResult.isErr()) {
			if (toResult.isErr()) {
				const fromPath = systemPathToSplitPath.encode(from);
				const toPath = systemPathToSplitPath.encode(to);
				return err(
					`Both source (${fromPath}) and target (${toPath}) folders not found: ${toResult.error}`,
				);
			}
			// FromFolder not found, but ToFolder found. Assume already moved.
			return ok(toResult.value);
		}

		// If source and target are the same folder, no-op
		if (toResult.isOk() && fromResult.value === toResult.value) {
			return ok(fromResult.value);
		}

		if (toResult.isOk()) {
			// Target exists
			if (collisionStrategy === "skip") {
				return ok(toResult.value);
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

			try {
				await this.fileManager.renameFile(
					fromResult.value,
					systemPathToSplitPath.encode(indexedPath),
				);
				const renamedResult = await this.getFolder(indexedPath);
				if (renamedResult.isErr()) {
					return err(
						`Failed to retrieve renamed folder: ${systemPathToSplitPath.encode(indexedPath)}: ${renamedResult.error}`,
					);
				}
				return ok(renamedResult.value);
			} catch (error) {
				return err(
					`Failed to rename folder: ${systemPathToSplitPath.encode(from)} to ${systemPathToSplitPath.encode(indexedPath)}: ${error.message}`,
				);
			}
		}

		try {
			await this.fileManager.renameFile(
				fromResult.value,
				systemPathToSplitPath.encode(to),
			);
			const renamedResult = await this.getFolder(to);
			if (renamedResult.isErr()) {
				return err(
					`Failed to retrieve renamed folder: ${systemPathToSplitPath.encode(to)}: ${renamedResult.error}`,
				);
			}
			return ok(renamedResult.value);
		} catch (error) {
			return err(
				`Failed to rename folder: ${systemPathToSplitPath.encode(from)} to ${systemPathToSplitPath.encode(to)}: ${error.message}`,
			);
		}
	}
}
