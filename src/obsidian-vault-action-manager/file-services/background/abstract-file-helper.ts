// import { type FileManager, TFile, TFolder, type Vault } from "obsidian";
// import {
// 	type Maybe,
// 	unwrapMaybeByThrowing,
// } from "../../../../types/common-interface/maybe";
// import type {
// 	AbstractFile,
// 	FileFromTo,
// 	FileWithContent,
// 	FullPath,
// 	FullPathToFolder,
// 	FullPathToMdFile,
// } from "../../atomic-services/pathfinder";
// import { systemPathFromFullPath } from "../../atomic-services/pathfinder";
// import { TFileHelper } from "./helpers/tfile-helper";
// import { LegacyTFolderHelper } from "./helpers/tfolder-helper";

// /**
//  * Orchestrates file and folder operations.
//  *
//  * This class performs SINGLE operations only.
//  */
// export class LegacyAbstractFileHelper {
// 	private vault: Vault;
// 	private tfileHelper: TFileHelper;
// 	private tfolderHelper: LegacyTFolderHelper;

// 	constructor({
// 		vault,
// 		fileManager,
// 	}: {
// 		vault: Vault;
// 		fileManager: FileManager;
// 	}) {
// 		this.vault = vault;
// 		this.tfileHelper = new TFileHelper({ fileManager, vault });
// 		this.tfolderHelper = new LegacyTFolderHelper({ fileManager, vault });
// 	}

// 	// ─── File Operations ─────────────────────────────────────────────

// 	async createFiles(files: readonly FileWithContent[]): Promise<void> {
// 		await this.tfileHelper.createMdFiles(files);
// 	}

// 	async moveFiles(fromTos: readonly FileFromTo[]): Promise<void> {
// 		await this.tfileHelper.renameFiles(fromTos);
// 	}

// 	async trashFiles(files: readonly FullPathToMdFile[]): Promise<void> {
// 		await this.tfileHelper.trashFiles(files);
// 	}

// 	// ─── Folder Operations ───────────────────────────────────────────

// 	async createFolder(fullPath: FullPathToFolder): Promise<TFolder> {
// 		return this.tfolderHelper.createFolder(fullPath);
// 	}

// 	async trashFolder(fullPath: FullPathToFolder): Promise<void> {
// 		return this.tfolderHelper.trashFolder(fullPath);
// 	}

// 	async renameFolder(
// 		from: FullPathToFolder,
// 		to: FullPathToFolder,
// 	): Promise<void> {
// 		return this.tfolderHelper.renameFolder(from, to);
// 	}

// 	// ─── Read Operations ─────────────────────────────────────────────

// 	async getMdFile(fullPath: FullPathToMdFile): Promise<TFile> {
// 		return unwrapMaybeByThrowing(await this.getMaybeAbstractFile(fullPath));
// 	}

// 	async getMaybeAbstractFile<T extends FullPath>(
// 		fullPath: T,
// 	): Promise<Maybe<AbstractFile<T>>> {
// 		const systemPath = systemPathFromFullPath(fullPath);
// 		const mbTabstractFile = this.vault.getAbstractFileByPath(systemPath);

// 		if (!mbTabstractFile) {
// 			return {
// 				description: `Failed to get file by path: ${systemPath}`,
// 				error: true,
// 			};
// 		}

// 		switch (fullPath.type) {
// 			case "file":
// 				if (mbTabstractFile instanceof TFile) {
// 					return {
// 						data: mbTabstractFile as AbstractFile<T>,
// 						error: false,
// 					};
// 				}
// 				break;
// 			case "folder":
// 				if (mbTabstractFile instanceof TFolder) {
// 					return {
// 						data: mbTabstractFile as AbstractFile<T>,
// 						error: false,
// 					};
// 				}
// 				break;

// 			default:
// 				break;
// 		}
// 		return {
// 			description: "Expected file type missmatched the found type",
// 			error: true,
// 		};
// 	}
// }
