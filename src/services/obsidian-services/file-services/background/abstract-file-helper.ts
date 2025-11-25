import { type FileManager, TFile, TFolder, type Vault } from "obsidian";
import {
	type Maybe,
	unwrapMaybeByThrowing,
} from "../../../../types/common-interface/maybe";
import { systemPathFromSplitPath } from "../pathfinder";
import type {
	AbstractFile,
	FileFromTo,
	FileWithContent,
	SplitPath,
	SplitPathToFile,
	SplitPathToFolder,
} from "../types";
import { TFileHelper } from "./helpers/tfile-helper";
import { TFolderHelper } from "./helpers/tfolder-helper";

/**
 * Orchestrates file and folder operations.
 *
 * NOTE: Chain logic (create parent folders before files, cleanup empty folders)
 * is now handled by DiffToActionsMapper + VaultActionQueue.
 *
 * This class performs SINGLE operations only.
 * @see src/commanders/librarian/diffing/diff-to-actions.ts
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

	async trashFiles(files: readonly SplitPathToFile[]): Promise<void> {
		await this.tfileHelper.trashFiles(files);
	}

	// ─── Folder Operations ───────────────────────────────────────────

	async createFolder(splitPath: SplitPathToFolder): Promise<TFolder> {
		return this.tfolderHelper.createFolder(splitPath);
	}

	async trashFolder(splitPath: SplitPathToFolder): Promise<void> {
		return this.tfolderHelper.trashFolder(splitPath);
	}

	async renameFolder(
		from: SplitPathToFolder,
		to: SplitPathToFolder,
	): Promise<void> {
		return this.tfolderHelper.renameFolder(from, to);
	}

	// ─── Read Operations ─────────────────────────────────────────────

	async getMdFile(splitPath: SplitPathToFile): Promise<TFile> {
		return unwrapMaybeByThrowing(
			await this.getMaybeAbstractFile(splitPath),
		);
	}

	async getMaybeAbstractFile<T extends SplitPath>(
		splitPath: T,
	): Promise<Maybe<AbstractFile<T>>> {
		const systemPath = systemPathFromSplitPath(splitPath);
		const mbTabstractFile = this.vault.getAbstractFileByPath(systemPath);

		if (!mbTabstractFile) {
			return {
				description: `Failed to get file by path: ${systemPath}`,
				error: true,
			};
		}

		switch (splitPath.type) {
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

	async deepListMdFiles(
		folderSplitPath: SplitPathToFolder,
	): Promise<TFile[]> {
		const folder = unwrapMaybeByThrowing(
			await this.getMaybeAbstractFile(folderSplitPath),
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
