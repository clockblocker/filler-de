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
import {
	errorBothSourceAndTargetNotFound,
	errorCreateFailed,
	errorCreationRaceCondition,
	errorGetByPath,
	errorRenameFailed,
	errorRetrieveRenamed,
	errorTypeMismatch,
} from "../../../errors";
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
			return err(errorGetByPath("folder", systemPath));
		}

		if (tAbstractFile instanceof TFolder) {
			return ok(tAbstractFile);
		}

		return err(errorTypeMismatch("folder", systemPath));
	}

	/**
	 * Create a single folder.
	 * Obsidian's vault.createFolder automatically creates parent folders if they don't exist.
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
					errorCreationRaceCondition(
						"folder",
						systemPath,
						existingResult.error,
					),
				);
			}
			return err(errorCreateFailed("folder", systemPath, error.message));
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
					errorBothSourceAndTargetNotFound(
						"folder",
						fromPath,
						toPath,
						toResult.error,
					),
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
						errorRetrieveRenamed(
							"folder",
							systemPathToSplitPath.encode(indexedPath),
							renamedResult.error,
						),
					);
				}
				return ok(renamedResult.value);
			} catch (error) {
				return err(
					errorRenameFailed(
						"folder",
						systemPathToSplitPath.encode(from),
						systemPathToSplitPath.encode(indexedPath),
						error.message,
					),
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
					errorRetrieveRenamed(
						"folder",
						systemPathToSplitPath.encode(to),
						renamedResult.error,
					),
				);
			}
			return ok(renamedResult.value);
		} catch (error) {
			return err(
				errorRenameFailed(
					"folder",
					systemPathToSplitPath.encode(from),
					systemPathToSplitPath.encode(to),
					error.message,
				),
			);
		}
	}
}
