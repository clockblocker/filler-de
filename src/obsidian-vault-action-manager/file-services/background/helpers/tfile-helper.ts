import { err, ok, type Result } from "neverthrow";
import { type FileManager, TFile, type Vault } from "obsidian";
import type { MdFileWithContentDto } from "../../../../obsidian-vault-action-manager/helpers/pathfinder";
import {
	findFirstAvailableIndexedPath,
	systemPathToSplitPath,
} from "../../../../obsidian-vault-action-manager/helpers/pathfinder";
import {
	type SplitPathFromTo,
	type SplitPathToFile,
	type SplitPathToMdFile,
	SplitPathType,
} from "../../../../obsidian-vault-action-manager/types/split-path";
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
		const systemPath = systemPathToSplitPath.encode(splitPath);
		const tAbstractFile = this.vault.getAbstractFileByPath(systemPath);
		if (!tAbstractFile) {
			return err(`Failed to get file by path: ${systemPath}`);
		}

		if (tAbstractFile instanceof TFile) {
			return ok(tAbstractFile);
		}

		return err(
			`Expected file type missmatched the found type: ${systemPath}`,
		);
	}

	async createMdFile(
		file: MdFileWithContentDto,
	): Promise<Result<TFile, string>> {
		const { splitPath, content } = file;
		const fileResult = await this.getFile(splitPath);

		if (fileResult.isOk()) {
			return ok(fileResult.value); // Already exists
		}

		const systemPath = systemPathToSplitPath.encode(splitPath);
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
					`File creation race condition: ${systemPath} was created but cannot be retrieved: ${existingResult.error}`,
				);
			}
			return err(
				`Failed to create file: ${systemPath}: ${error.message}`,
			);
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
				const fromPath = systemPathToSplitPath.encode(from);
				const toPath = systemPathToSplitPath.encode(to);
				return err(
					`Both source (${fromPath}) and target (${toPath}) files not found: ${toResult.error}`,
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
							`Failed to trash duplicate file: ${systemPathToSplitPath.encode(from)}: ${error.message}`,
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
					systemPathToSplitPath.encode(indexedPath),
				);
				const renamedResult = await this.getFile(indexedPath);
				if (renamedResult.isErr()) {
					return err(
						`Failed to retrieve renamed file: ${systemPathToSplitPath.encode(indexedPath)}: ${renamedResult.error}`,
					);
				}
				return ok(renamedResult.value);
			} catch (error) {
				return err(
					`Failed to rename file: ${systemPathToSplitPath.encode(from)} to ${systemPathToSplitPath.encode(indexedPath)}: ${error.message}`,
				);
			}
		}

		try {
			await this.fileManager.renameFile(
				fromResult.value,
				systemPathToSplitPath.encode(to),
			);
			const renamedResult = await this.getFile(to);
			if (renamedResult.isErr()) {
				return err(
					`Failed to retrieve renamed file: ${systemPathToSplitPath.encode(to)}: ${renamedResult.error}`,
				);
			}
			return ok(renamedResult.value);
		} catch (error) {
			return err(
				`Failed to rename file: ${systemPathToSplitPath.encode(from)} to ${systemPathToSplitPath.encode(to)}: ${error.message}`,
			);
		}
	}
}
