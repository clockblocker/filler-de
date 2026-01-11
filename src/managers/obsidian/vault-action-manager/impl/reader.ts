import { err, ok, type Result } from "neverthrow";
import { type TFile, TFolder, type Vault } from "obsidian";
import { logger } from "../../../../utils/logger";
import type { OpenedFileService } from "../file-services/active-view/opened-file-service";
import type { TFileHelper } from "../file-services/background/helpers/tfile-helper";
import type { TFolderHelper } from "../file-services/background/helpers/tfolder-helper";
import { splitPathFromAbstractInternal } from "../helpers/pathfinder";
import type {
	AnySplitPath,
	SplitPathToFile,
	SplitPathToFileWithTRef,
	SplitPathToFolder,
	SplitPathToFolderWithTRef,
	SplitPathToMdFile,
	SplitPathToMdFileWithTRef,
	SplitPathWithReader,
	SplitPathWithTRef,
} from "../types/split-path";
import { makeSystemPathForSplitPath } from "./common/split-path-and-system-path";

export class Reader {
	constructor(
		private readonly opened: OpenedFileService,
		private readonly tfileHelper: TFileHelper,
		private readonly tfolderHelper: TFolderHelper,
		private readonly vault: Vault,
	) {}

	async readContent(
		target: SplitPathToMdFile,
	): Promise<Result<string, string>> {
		if (await this.opened.isInActiveView(target)) {
			const content = await this.opened.readContent(target);
			return ok(content);
		}
		const fileResult = await this.tfileHelper.getFile(target);
		if (fileResult.isErr()) {
			return err(`File not found: ${fileResult.error}`);
		}
		try {
			const content = await this.vault.read(fileResult.value);
			return ok(content);
		} catch (error) {
			return err(error instanceof Error ? error.message : String(error));
		}
	}

	async exists(target: AnySplitPath): Promise<boolean> {
		if (await this.opened.exists(target)) return true;
		if (target.type === "Folder") {
			const result = await this.tfolderHelper.getFolder(target);
			return result.isOk();
		}
		const result = await this.tfileHelper.getFile(target);
		return result.isOk();
	}

	async list(
		folder: SplitPathToFolder,
	): Promise<Result<AnySplitPath[], string>> {
		const folderResult = await this.tfolderHelper.getFolder(folder);
		const fromBg: AnySplitPath[] = folderResult.isOk()
			? folderResult.value.children.map((child) => {
					if (child instanceof TFolder) {
						return splitPathFromAbstractInternal(
							child,
						) as SplitPathToFolder;
					}
					return splitPathFromAbstractInternal(
						child,
					) as SplitPathToFile;
				})
			: [];
		const fromOpened = await this.opened.list(folder);

		const dedup = new Map<string, AnySplitPath>();
		for (const entry of [...fromBg, ...fromOpened]) {
			dedup.set(makeSystemPathForSplitPath(entry), entry);
		}
		return ok(Array.from(dedup.values()));
	}

	async listAll(
		folder: SplitPathToFolder,
	): Promise<Result<SplitPathWithTRef[], string>> {
		const all: SplitPathWithTRef[] = [];
		const stack: SplitPathToFolder[] = [folder];

		while (stack.length > 0) {
			const current = stack.pop();
			if (!current) continue;

			const childrenResult = await this.list(current);
			if (childrenResult.isErr()) {
				// Skip on error, continue with other folders
				logger.warn(
					"[Reader] Failed to list folder:",
					current,
					childrenResult.error,
				);
				continue;
			}
			const children = childrenResult.value;
			for (const child of children) {
				const tRefResult = await this.getAbstractFile(child);
				if (tRefResult.isErr()) {
					// Skip files that can't be resolved (stale refs, deleted files)
					logger.warn(
						"[Reader] Skipping unresolvable path:",
						child,
						tRefResult.error,
					);
					continue;
				}
				const tRef = tRefResult.value;

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
			}
		}

		return ok(all);
	}

	async pwd(): Promise<Result<SplitPathToFile | SplitPathToMdFile, string>> {
		const result = await this.opened.pwd();
		if (result.isErr()) {
			return err(result.error);
		}
		return ok(result.value);
	}

	async getAbstractFile<SP extends AnySplitPath>(
		target: SP,
	): Promise<Result<SP["type"] extends "Folder" ? TFolder : TFile, string>> {
		if (await this.opened.exists(target)) {
			try {
				const file = await this.opened.getAbstractFile(target);
				return ok(file);
			} catch (error) {
				return err(
					error instanceof Error ? error.message : String(error),
				);
			}
		}
		if (target.type === "Folder") {
			const result = await this.tfolderHelper.getFolder(target);
			if (result.isErr()) {
				return err(`Folder not found: ${result.error}`);
			}
			return ok(
				result.value as SP["type"] extends "Folder" ? TFolder : TFile,
			);
		}
		const result = await this.tfileHelper.getFile(target);
		if (result.isErr()) {
			return err(`File not found: ${result.error}`);
		}
		return ok(
			result.value as SP["type"] extends "Folder" ? TFolder : TFile,
		);
	}

	async listAllFilesWithMdReaders(
		folder: SplitPathToFolder,
	): Promise<Result<SplitPathWithReader[], string>> {
		const all: SplitPathWithReader[] = [];
		const stack: SplitPathToFolder[] = [folder];

		while (stack.length > 0) {
			const current = stack.pop();
			if (!current) continue;

			const childrenResult = await this.list(current);
			if (childrenResult.isErr()) {
				return err(childrenResult.error);
			}
			const children = childrenResult.value;
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

		return ok(all);
	}
}

export type ReaderApi = {
	readContent: (p: SplitPathToMdFile) => Promise<Result<string, string>>;
	exists: (p: AnySplitPath) => Promise<boolean>;
	list: (p: SplitPathToFolder) => Promise<Result<AnySplitPath[], string>>;
	listAll: (
		p: SplitPathToFolder,
	) => Promise<Result<SplitPathWithTRef[], string>>;
	pwd: () => Promise<Result<SplitPathToFile | SplitPathToMdFile, string>>;
	getAbstractFile: <SP extends AnySplitPath>(
		p: SP,
	) => Promise<Result<SP["type"] extends "Folder" ? TFolder : TFile, string>>;
};
