import { err, ok, type Result } from "neverthrow";
import { type FileManager, TFile, type Vault } from "obsidian";
import {
	errorBothSourceAndTargetNotFound,
	errorCreateFailed,
	errorCreationRaceCondition,
	errorGetByPath,
	errorRenameFailed,
	errorRetrieveRenamed,
	errorTrashDuplicateFile,
	errorTypeMismatch,
	errorWriteFailed,
} from "../../../errors";
import type { MdFileWithContentDto } from "../../../helpers/pathfinder";
import {
	findFirstAvailableIndexedPath,
	systemPathFromSplitPathInternal,
} from "../../../helpers/pathfinder";
import {
	type SplitPathFromTo,
	type SplitPathToFile,
	type SplitPathToMdFile,
	SplitPathType,
} from "../../../types/split-path";
import type { Transform } from "../../../types/vault-action";
import { type CollisionStrategy, getExistingBasenamesInFolder } from "./common";

/**
 * Helper for TFile operations in the vault.
 *
 * INVARIANT: The create / move commands assume that the target folders already exist.
 */
export class TFileHelper {
	private fileManager: FileManager;
	private vault: Vault;

	constructor({
		vault,
		fileManager,
	}: { vault: Vault; fileManager: FileManager }) {
		this.vault = vault;
		this.fileManager = fileManager;
	}

	async getFile<SPF extends SplitPathToMdFile | SplitPathToFile>(
		splitPath: SPF,
	): Promise<Result<TFile, string>> {
		const systemPath = systemPathFromSplitPathInternal(splitPath);
		const tAbstractFile = this.vault.getAbstractFileByPath(systemPath);
		if (!tAbstractFile) {
			return err(errorGetByPath("file", systemPath));
		}

		if (tAbstractFile instanceof TFile) {
			return ok(tAbstractFile);
		}

		return err(errorTypeMismatch("file", systemPath));
	}

	async upsertMdFile(
		file: MdFileWithContentDto,
	): Promise<Result<TFile, string>> {
		const { splitPath, content } = file;
		const fileResult = await this.getFile(splitPath);

		if (fileResult.isOk()) {
			return ok(fileResult.value); // Already exists
		}

		const systemPath = systemPathFromSplitPathInternal(splitPath);
		try {
			const createdFile = await this.vault.create(
				systemPath,
				content ?? "",
			);
			return ok(createdFile);
		} catch (error) {
			if (error.message?.includes("already exists")) {
				// Race condition: file was created by another process
				const existingResult = await this.getFile(splitPath);
				if (existingResult.isOk()) {
					return ok(existingResult.value);
				}
				return err(
					errorCreationRaceCondition(
						"file",
						systemPath,
						existingResult.error,
					),
				);
			}
			return err(errorCreateFailed("file", systemPath, error.message));
		}
	}

	async trashFile<SPF extends SplitPathToMdFile | SplitPathToFile>(
		splitPath: SPF,
	): Promise<Result<void, string>> {
		const fileResult = await this.getFile(splitPath);
		if (fileResult.isErr()) {
			// File already trashed
			return ok(undefined);
		}
		await this.fileManager.trashFile(fileResult.value);
		return ok(undefined);
	}

	async renameFile<SPF extends SplitPathToMdFile | SplitPathToFile>({
		from,
		to,
		collisionStrategy = "rename",
	}: SplitPathFromTo<SPF> & {
		collisionStrategy?: CollisionStrategy;
	}): Promise<Result<TFile, string>> {
		const fromResult = await this.getFile(from);
		const toResult = await this.getFile(to);

		if (fromResult.isErr()) {
			if (toResult.isErr()) {
				const fromPath = systemPathFromSplitPathInternal(from);
				const toPath = systemPathFromSplitPathInternal(to);
				return err(
					errorBothSourceAndTargetNotFound(
						"file",
						fromPath,
						toPath,
						toResult.error,
					),
				);
			}
			// FromFile not found, but ToFile found. Assume already moved.
			return ok(toResult.value);
		}

		// If source and target are the same file, no-op
		if (toResult.isOk() && fromResult.value === toResult.value) {
			return ok(fromResult.value);
		}

		if (toResult.isOk()) {
			if (to.type === SplitPathType.MdFile) {
				const targetContent = await this.vault.read(toResult.value);
				const sourceContent = await this.vault.read(fromResult.value);

				if (targetContent === sourceContent) {
					try {
						await this.fileManager.trashFile(fromResult.value);
						return ok(toResult.value);
					} catch (error) {
						return err(
							errorTrashDuplicateFile(
								systemPathFromSplitPathInternal(from),
								error.message,
							),
						);
					}
				}
			}

			// Target exists with different content
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
					systemPathFromSplitPathInternal(indexedPath),
				);
				const renamedResult = await this.getFile(indexedPath);
				if (renamedResult.isErr()) {
					return err(
						errorRetrieveRenamed(
							"file",
							systemPathFromSplitPathInternal(indexedPath),
							renamedResult.error,
						),
					);
				}
				return ok(renamedResult.value);
			} catch (error) {
				return err(
					errorRenameFailed(
						"file",
						systemPathFromSplitPathInternal(from),
						systemPathFromSplitPathInternal(indexedPath),
						error.message,
					),
				);
			}
		}

		try {
			await this.fileManager.renameFile(
				fromResult.value,
				systemPathFromSplitPathInternal(to),
			);
			const renamedResult = await this.getFile(to);
			if (renamedResult.isErr()) {
				return err(
					errorRetrieveRenamed(
						"file",
						systemPathFromSplitPathInternal(to),
						renamedResult.error,
					),
				);
			}
			return ok(renamedResult.value);
		} catch (error) {
			return err(
				errorRenameFailed(
					"file",
					systemPathFromSplitPathInternal(from),
					systemPathFromSplitPathInternal(to),
					error.message,
				),
			);
		}
	}

	async replaceAllContent(
		splitPath: SplitPathToMdFile,
		content: string,
	): Promise<Result<TFile, string>> {
		const fileResult = await this.getFile(splitPath);
		if (fileResult.isErr()) {
			return err(fileResult.error);
		}

		try {
			await this.vault.modify(fileResult.value, content);
			return ok(fileResult.value);
		} catch (error) {
			return err(
				errorWriteFailed(
					"file",
					systemPathFromSplitPathInternal(splitPath),
					error instanceof Error ? error.message : String(error),
				),
			);
		}
	}

	async processContent({
		splitPath,
		transform,
	}: {
		splitPath: SplitPathToMdFile;
		transform: Transform;
	}): Promise<Result<TFile, string>> {
		const fileResult = await this.getFile(splitPath);
		if (fileResult.isErr()) {
			return err(fileResult.error);
		}

		try {
			const before = await this.vault.read(fileResult.value);
			const after = await transform(before);

			if (after !== before) {
				await this.vault.modify(fileResult.value, after);
			}

			return ok(fileResult.value);
		} catch (error) {
			return err(
				errorWriteFailed(
					"file",
					systemPathFromSplitPathInternal(splitPath),
					error instanceof Error ? error.message : String(error),
				),
			);
		}
	}
}
