import { err, ok, type Result, ResultAsync } from "neverthrow";
import { type TFile, TFolder, type Vault } from "obsidian";
import { logger } from "../../../../utils/logger";
import type { OpenedFileService } from "../file-services/active-view/opened-file-service";
import type { TFileHelper } from "../file-services/background/helpers/tfile-helper";
import type { TFolderHelper } from "../file-services/background/helpers/tfolder-helper";
import { pathfinder } from "../helpers/pathfinder";
import type { DiscriminatedTAbstractFile } from "../helpers/pathfinder/types";
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

export class VaultReader {
	constructor(
		private readonly opened: OpenedFileService,
		private readonly tfileHelper: TFileHelper,
		private readonly tfolderHelper: TFolderHelper,
		private readonly vault: Vault,
	) {}

	async readContent(
		target: SplitPathToMdFile,
	): Promise<Result<string, string>> {
		if (this.opened.isInActiveView(target)) {
			return this.opened.getContent();
		}
		return ResultAsync.fromSafePromise(this.tfileHelper.getFile(target))
			.andThen((res) => res.mapErr((e) => `File not found: ${e}`))
			.andThen((file) =>
				ResultAsync.fromPromise(this.vault.read(file), (e) =>
					e instanceof Error ? e.message : String(e),
				),
			);
	}

	async exists(target: AnySplitPath): Promise<boolean> {
		if (target.kind === "Folder") {
			const result = await this.tfolderHelper.getFolder(target);
			return result.isOk();
		}
		const result = await this.tfileHelper.getFile(target);
		return result.isOk();
	}

	async list(
		folder: SplitPathToFolder,
	): Promise<Result<AnySplitPath[], string>> {
		return (await this.tfolderHelper.getFolder(folder))
			.mapErr((e) => `Folder not found: ${e}`)
			.map((tfolder) =>
				tfolder.children.map((child) =>
					pathfinder.splitPathFromAbstract(child),
				),
			);
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
					"[VaultReader] Failed to list folder:",
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
						"[VaultReader] Skipping unresolvable path:",
						child,
						tRefResult.error,
					);
					continue;
				}
				const tRef = tRefResult.value;

				if (child.kind === "Folder") {
					all.push({
						...child,
						tRef: tRef as unknown as TFolder,
					} as SplitPathToFolderWithTRef);
					stack.push(child);
				} else if (child.kind === "MdFile") {
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

	pwd(): Result<SplitPathToFile | SplitPathToMdFile, string> {
		return this.opened.pwd();
	}

	async getAbstractFile<SP extends AnySplitPath>(
		target: SP,
	): Promise<Result<DiscriminatedTAbstractFile<SP>, string>> {
		type ReturnT = DiscriminatedTAbstractFile<SP>;
		if (target.kind === "Folder") {
			return (await this.tfolderHelper.getFolder(target))
				.mapErr((e) => `Folder not found: ${e}`)
				.map((v) => v as ReturnT);
		}
		return (await this.tfileHelper.getFile(target))
			.mapErr((e) => `File not found: ${e}`)
			.map((v) => v as ReturnT);
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
				if (child.kind === "Folder") {
					stack.push(child);
				} else if (child.kind === "MdFile") {
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
