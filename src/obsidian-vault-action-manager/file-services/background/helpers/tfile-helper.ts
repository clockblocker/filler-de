import { err, ok, type Result } from "neverthrow";
import { type FileManager, TFile, type Vault } from "obsidian";
import {
	logError,
	logWarning,
} from "../../../../obsidian-vault-action-manager/helpers/issue-handlers";
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

	async getMdFile(splitPath: SplitPathToMdFile): Promise<TFile> {
		return await this.getFile(splitPath);
	}

	async getFile<SPF extends SplitPathToMdFile | SplitPathToFile>(
		splitPath: SPF,
	): Promise<TFile> {
		const result = await this.getFileResult(splitPath);
		return result.match(
			(file) => file,
			(error) => {
				throw new Error(error);
			},
		);
	}

	async createMdFiles(
		files: readonly MdFileWithContentDto[],
	): Promise<TFile[]> {
		const tFiles: TFile[] = [];
		for (const file of files) {
			tFiles.push(await this.createMdFile(file));
		}
		return tFiles;
	}

	async trashFiles(
		splitPaths: readonly (SplitPathToMdFile | SplitPathToFile)[],
	): Promise<void> {
		for (const splitPath of splitPaths) {
			await this.trashFile(splitPath);
		}
	}

	async renameFiles<SPF extends SplitPathToMdFile | SplitPathToFile>(
		fromTos: readonly SplitPathFromTo<SPF>[],
		collisionStrategy?: CollisionStrategy,
	): Promise<void> {
		for (const fromTo of fromTos) {
			await this.renameFile({ ...fromTo, collisionStrategy });
		}
	}

	private async createMdFile(file: MdFileWithContentDto): Promise<TFile> {
		return await this.getOrCreateOneMdFile(file);
	}

	private async trashFile<SPF extends SplitPathToMdFile | SplitPathToFile>(
		splitPath: SPF,
	): Promise<void> {
		const file = await this.getFile(splitPath);
		await this.fileManager.trashFile(file);
	}

	private async renameFile<SPF extends SplitPathToMdFile | SplitPathToFile>({
		from,
		to,
		collisionStrategy = "rename",
	}: SplitPathFromTo<SPF> & {
		collisionStrategy?: CollisionStrategy;
	}): Promise<void> {
		const fromResult = await this.getFileResult(from);
		const toResult = await this.getFileResult(to);

		if (fromResult.isErr()) {
			if (toResult.isErr()) {
				const fromPath = systemPathToSplitPath.encode(from);
				const toPath = systemPathToSplitPath.encode(to);
				const error = toResult.error;
				logError({
					description: `Both source \n(${fromPath}) \n and target \n (${toPath}) \n files not found: ${error}`,
					location: "TFileHelper.moveFile",
				});
				throw new Error(
					`Both source (${fromPath}) and target (${toPath}) files not found`,
				);
			}

			// FromFile not found, but ToFile found. Assume the file is already correctly moved.
			return;
		}

		// If source and target are the same file, no-op
		if (toResult.isOk() && fromResult.value === toResult.value) {
			return;
		}

		if (toResult.isOk()) {
			if (to.type === SplitPathType.MdFile) {
				const targetContent = await this.vault.read(toResult.value);
				const sourceContent = await this.vault.read(fromResult.value);

				if (targetContent === sourceContent) {
					await this.fileManager.trashFile(fromResult.value);
					return;
				}
			}

			// Target exists with different content
			if (collisionStrategy === "skip") {
				logWarning({
					description: `Target file (${systemPathToSplitPath.encode(to)}) exists with different content, skipping move`,
					location: "TFileHelper.moveFile",
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

	async getFileResult<SPF extends SplitPathToMdFile | SplitPathToFile>(
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

	private async getOrCreateOneMdFile({
		splitPath,
		content,
	}: MdFileWithContentDto): Promise<TFile> {
		const fileResult = await this.getFileResult(splitPath);

		if (fileResult.isOk()) {
			return fileResult.value;
		}

		return await this.safelyCreateNewMdFile({
			content,
			splitPath,
		});
	}

	private async safelyCreateNewMdFile({
		splitPath,
		content,
	}: MdFileWithContentDto): Promise<TFile> {
		const systemPath = systemPathToSplitPath.encode(splitPath);
		try {
			return await this.vault.create(systemPath, content ?? "");
		} catch (error) {
			logWarning({
				description: `Failed to create file (${systemPath}): ${error.message}`,
				location: "TFileHelper.createOneFile",
			});

			if (error.message.includes("already exists")) {
				logWarning({
					description: `Race condition detected: File (${systemPath}) already created by another process`,
					location: "TFileHelper.createOneFile",
				});
				return this.getFile(splitPath);
			}
			throw error;
		}
	}
}
