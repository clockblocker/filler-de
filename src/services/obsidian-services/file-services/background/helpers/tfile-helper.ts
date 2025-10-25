import { type FileManager, TFile, type Vault } from "obsidian";
import {
	type Maybe,
	unwrapMaybeByThrowing,
} from "../../../../../types/common-interface/maybe";
import { logWarning } from "../../../helpers/issue-handlers";
import { systemPathFromSplitPath } from "../../pathfinder";
import type { FileFromTo, FileWithContent, SplitPathToFile } from "../../types";

/**
 * Helper for TFile operations in the vault.
 *
 * NOTE: The create and move commands assume that the target folders already exist.
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

	/**
	 * Get a TFile by its split path, throws if not found or not a file.
	 */
	async getFile(splitPath: SplitPathToFile): Promise<TFile> {
		const mbFile = await this.getMaybeFile(splitPath);
		return unwrapMaybeByThrowing(mbFile);
	}

	/**
	 * Create a file in an existing folder, or return it if it exists.
	 * Assumes the parent folder is already present.
	 */
	async createFile(file: FileWithContent): Promise<TFile> {
		return await this.getOrCreateOneFileInExistingFolder(file);
	}

	/**
	 * Create multiple files (in existing folders, or return if existing).
	 * Assumes all parent folders are already present.
	 */
	async createFiles(files: readonly FileWithContent[]): Promise<TFile[]> {
		return await Promise.all(files.map((file) => this.createFile(file)));
	}

	/**
	 * Trash a file by its split path.
	 */
	async trashFile(splitPath: SplitPathToFile): Promise<void> {
		const file = await this.getFile(splitPath);
		await this.fileManager.trashFile(file);
	}

	/**
	 * Trash multiple files by their split paths.
	 */
	async trashFiles(splitPaths: SplitPathToFile[]): Promise<void> {
		await Promise.all(
			splitPaths.map((splitPath) => this.trashFile(splitPath)),
		);
	}

	/**
	 * Move a file from a source to a destination.
	 * Assumes the target (to) folder already exists.
	 */
	async moveFile({ from, to }: FileFromTo): Promise<void> {
		const mbFromFile = await this.getMaybeFile(from);

		if (mbFromFile.error) {
			const mbToFile = await this.getMaybeFile(to);
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

		await this.fileManager.renameFile(
			mbFromFile.data,
			systemPathFromSplitPath(to),
		);
	}

	/**
	 * Move multiple files from source to destination.
	 * Assumes all target (to) folders already exist.
	 */
	async moveFiles(fromTos: readonly FileFromTo[]): Promise<void> {
		await Promise.all(fromTos.map((fromTo) => this.moveFile(fromTo)));
	}

	/**
	 * Get a Maybe<TFile> for a split path.
	 */
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

	/**
	 * Utility to get or create the file in an existing folder.
	 * Assumes the folder exists.
	 */
	private async getOrCreateOneFileInExistingFolder({
		splitPath,
		content,
	}: FileWithContent): Promise<TFile> {
		const mbFile = await this.getMaybeFile(splitPath);

		return mbFile.error
			? await this.createOneFileInExistingFolder({
					content,
					splitPath,
				})
			: mbFile.data;
	}

	/**
	 * Low-level: create a new file in an existing folder.
	 * Assumes the folder exists.
	 */
	private async createOneFileInExistingFolder({
		splitPath,
		content,
	}: FileWithContent): Promise<TFile> {
		const systemPath = systemPathFromSplitPath(splitPath);
		try {
			return await this.vault.create(systemPath, content ?? "");
		} catch (error) {
			logWarning({
				description: `Failed to create file (${systemPath}): ${error.message}`,
				location: "TFileHelper.createOneFileInExistingFolder",
			});

			if (error.message.includes("already exists")) {
				logWarning({
					description: `Race condition detected: File (${systemPath}) already created by another process`,
					location: "TFileHelper.createOneFileInExistingFolder",
				});
				return this.getFile(splitPath);
			}
			throw error;
		}
	}
}

// private async getOrCreateOneFileInExistingFolder({
// 	splitPath,
// 	content,
// }: FileWithContent): Promise<TFile> {
// 	const mbFile = await this.getMaybeFile(splitPath);

// 	return mbFile.error
// 		? await this.createOneFileInExistingFolder({
// 				content,
// 				splitPath,
// 			})
// 		: mbFile.data;
// }
