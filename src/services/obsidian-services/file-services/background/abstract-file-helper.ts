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

	async createFiles(files: readonly FileWithContent[]): Promise<void> {
		const splitPathToParentFolders = files.map(({ splitPath }) =>
			this.getSplitPathToParentFolder(splitPath),
		);

		await this.tfolderHelper.createFolderChains(splitPathToParentFolders);
		await this.tfileHelper.createFiles(files);
	}

	async moveFiles(fromTos: readonly FileFromTo[]): Promise<void> {
		const splitPathsToParentTargetFolders = fromTos.map(({ from, to }) => ({
			from: this.getSplitPathToParentFolder(from),
			to: this.getSplitPathToParentFolder(to),
		}));

		await this.tfolderHelper.createFolderChains(
			splitPathsToParentTargetFolders.map(({ to }) => to),
		);

		await this.tfileHelper.moveFiles(fromTos);

		await this.tfolderHelper.cleanUpFolderChains(
			splitPathsToParentTargetFolders.map(({ from }) => from),
		);
	}

	async trashFiles(files: readonly SplitPathToFile[]): Promise<void> {
		const splitPathsToParentTargetFolders = files.map((file) =>
			this.getSplitPathToParentFolder(file),
		);

		await this.tfileHelper.trashFiles(files);

		await this.tfolderHelper.cleanUpFolderChains(
			splitPathsToParentTargetFolders,
		);
	}

	private getSplitPathToParentFolder(
		splitPathToFile: SplitPathToFile,
	): SplitPathToFolder {
		return unwrapMaybeByThrowing(
			this.getMaybeSplitPathToParentFolder(splitPathToFile),
			"AbstractFileHelper.createFiles",
		);
	}

	private getMaybeSplitPathToParentFolder(
		splitPathToFile: SplitPathToFile,
	): Maybe<SplitPathToFolder> {
		const filePathParts = [...splitPathToFile.pathParts];

		if (filePathParts.length < 2) {
			return {
				description: "Expected at least 2 path parts for file",
				error: true,
			};
		}

		const basename = filePathParts.pop() ?? "";
		const pathParts = filePathParts;

		return {
			data: {
				basename,
				pathParts,
				type: "folder",
			},
			error: false,
		};
	}

	async getMdFile(splitPath: SplitPathToFile): Promise<TFile> {
		return unwrapMaybeByThrowing(
			await this.getMaybeAbstractFile(splitPath),
		);
	}

	async getMaybeAbstractFile<T extends SplitPath>(
		splitPath: T,
	): Promise<Maybe<AbstractFile<T>>> {
		const systemPath = systemPathFromSplitPath(splitPath);
		console.log("this.vault", this.vault);
		console.log(
			"systemPath",
			this.vault.getAbstractFileByPath("Grammatik"),
		);
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
		// Resolve the folder (throws if not found / not a folder)
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
