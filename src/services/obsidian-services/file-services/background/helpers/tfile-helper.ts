import { type FileManager, TFile, type Vault } from "obsidian";
import {
	logError,
	logWarning,
} from "../../../../../obsidian-vault-action-manager/helpers/issue-handlers";
import {
	type MaybeLegacy,
	unwrapMaybeLegacyByThrowing,
} from "../../../../../types/common-interface/maybe";
import type {
	LegacyFileFromTo,
	LegacyFileWithContent,
	LegacyFullPathToMdFile,
} from "../../../atomic-services/pathfinder";
import { legacySystemPathFromFullPath } from "../../../atomic-services/pathfinder";

/**
 * Helper for TFile operations in the vault.
 *
 * INVARIANT: The create / move commands assume that the target folders already exist.
 */
export class LegacyTFileHelper {
	private fileManager: FileManager;
	private vault: Vault;

	constructor({
		vault,
		fileManager,
	}: { vault: Vault; fileManager: FileManager }) {
		this.vault = vault;
		this.fileManager = fileManager;
	}

	async getFile(fullPath: LegacyFullPathToMdFile): Promise<TFile> {
		const mbFile = await this.getMaybeLegacyFile(fullPath);
		return unwrapMaybeLegacyByThrowing(mbFile);
	}

	async createFiles(
		files: readonly LegacyFileWithContent[],
	): Promise<TFile[]> {
		const tFiles: TFile[] = [];
		for (const file of files) {
			tFiles.push(await this.createFile(file));
		}
		return tFiles;
	}

	async trashFiles(
		fullPaths: readonly LegacyFullPathToMdFile[],
	): Promise<void> {
		for (const fullPath of fullPaths) {
			await this.trashFile(fullPath);
		}
	}

	async moveFiles(fromTos: readonly LegacyFileFromTo[]): Promise<void> {
		for (const fromTo of fromTos) {
			await this.moveFile(fromTo);
		}
	}

	private async createFile(file: LegacyFileWithContent): Promise<TFile> {
		return await this.getOrCreateOneFile(file);
	}

	private async trashFile(fullPath: LegacyFullPathToMdFile): Promise<void> {
		const file = await this.getFile(fullPath);
		await this.fileManager.trashFile(file);
	}

	private async moveFile({ from, to }: LegacyFileFromTo): Promise<void> {
		const mbFromFile = await this.getMaybeLegacyFile(from);
		const mbToFile = await this.getMaybeLegacyFile(to);

		if (mbFromFile.error) {
			if (mbToFile.error) {
				unwrapMaybeLegacyByThrowing(
					mbToFile,
					"TFileHelper.moveFile",
					`Both source \n(${legacySystemPathFromFullPath(from)}) \n and target \n (${legacySystemPathFromFullPath(to)}) \n files not found`,
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
				description: `Target file (${legacySystemPathFromFullPath(to)}) exists and it's content differs from the source file (${legacySystemPathFromFullPath(from)})`,
				location: "TFileHelper.moveFile",
			});

			return;
		}

		await this.fileManager.renameFile(
			mbFromFile.data,
			legacySystemPathFromFullPath(to),
		);
	}

	private async getMaybeLegacyFile(
		fullPath: LegacyFullPathToMdFile,
	): Promise<MaybeLegacy<TFile>> {
		const systemPath = legacySystemPathFromFullPath(fullPath);
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
	}: LegacyFileWithContent): Promise<TFile> {
		const mbFile = await this.getMaybeLegacyFile(fullPath);

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
	}: LegacyFileWithContent): Promise<TFile> {
		const systemPath = legacySystemPathFromFullPath(fullPath);
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
