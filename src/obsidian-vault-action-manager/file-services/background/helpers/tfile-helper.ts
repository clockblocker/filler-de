import { type FileManager, TFile, type Vault } from "obsidian";
import {
	logError,
	logWarning,
} from "../../../../obsidian-vault-action-manager/helpers/issue-handlers";
import type { MdFileWithContentDto } from "../../../../obsidian-vault-action-manager/helpers/pathfinder";
import { systemPathToSplitPath } from "../../../../obsidian-vault-action-manager/helpers/pathfinder";
import type {
	SplitPathFromTo,
	SplitPathToMdFile,
} from "../../../../obsidian-vault-action-manager/types/split-path";
import {
	type Maybe,
	unwrapMaybeByThrowing,
} from "../../../../types/common-interface/maybe";

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
		const mbFile = await this.getMaybeFile(splitPath);
		return unwrapMaybeByThrowing(mbFile);
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
		const mbFromFile = await this.getMaybeFile(from);
		const mbToFile = await this.getMaybeFile(to);

		if (mbFromFile.error) {
			if (mbToFile.error) {
				const fromPath = systemPathToSplitPath.encode(from);
				const toPath = systemPathToSplitPath.encode(to);
				unwrapMaybeByThrowing(
					mbToFile,
					"TFileHelper.moveFile",
					`Both source \n(${fromPath}) \n and target \n (${toPath}) \n files not found`,
				);
			}

			// FromFile not found, but ToFile found. Assume the file is already correctly moved.
			return;
		}

		if (!mbToFile.error) {
			const targetContent = await this.vault.read(mbToFile.data);
			const sourceContent = await this.vault.read(mbFromFile.data);

			if (targetContent === sourceContent) {
				await this.fileManager.trashFile(mbFromFile.data);
				return;
			}

			const fromPath = systemPathToSplitPath.encode(from);
			const toPath = systemPathToSplitPath.encode(to);
			logError({
				description: `Target file (${toPath}) exists and it's content differs from the source file (${fromPath})`,
				location: "TFileHelper.moveFile",
			});

			return;
		}

		await this.fileManager.renameFile(
			mbFromFile.data,
			systemPathToSplitPath.encode(to),
		);
	}

	private async getMaybeFile(
		splitPath: SplitPathToMdFile,
	): Promise<Maybe<TFile>> {
		const systemPath = systemPathToSplitPath.encode(splitPath);
		const tAbstractFile = this.vault.getAbstractFileByPath(systemPath);
		if (!tAbstractFile) {
			return {
				description: `Failed to get file by path: ${systemPath}`,
				error: true,
			};
		}

		if (tAbstractFile instanceof TFile) {
			return {
				data: tAbstractFile,
				error: false,
			};
		}

		return {
			description: `Expected file type missmatched the found type: ${systemPath}`,
			error: true,
		};
	}

	private async getOrCreateOneFile({
		splitPath,
		content,
	}: MdFileWithContentDto): Promise<TFile> {
		const mbFile = await this.getMaybeFile(splitPath);

		return mbFile.error
			? await this.safelyCreateNewFile({
					content,
					splitPath,
				})
			: mbFile.data;
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
}
