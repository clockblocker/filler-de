import {
	type App,
	MarkdownView,
	type TAbstractFile,
	TFile,
	TFolder,
} from "obsidian";
import type {
	CoreSplitPath,
	SplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../types/split-path";
import { splitPath as buildSplitPath, splitPathKey } from "./split-path";

const MD_EXTENSION = "md";

export class OpenedFileService {
	constructor(private readonly app: App) {}

	async readContent(splitPath: SplitPathToMdFile): Promise<string> {
		const file = this.getFile(splitPath);
		if (!file)
			throw new Error(`File not found: ${splitPathKey(splitPath)}`);
		if (file.extension !== MD_EXTENSION) {
			throw new Error(`Expected md file: ${splitPathKey(splitPath)}`);
		}
		return this.app.vault.read(file);
	}

	async exists(splitPath: SplitPath): Promise<boolean> {
		return this.getAbstract(splitPath) !== null;
	}

	async writeContent(
		target: SplitPathToMdFile,
		content: string,
	): Promise<void> {
		const activeView = this.getActiveMarkdownView();
		if (activeView && activeView.file?.path === splitPathKey(target)) {
			const editor = activeView.editor;
			const cursor = editor.getCursor();
			editor.setValue(content);
			editor.setCursor(cursor);
			editor.scrollIntoView(
				{
					from: cursor,
					to: cursor,
				},
				true,
			);
			return;
		}

		const file = this.getFile(target);
		if (!file) throw new Error(`File not found: ${splitPathKey(target)}`);
		if (file.extension !== MD_EXTENSION) {
			throw new Error(`Expected md file: ${splitPathKey(target)}`);
		}
		await this.app.vault.modify(file, content);
	}

	async renameFile(
		from: SplitPathToFile | SplitPathToMdFile,
		to: SplitPathToFile | SplitPathToMdFile,
	): Promise<void> {
		const file = this.getFile(from);
		if (!file) throw new Error(`File not found: ${splitPathKey(from)}`);
		await this.app.fileManager.renameFile(file, splitPathKey(to));
	}

	async trashFile(
		target: SplitPathToFile | SplitPathToMdFile,
	): Promise<void> {
		const file = this.getFile(target);
		if (!file) return;
		await this.app.vault.delete(file);
	}

	async list(folderPath: SplitPathToFolder): Promise<SplitPath[]> {
		const folder = this.getFolder(folderPath);
		if (!folder) return [];
		return folder.children.map((child) =>
			buildSplitPath(child as unknown as TAbstractFile),
		);
	}

	async pwd(): Promise<SplitPathToFile | SplitPathToMdFile> {
		const active = this.app.workspace.getActiveFile();
		if (!active) {
			throw new Error("No active file");
		}
		const split = buildSplitPath(active);
		// Active file cannot be a folder; trusted from Obsidian API
		return split;
	}

	async isInActiveView(target: SplitPath): Promise<boolean> {
		const active = this.app.workspace.getActiveFile();
		if (!active) return false;
		return active.path === splitPathKey(target);
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

	private getFile(splitPath: SplitPath): TFile | null {
		const abstract = this.getAbstract(splitPath);
		return abstract instanceof TFile ? abstract : null;
	}

	private getFolder(splitPath: SplitPath): TFolder | null {
		const abstract = this.getAbstract(splitPath);
		return abstract instanceof TFolder ? abstract : null;
	}

	private getActiveMarkdownView(): MarkdownView | null {
		return this.app.workspace.getActiveViewOfType(MarkdownView);
	}
}

export { splitPath, splitPathKey } from "./split-path";
