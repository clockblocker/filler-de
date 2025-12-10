import { type App, type TAbstractFile, TFile, TFolder } from "obsidian";
import type {
	CoreSplitPath,
	SplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../types/split-path";
import { splitPath as buildSplitPath, splitPathKey } from "./split-path";

const MD_EXTENSION = "md";

function coreSplitPathToPath(core: CoreSplitPath): string {
	return [...core.pathParts, core.basename].join("/");
}

export class BackgroundFileService {
	constructor(private readonly app: App) {}

	async readContent(target: SplitPathToMdFile): Promise<string> {
		const file = this.getFile(target);
		if (!file) throw new Error(`File not found: ${splitPathKey(target)}`);
		if (file.extension !== MD_EXTENSION)
			throw new Error(`Expected md file: ${splitPathKey(target)}`);
		return this.app.vault.read(file);
	}

	async exists(target: SplitPath): Promise<boolean> {
		return (
			this.app.vault.getAbstractFileByPath(splitPathKey(target)) !== null
		);
	}

	async list(folderPath: SplitPathToFolder): Promise<SplitPath[]> {
		const folder = this.getFolder(folderPath);
		if (!folder) return [];
		return folder.children.map((child) =>
			buildSplitPath(child as unknown as TAbstractFile),
		);
	}

	async createFolder(target: SplitPathToFolder): Promise<TFolder> {
		return this.app.vault.createFolder(coreSplitPathToPath(target));
	}

	async trashFolder(target: SplitPathToFolder): Promise<void> {
		const folder = this.getFolder(target);
		if (!folder) return;
		await this.app.vault.delete(folder, true);
	}

	async renameFolder(from: SplitPathToFolder, to: SplitPathToFolder) {
		const folder = this.getFolder(from);
		if (!folder)
			throw new Error(`Folder not found: ${coreSplitPathToPath(from)}`);
		await this.app.vault.rename(folder, coreSplitPathToPath(to));
	}

	async createFile(
		target: SplitPathToFile | SplitPathToMdFile,
		content = "",
	): Promise<TFile> {
		const path = splitPathKey(target);
		return this.app.vault.create(path, content);
	}

	async trashFile(
		target: SplitPathToFile | SplitPathToMdFile,
	): Promise<void> {
		const file = this.getFile(target);
		if (!file) return;
		await this.app.vault.delete(file);
	}

	async renameFile(
		from: SplitPathToFile | SplitPathToMdFile,
		to: SplitPathToFile | SplitPathToMdFile,
	): Promise<void> {
		const file = this.getFile(from);
		if (!file) throw new Error(`File not found: ${splitPathKey(from)}`);
		await this.app.vault.rename(file, splitPathKey(to));
	}

	async writeFile(target: SplitPathToMdFile, content: string): Promise<void> {
		const file = this.getFile(target);
		if (!file) throw new Error(`File not found: ${splitPathKey(target)}`);
		if (file.extension !== MD_EXTENSION)
			throw new Error(`Expected md file: ${splitPathKey(target)}`);
		await this.app.vault.modify(file, content);
	}

	async processMdFile(
		target: SplitPathToMdFile,
		transform: (content: string) => Promise<string> | string,
	): Promise<void> {
		const file = this.getFile(target);
		if (!file) throw new Error(`File not found: ${splitPathKey(target)}`);
		if (file.extension !== MD_EXTENSION)
			throw new Error(`Expected md file: ${splitPathKey(target)}`);
		const current = await this.app.vault.read(file);
		const next = await transform(current);
		await this.app.vault.modify(file, next);
	}

	async getAbstractFile<SP extends SplitPath>(
		target: SP,
	): Promise<SP["type"] extends "Folder" ? TFolder : TFile> {
		const abstract = this.getAbstract(target);
		if (!abstract) {
			throw new Error(`Not found: ${splitPathKey(target)}`);
		}
		if (abstract instanceof TFolder) {
			return abstract as SP["type"] extends "Folder" ? TFolder : TFile;
		}
		return abstract as SP["type"] extends "Folder" ? TFolder : TFile;
	}

	private getAbstract(splitPath: CoreSplitPath): TAbstractFile | null {
		return this.app.vault.getAbstractFileByPath(splitPathKey(splitPath));
	}

	private getFile(splitPath: CoreSplitPath): TFile | null {
		const abstract = this.getAbstract(splitPath);
		return abstract instanceof TFile ? abstract : null;
	}

	private getFolder(splitPath: CoreSplitPath): TFolder | null {
		const abstract = this.getAbstract(splitPath);
		return abstract instanceof TFolder ? abstract : null;
	}
}

export { splitPath, splitPathKey } from "./split-path";
