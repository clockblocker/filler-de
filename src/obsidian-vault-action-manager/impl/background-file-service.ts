import { type TFile, TFolder, type Vault } from "obsidian";
import type { TFileHelper } from "../file-services/background/helpers/tfile-helper";
import type { TFolderHelper } from "../file-services/background/helpers/tfolder-helper";
import { systemPathToSplitPath } from "../helpers/pathfinder";
import type {
	SplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../types/split-path";

export class BackgroundFileServiceLegacy {
	constructor(
		private readonly tfileHelper: TFileHelper,
		private readonly tfolderHelper: TFolderHelper,
		private readonly vault: Vault,
	) {}

	async readContent(target: SplitPathToMdFile): Promise<string> {
		const fileResult = await this.tfileHelper.getFile(target);
		if (fileResult.isErr()) {
			throw new Error(`File not found: ${fileResult.error}`);
		}
		return this.vault.read(fileResult.value);
	}

	async exists(target: SplitPath): Promise<boolean> {
		if (target.type === "Folder") {
			const result = await this.tfolderHelper.getFolder(target);
			return result.isOk();
		}
		const result = await this.tfileHelper.getFile(target);
		return result.isOk();
	}

	async list(folder: SplitPathToFolder): Promise<SplitPath[]> {
		const folderResult = await this.tfolderHelper.getFolder(folder);
		if (folderResult.isErr()) {
			return [];
		}
		const children = folderResult.value.children;
		return children.map((child) => {
			if (child instanceof TFolder) {
				return systemPathToSplitPath.decode(
					child.path,
				) as SplitPathToFolder;
			}
			return systemPathToSplitPath.decode(child.path) as SplitPathToFile;
		});
	}

	async getAbstractFile<SP extends SplitPath>(
		target: SP,
	): Promise<SP["type"] extends "Folder" ? TFolder : TFile> {
		if (target.type === "Folder") {
			const result = await this.tfolderHelper.getFolder(target);
			if (result.isErr()) {
				throw new Error(`Folder not found: ${result.error}`);
			}
			return result.value as SP["type"] extends "Folder"
				? TFolder
				: TFile;
		}
		const result = await this.tfileHelper.getFile(target);
		if (result.isErr()) {
			throw new Error(`File not found: ${result.error}`);
		}
		return result.value as SP["type"] extends "Folder" ? TFolder : TFile;
	}
}
