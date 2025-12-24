import type { TFile, TFolder } from "obsidian";
import { logger } from "../../utils/logger";
import type { OpenedFileService } from "../file-services/active-view/opened-file-service";
import type {
	SplitPath,
	SplitPathToFile,
	SplitPathToFileWithTRef,
	SplitPathToFolder,
	SplitPathToFolderWithTRef,
	SplitPathToMdFile,
	SplitPathToMdFileWithTRef,
	SplitPathWithReader,
	SplitPathWithTRef,
} from "../types/split-path";
import type { BackgroundFileServiceLegacy } from "./background-file-service";
import { makeSystemPathForSplitPath } from "./split-path";

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
			dedup.set(makeSystemPathForSplitPath(entry), entry);
		}
		return Array.from(dedup.values());
	}

	async listAll(folder: SplitPathToFolder): Promise<SplitPathWithTRef[]> {
		const all: SplitPathWithTRef[] = [];
		const stack: SplitPathToFolder[] = [folder];

		while (stack.length > 0) {
			const current = stack.pop();
			if (!current) continue;

			const children = await this.list(current);
			for (const child of children) {
				try {
					const tRef = await this.getAbstractFile(child);

					if (child.type === "Folder") {
						all.push({
							...child,
							tRef: tRef as unknown as TFolder,
						} as SplitPathToFolderWithTRef);
						stack.push(child);
					} else if (child.type === "MdFile") {
						all.push({
							...child,
							tRef: tRef as unknown as TFile,
						} as SplitPathToMdFileWithTRef);
					} else {
						all.push({
							...child,
							tRef: tRef as unknown as TFile,
						} as SplitPathToFileWithTRef);
					}
				} catch (error) {
					// Skip files that can't be resolved (stale refs, deleted files)
					logger.warn(
						"[Reader] Skipping unresolvable path:",
						child,
						error,
					);
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

	async listAllFilesWithMdReaders(
		folder: SplitPathToFolder,
	): Promise<SplitPathWithReader[]> {
		const all: SplitPathWithReader[] = [];
		const stack: SplitPathToFolder[] = [folder];

		while (stack.length > 0) {
			const current = stack.pop();
			if (!current) continue;

			const children = await this.list(current);
			for (const child of children) {
				if (child.type === "Folder") {
					stack.push(child);
				} else if (child.type === "MdFile") {
					// Attach read function (no tRef needed)
					all.push({
						...child,
						read: () => this.readContent(child),
					});
				} else {
					// File - no reader needed
					all.push(child);
				}
			}
		}

		return all;
	}
}

export type ReaderApi = {
	readContent: (p: SplitPathToMdFile) => Promise<string>;
	exists: (p: SplitPath) => Promise<boolean>;
	list: (p: SplitPathToFolder) => Promise<SplitPath[]>;
	listAll: (p: SplitPathToFolder) => Promise<SplitPathWithTRef[]>;
	pwd: () => Promise<SplitPathToFile | SplitPathToMdFile>;
	getAbstractFile: <SP extends SplitPath>(
		p: SP,
	) => Promise<SP["type"] extends "Folder" ? TFolder : TFile>;
};
