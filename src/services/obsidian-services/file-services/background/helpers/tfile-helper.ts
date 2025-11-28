import { type FileManager, TFile, type Vault } from "obsidian";
import {
	type Maybe,
	unwrapMaybeByThrowing,
} from "../../../../../types/common-interface/maybe";
import type {
	FileFromTo,
	FileWithContent,
	FullPathToFile,
} from "../../../atomic-services/pathfinder";
import { systemPathFromFullPath } from "../../../atomic-services/pathfinder";
import { logError, logWarning } from "../../../helpers/issue-handlers";

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

	async getFile(fullPath: FullPathToFile): Promise<TFile> {
		const mbFile = await this.getMaybeFile(fullPath);
		return unwrapMaybeByThrowing(mbFile);
	}

	async createFiles(files: readonly FileWithContent[]): Promise<TFile[]> {
		const tFiles: TFile[] = [];
		for (const file of files) {
			tFiles.push(await this.createFile(file));
		}
		return tFiles;
	}

	async trashFiles(fullPaths: readonly FullPathToFile[]): Promise<void> {
		for (const fullPath of fullPaths) {
			await this.trashFile(fullPath);
		}
	}

	async moveFiles(fromTos: readonly FileFromTo[]): Promise<void> {
		for (const fromTo of fromTos) {
			await this.moveFile(fromTo);
		}
	}

	private async createFile(file: FileWithContent): Promise<TFile> {
		return await this.getOrCreateOneFile(file);
	}

	private async trashFile(fullPath: FullPathToFile): Promise<void> {
		const file = await this.getFile(fullPath);
		await this.fileManager.trashFile(file);
	}

	private async moveFile({ from, to }: FileFromTo): Promise<void> {
		const mbFromFile = await this.getMaybeFile(from);
		const mbToFile = await this.getMaybeFile(to);

		if (mbFromFile.error) {
			if (mbToFile.error) {
				unwrapMaybeByThrowing(
					mbToFile,
					"TFileHelper.moveFile",
					`Both source \n(${systemPathFromFullPath(from)}) \n and target \n (${systemPathFromFullPath(to)}) \n files not found`,
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

			logError({
				description: `Target file (${systemPathFromFullPath(to)}) exists and it's content differs from the source file (${systemPathFromFullPath(from)})`,
				location: "TFileHelper.moveFile",
			});

			return;
		}

		await this.fileManager.renameFile(
			mbFromFile.data,
			systemPathFromFullPath(to),
		);
	}

	private async getMaybeFile(
		fullPath: FullPathToFile,
	): Promise<Maybe<TFile>> {
		const systemPath = systemPathFromFullPath(fullPath);
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
			description: `Expected file type missmatched the found type: ${fullPath}`,
			error: true,
		};
	}

	private async getOrCreateOneFile({
		fullPath,
		content,
	}: FileWithContent): Promise<TFile> {
		const mbFile = await this.getMaybeFile(fullPath);

		return mbFile.error
			? await this.safelyCreateNewFile({
					content,
					fullPath,
				})
			: mbFile.data;
	}

	private async safelyCreateNewFile({
		fullPath,
		content,
	}: FileWithContent): Promise<TFile> {
		const systemPath = systemPathFromFullPath(fullPath);
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
				return this.getFile(fullPath);
			}
			throw error;
		}
	}
}
