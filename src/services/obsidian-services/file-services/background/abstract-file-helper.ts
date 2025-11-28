import { type FileManager, TFile, TFolder, type Vault } from "obsidian";
import {
	type Maybe,
	unwrapMaybeByThrowing,
} from "../../../../types/common-interface/maybe";
import type {
	AbstractFile,
	FileFromTo,
	FileWithContent,
	FullPath,
	FullPathToFile,
	FullPathToFolder,
} from "../../atomic-services/pathfinder";
import { systemPathFromFullPath } from "../../atomic-services/pathfinder";
import { TFileHelper } from "./helpers/tfile-helper";
import { TFolderHelper } from "./helpers/tfolder-helper";

/**
 * Orchestrates file and folder operations.
 *
 * This class performs SINGLE operations only.
 */
export class AbstractFileHelper {
	private vault: Vault;
	private tfileHelper: TFileHelper;
	private tfolderHelper: TFolderHelper;

	constructor({
		vault,
		fileManager,
	}: {
		vault: Vault;
		fileManager: FileManager;
	}) {
		this.vault = vault;
		this.tfileHelper = new TFileHelper({ fileManager, vault });
		this.tfolderHelper = new TFolderHelper({ fileManager, vault });
	}

	// ─── File Operations ─────────────────────────────────────────────

	async createFiles(files: readonly FileWithContent[]): Promise<void> {
		await this.tfileHelper.createFiles(files);
	}

	async moveFiles(fromTos: readonly FileFromTo[]): Promise<void> {
		await this.tfileHelper.moveFiles(fromTos);
	}

	async trashFiles(files: readonly FullPathToFile[]): Promise<void> {
		await this.tfileHelper.trashFiles(files);
	}

	// ─── Folder Operations ───────────────────────────────────────────

	async createFolder(fullPath: FullPathToFolder): Promise<TFolder> {
		return this.tfolderHelper.createFolder(fullPath);
	}

	async trashFolder(fullPath: FullPathToFolder): Promise<void> {
		return this.tfolderHelper.trashFolder(fullPath);
	}

	async renameFolder(
		from: FullPathToFolder,
		to: FullPathToFolder,
	): Promise<void> {
		return this.tfolderHelper.renameFolder(from, to);
	}

	// ─── Read Operations ─────────────────────────────────────────────

	async getMdFile(fullPath: FullPathToFile): Promise<TFile> {
		return unwrapMaybeByThrowing(await this.getMaybeAbstractFile(fullPath));
	}

	async getMaybeAbstractFile<T extends FullPath>(
		fullPath: T,
	): Promise<Maybe<AbstractFile<T>>> {
		const systemPath = systemPathFromFullPath(fullPath);
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
						data: mbTabstractFile as AbstractFile<T>,
						error: false,
					};
				}
				break;
			case "folder":
				if (mbTabstractFile instanceof TFolder) {
					return {
						data: mbTabstractFile as AbstractFile<T>,
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

	async deepListMdFiles(folderFullPath: FullPathToFolder): Promise<TFile[]> {
		const folder = unwrapMaybeByThrowing(
			await this.getMaybeAbstractFile(folderFullPath),
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
