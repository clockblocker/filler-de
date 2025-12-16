import type { TFile, TFolder } from "obsidian";
import type { OpenedFileService } from "../file-services/active-view/opened-file-service";
import type {
	SplitPath,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../types/split-path";
import type { BackgroundFileServiceLegacy } from "./background-file-service";
import { splitPathKey } from "./split-path";

export class Reader {
	constructor(
		private readonly opened: OpenedFileService,
		private readonly background: BackgroundFileServiceLegacy,
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

	async listAll(folder: SplitPathToFolder): Promise<SplitPath[]> {
		const all: SplitPath[] = [];
		const stack: SplitPathToFolder[] = [folder];

		while (stack.length > 0) {
			const current = stack.pop();
			if (!current) continue;

			const children = await this.list(current);
			for (const child of children) {
				all.push(child);
				if (child.type === "Folder") {
					stack.push(child);
				}
			}
		}

		return all;
	}

	async pwd(): Promise<SplitPathToFile | SplitPathToMdFile> {
		const result = await this.opened.pwd();
		if (result.isErr()) {
			throw new Error(result.error);
		}
		return result.value;
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
	listAll: (p: SplitPathToFolder) => Promise<SplitPath[]>;
	pwd: () => Promise<SplitPathToFile | SplitPathToMdFile>;
	getAbstractFile: <SP extends SplitPath>(
		p: SP,
	) => Promise<SP["type"] extends "Folder" ? TFolder : TFile>;
};
