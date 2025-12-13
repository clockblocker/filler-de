import { err, ok, type Result } from "neverthrow";
import { type FileManager, TFile, TFolder, type Vault } from "obsidian";
import {
	logError,
	logWarning,
} from "../../../../obsidian-vault-action-manager/helpers/issue-handlers";
import type { MdFileWithContentDto } from "../../../../obsidian-vault-action-manager/helpers/pathfinder";
import {
	findFirstAvailableIndexedPath,
	pathToFolderFromPathParts,
	systemPathToSplitPath,
} from "../../../../obsidian-vault-action-manager/helpers/pathfinder";
import type {
	SplitPathFromTo,
	SplitPathToMdFile,
} from "../../../../obsidian-vault-action-manager/types/split-path";

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

	async getFile(splitPath: SplitPathToMdFile): Promise<TFile> {
		const result = await this.getFileResult(splitPath);
		return result.match(
			(file) => file,
			(error) => {
				throw new Error(error);
			},
		);
	}

	async createFiles(
		files: readonly MdFileWithContentDto[],
	): Promise<TFile[]> {
		const tFiles: TFile[] = [];
		for (const file of files) {
			tFiles.push(await this.createFile(file));
		}
		return tFiles;
	}

	async trashFiles(splitPaths: readonly SplitPathToMdFile[]): Promise<void> {
		for (const splitPath of splitPaths) {
			await this.trashFile(splitPath);
		}
	}

	async moveFiles(
		fromTos: readonly SplitPathFromTo<SplitPathToMdFile>[],
	): Promise<void> {
		for (const fromTo of fromTos) {
			await this.moveFile(fromTo);
		}
	}

	private async createFile(file: MdFileWithContentDto): Promise<TFile> {
		return await this.getOrCreateOneFile(file);
	}

	private async trashFile(splitPath: SplitPathToMdFile): Promise<void> {
		const file = await this.getFile(splitPath);
		await this.fileManager.trashFile(file);
	}

	private async moveFile({
		from,
		to,
	}: SplitPathFromTo<SplitPathToMdFile>): Promise<void> {
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

		if (toResult.isOk()) {
			const targetContent = await this.vault.read(toResult.value);
			const sourceContent = await this.vault.read(fromResult.value);

			if (targetContent === sourceContent) {
				await this.fileManager.trashFile(fromResult.value);
				return;
			}

			// Target exists with different content - find first available indexed name
			const existingBasenames =
				await this.getExistingBasenamesInFolder(to);
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

	async getFileResult(
		splitPath: SplitPathToMdFile,
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

	private async getOrCreateOneFile({
		splitPath,
		content,
	}: MdFileWithContentDto): Promise<TFile> {
		const fileResult = await this.getFileResult(splitPath);

		if (fileResult.isOk()) {
			return fileResult.value;
		}

		return await this.safelyCreateNewFile({
			content,
			splitPath,
		});
	}

	private async safelyCreateNewFile({
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

	/**
	 * Gets all existing basenames of .md files in the target folder.
	 */
	private async getExistingBasenamesInFolder(
		target: SplitPathToMdFile,
	): Promise<Set<string>> {
		const folderPath = pathToFolderFromPathParts(target.pathParts);
		const targetFolder = this.vault.getAbstractFileByPath(folderPath);

		const existingBasenames = new Set<string>();

		if (targetFolder && targetFolder instanceof TFolder) {
			for (const child of targetFolder.children) {
				if (child instanceof TFile && child.extension === "md") {
					existingBasenames.add(child.basename);
				}
			}
		}

		return existingBasenames;
	}
}
