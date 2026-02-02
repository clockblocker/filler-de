import { err, ok, type Result, ResultAsync } from "neverthrow";
import { type FileManager, TFolder, type Vault } from "obsidian";
import { logger } from "../../../../../../utils/logger";
import {
	errorBothSourceAndTargetNotFound,
	errorCreateFailed,
	errorCreationRaceCondition,
	errorGetByPath,
	errorRenameFailed,
	errorRetrieveRenamed,
	errorTypeMismatch,
} from "../../../errors";
import { pathfinder } from "../../../helpers/pathfinder";
import type {
	SplitPathFromTo,
	SplitPathToFolder,
} from "../../../types/split-path";
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

	getFolder(splitPath: SplitPathToFolder): Result<TFolder, string> {
		const systemPath = pathfinder.systemPathFromSplitPath(splitPath);
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
		const existing = this.getFolder(splitPath);
		if (existing.isOk()) {
			return existing;
		}
		return this.tryVaultCreateFolder(splitPath);
	}

	private async tryVaultCreateFolder(
		splitPath: SplitPathToFolder,
	): Promise<Result<TFolder, string>> {
		const systemPath = pathfinder.systemPathFromSplitPath(splitPath);
		try {
			const createdFolder = await this.vault.createFolder(systemPath);
			return ok(createdFolder);
		} catch (error) {
			if (error.message?.includes("already exists")) {
				// Race condition: folder was created by another process
				return this.getFolder(splitPath).mapErr((getErr) =>
					errorCreationRaceCondition("folder", systemPath, getErr),
				);
			}
			return err(errorCreateFailed("folder", systemPath, error.message));
		}
	}

	async trashFolder(
		splitPath: SplitPathToFolder,
	): Promise<Result<void, string>> {
		const folderResult = this.getFolder(splitPath);
		if (folderResult.isErr()) {
			return ok(undefined); // Folder already gone
		}
		return ResultAsync.fromPromise(
			this.fileManager.trashFile(folderResult.value),
			() => "Failed to trash folder",
		).map(() => undefined);
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
		const fromResult = this.getFolder(from);
		const toResult = this.getFolder(to);

		if (fromResult.isErr()) {
			if (toResult.isErr()) {
				const fromPath = pathfinder.systemPathFromSplitPath(from);
				const toPath = pathfinder.systemPathFromSplitPath(to);
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
			// collisionStrategy === "rename"
			return this.renameToIndexedPath(fromResult.value, from, to);
		}

		return this.performRename(fromResult.value, to);
	}

	private async renameToIndexedPath(
		fromFolder: TFolder,
		from: SplitPathToFolder,
		to: SplitPathToFolder,
	): Promise<Result<TFolder, string>> {
		const existingBasenames = await getExistingBasenamesInFolder(
			to,
			this.vault,
		);
		const indexedPath = await pathfinder.findFirstAvailableIndexedPath(
			to,
			existingBasenames,
		);

		const renameResult = await this.tryVaultRename(
			fromFolder,
			indexedPath,
			from,
		);
		if (renameResult.isErr()) {
			return err(renameResult.error);
		}

		return this.getFolder(indexedPath).mapErr((getErr) =>
			errorRetrieveRenamed(
				"folder",
				pathfinder.systemPathFromSplitPath(indexedPath),
				getErr,
			),
		);
	}

	private performRename(
		fromFolder: TFolder,
		to: SplitPathToFolder,
	): ResultAsync<TFolder, string> {
		return this.tryVaultRename(fromFolder, to, to).andThen(() =>
			this.getFolder(to).mapErr((getErr) =>
				errorRetrieveRenamed(
					"folder",
					pathfinder.systemPathFromSplitPath(to),
					getErr,
				),
			),
		);
	}

	private tryVaultRename(
		folder: TFolder,
		to: SplitPathToFolder,
		from: SplitPathToFolder,
	): ResultAsync<void, string> {
		const toPath = pathfinder.systemPathFromSplitPath(to);
		return ResultAsync.fromPromise(
			this.fileManager.renameFile(folder, toPath),
			(error) => {
				const msg =
					error instanceof Error ? error.message : String(error);
				logger.error(
					"[TFolderHelper.renameFolder] vault.rename threw",
					JSON.stringify({ error: msg, to: toPath }),
				);
				return errorRenameFailed(
					"folder",
					pathfinder.systemPathFromSplitPath(from),
					toPath,
					msg,
				);
			},
		);
	}
}
