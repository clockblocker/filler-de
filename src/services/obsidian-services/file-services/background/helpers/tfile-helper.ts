import { type FileManager, TFile, type Vault } from "obsidian";
import {
	type Maybe,
	unwrapMaybeByThrowing,
} from "../../../../../types/common-interface/maybe";
import { logError, logWarning } from "../../../helpers/issue-handlers";
import { systemPathFromSplitPath } from "../../pathfinder";
import type { FileFromTo, FileWithContent, SplitPathToFile } from "../../types";

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

	async getFile(splitPath: SplitPathToFile): Promise<TFile> {
		const mbFile = await this.getMaybeFile(splitPath);
		return unwrapMaybeByThrowing(mbFile);
	}

	async createFile(file: FileWithContent): Promise<TFile> {
		return await this.getOrCreateOneFile(file);
	}

	async createFiles(files: readonly FileWithContent[]): Promise<TFile[]> {
		return await Promise.all(files.map((file) => this.createFile(file)));
	}

	async trashFile(splitPath: SplitPathToFile): Promise<void> {
		const file = await this.getFile(splitPath);
		await this.fileManager.trashFile(file);
	}

	async trashFiles(splitPaths: SplitPathToFile[]): Promise<void> {
		await Promise.all(
			splitPaths.map((splitPath) => this.trashFile(splitPath)),
		);
	}

	async moveFile({ from, to }: FileFromTo): Promise<void> {
		const mbFromFile = await this.getMaybeFile(from);
		const mbToFile = await this.getMaybeFile(to);

		if (mbFromFile.error) {
			if (mbToFile.error) {
				unwrapMaybeByThrowing(
					mbToFile,
					"TFileHelper.moveFile",
					`Both from (${systemPathFromSplitPath(from)}) and to (${systemPathFromSplitPath(to)}) files not found`,
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
				description: `Target file (${systemPathFromSplitPath(to)}) exists and it's content differs from the source file (${systemPathFromSplitPath(from)})`,
				location: "TFileHelper.moveFile",
			});

			return;
		}

		await this.fileManager.renameFile(
			mbFromFile.data,
			systemPathFromSplitPath(to),
		);
	}

	async moveFiles(fromTos: readonly FileFromTo[]): Promise<void> {
		await Promise.all(fromTos.map((fromTo) => this.moveFile(fromTo)));
	}

	private async getMaybeFile(
		splitPath: SplitPathToFile,
	): Promise<Maybe<TFile>> {
		const systemPath = systemPathFromSplitPath(splitPath);
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
			description: `Expected file type missmatched the found type: ${splitPath}`,
			error: true,
		};
	}

	private async getOrCreateOneFile({
		splitPath,
		content,
	}: FileWithContent): Promise<TFile> {
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
	}: FileWithContent): Promise<TFile> {
		const systemPath = systemPathFromSplitPath(splitPath);
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

// private async getOrCreateOneFile({
// 	splitPath,
// 	content,
// }: FileWithContent): Promise<TFile> {
// 	const mbFile = await this.getMaybeFile(splitPath);

// 	return mbFile.error
// 		? await this.createOneFile({
// 				content,
// 				splitPath,
// 			})
// 		: mbFile.data;
// }
