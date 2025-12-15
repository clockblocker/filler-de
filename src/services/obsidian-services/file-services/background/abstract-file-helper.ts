import { type FileManager, TFile, TFolder, type Vault } from "obsidian";
import {
	type MaybeLegacy,
	unwrapMaybeLegacyByThrowing,
} from "../../../../types/common-interface/maybe";
import type {
	LegacyAbstractFile,
	LegacyFileFromTo,
	LegacyFileWithContent,
	LegacyFullPath,
	LegacyFullPathToFolder,
	LegacyFullPathToMdFile,
} from "../../atomic-services/pathfinder";
import { legacySystemPathFromFullPath } from "../../atomic-services/pathfinder";
import { LegacyTFileHelper } from "./helpers/tfile-helper";
import { LegacyTFolderHelper } from "./helpers/tfolder-helper";

/**
 * Orchestrates file and folder operations.
 *
 * This class performs SINGLE operations only.
 */
export class LegacyAbstractFileHelper {
	private vault: Vault;
	private tfileHelper: LegacyTFileHelper;
	private tfolderHelper: LegacyTFolderHelper;

	constructor({
		vault,
		fileManager,
	}: {
		vault: Vault;
		fileManager: FileManager;
	}) {
		this.vault = vault;
		this.tfileHelper = new LegacyTFileHelper({ fileManager, vault });
		this.tfolderHelper = new LegacyTFolderHelper({ fileManager, vault });
	}

	// ─── File Operations ─────────────────────────────────────────────

	async createFiles(files: readonly LegacyFileWithContent[]): Promise<void> {
		await this.tfileHelper.createFiles(files);
	}

	async moveFiles(fromTos: readonly LegacyFileFromTo[]): Promise<void> {
		await this.tfileHelper.moveFiles(fromTos);
	}

	async trashFiles(files: readonly LegacyFullPathToMdFile[]): Promise<void> {
		await this.tfileHelper.trashFiles(files);
	}

	// ─── Folder Operations ───────────────────────────────────────────

	async createFolder(fullPath: LegacyFullPathToFolder): Promise<TFolder> {
		return this.tfolderHelper.createFolder(fullPath);
	}

	async trashFolder(fullPath: LegacyFullPathToFolder): Promise<void> {
		return this.tfolderHelper.trashFolder(fullPath);
	}

	async renameFolder(
		from: LegacyFullPathToFolder,
		to: LegacyFullPathToFolder,
	): Promise<void> {
		return this.tfolderHelper.renameFolder(from, to);
	}

	// ─── Read Operations ─────────────────────────────────────────────

	async getMdFile(fullPath: LegacyFullPathToMdFile): Promise<TFile> {
		return unwrapMaybeLegacyByThrowing(
			await this.getMaybeLegacyAbstractFile(fullPath),
		);
	}

	async getMaybeLegacyAbstractFile<T extends LegacyFullPath>(
		fullPath: T,
	): Promise<MaybeLegacy<LegacyAbstractFile<T>>> {
		const systemPath = legacySystemPathFromFullPath(fullPath);
		const mbTabstractFile = this.vault.getAbstractFileByPath(systemPath);

		if (!mbTabstractFile) {
			return {
				description: `Failed to get file by path: ${systemPath}`,
				error: true,
			};
		}

		switch (fullPath.type) {
			case "file":
				if (mbTabstractFile instanceof TFile) {
					return {
						data: mbTabstractFile as LegacyAbstractFile<T>,
						error: false,
					};
				}
				break;
			case "folder":
				if (mbTabstractFile instanceof TFolder) {
					return {
						data: mbTabstractFile as LegacyAbstractFile<T>,
						error: false,
					};
				}
				break;

			default:
				break;
		}
		return {
			description: "Expected file type missmatched the found type",
			error: true,
		};
	}

	async deepListMdFiles(
		folderFullPath: LegacyFullPathToFolder,
	): Promise<TFile[]> {
		const folder = unwrapMaybeLegacyByThrowing(
			await this.getMaybeLegacyAbstractFile(folderFullPath),
			"AbstractFileHelper.deepListMdFiles",
		);

		const out: TFile[] = [];
		const stack: TFolder[] = [folder];

		while (stack.length > 0) {
			const current = stack.pop();
			if (!current) {
				continue;
			}

			for (const child of current.children) {
				if (child instanceof TFolder) {
					stack.push(child);
					continue;
				}

				if (
					child instanceof TFile &&
					child.extension.toLowerCase() === "md"
				) {
					out.push(child);
				}
			}
		}

		return out;
	}
}
