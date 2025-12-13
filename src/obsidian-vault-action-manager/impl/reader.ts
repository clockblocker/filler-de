import type { TFile, TFolder } from "obsidian";
import type { OpenedFileService } from "../file-services/active-view/opened-file-service";
import type {
	SplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../types/split-path";
import { splitPathKey } from "./split-path";

export class Reader {
	constructor(
		private readonly opened: OpenedFileService,
		private readonly background: BackgroundFileService,
	) {}

	async readContent(target: SplitPathToMdFile): Promise<string> {
		if (await this.opened.isInActiveView(target)) {
			return this.opened.readContent(target);
		}
		return this.background.readContent(target);
	}

	async exists(target: SplitPath): Promise<boolean> {
		if (await this.opened.exists(target)) return true;
		return this.background.exists(target);
	}

	async list(folder: SplitPathToFolder): Promise<SplitPath[]> {
		const fromBg = await this.background.list(folder);
		const fromOpened = await this.opened.list(folder);

		const dedup = new Map<string, SplitPath>();
		for (const entry of [...fromBg, ...fromOpened]) {
			dedup.set(splitPathKey(entry), entry);
		}
		return Array.from(dedup.values());
	}

	async pwd(): Promise<SplitPathToFile | SplitPathToMdFile> {
		return this.opened.pwd();
	}

	async getAbstractFile<SP extends SplitPath>(
		target: SP,
	): Promise<SP["type"] extends "Folder" ? TFolder : TFile> {
		if (await this.opened.exists(target)) {
			return this.opened.getAbstractFile(target);
		}
		return this.background.getAbstractFile(target);
	}
}

export type ReaderApi = {
	readContent: (p: SplitPathToMdFile) => Promise<string>;
	exists: (p: SplitPath) => Promise<boolean>;
	list: (p: SplitPathToFolder) => Promise<SplitPath[]>;
	pwd: () => Promise<SplitPathToFile | SplitPathToMdFile>;
	getAbstractFile: <SP extends SplitPath>(
		p: SP,
	) => Promise<SP["type"] extends "Folder" ? TFolder : TFile>;
};
