import { err, ok, type Result, ResultAsync } from "neverthrow";
import type { TFile, TFolder, Vault } from "obsidian";
import { logger } from "../../../../utils/logger";
import type { ActiveFileService } from "../file-services/active-view/active-file-service";
import type { TFileHelper } from "../file-services/background/helpers/tfile-helper";
import type { TFolderHelper } from "../file-services/background/helpers/tfolder-helper";
import { pathfinder } from "../helpers/pathfinder";
import type { DiscriminatedTAbstractFile } from "../helpers/pathfinder/types";
import {
	classifyReadContentError,
	type ReadContentError,
} from "../types/read-content-error";
import type {
	AnySplitPath,
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
		private readonly active: ActiveFileService,
		private readonly tfileHelper: TFileHelper,
		private readonly tfolderHelper: TFolderHelper,
		private readonly vault: Vault,
	) {}

	async readContent(
		target: SplitPathToMdFile,
	): Promise<Result<string, ReadContentError>> {
		if (this.active.isInActiveView(target)) {
			return this.active
				.getContent()
				.mapErr((reason) => classifyReadContentError(reason));
		}
		return this.tfileHelper
			.getFile(target)
			.mapErr((reason) => classifyReadContentError(reason))
			.asyncAndThen((file) =>
				ResultAsync.fromPromise(this.vault.read(file), (error) =>
					classifyReadContentError(
						error instanceof Error ? error.message : String(error),
					),
				),
			);
	}

	exists(target: AnySplitPath): boolean {
		if (target.kind === "Folder") {
			return this.tfolderHelper.getFolder(target).isOk();
		}
		return this.tfileHelper.getFile(target).isOk();
	}

	list(folder: SplitPathToFolder): Result<AnySplitPath[], string> {
		return this.tfolderHelper
			.getFolder(folder)
			.mapErr((e) => `Folder not found: ${e}`)
			.map((tfolder) =>
				tfolder.children.map((child) =>
					pathfinder.splitPathFromAbstract(child),
				),
			);
	}

	listAll(folder: SplitPathToFolder): Result<SplitPathWithTRef[], string> {
		const all: SplitPathWithTRef[] = [];
		const stack: SplitPathToFolder[] = [folder];

		while (stack.length > 0) {
			const current = stack.pop();
			if (!current) continue;

			const childrenResult = this.list(current);
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
				const tRefResult = this.getAbstractFile(child);
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

	getAbstractFile<SP extends AnySplitPath>(
		target: SP,
	): Result<DiscriminatedTAbstractFile<SP>, string> {
		type ReturnT = DiscriminatedTAbstractFile<SP>;
		if (target.kind === "Folder") {
			return this.tfolderHelper
				.getFolder(target)
				.mapErr((e) => `Folder not found: ${e}`)
				.map((v) => v as ReturnT);
		}
		return this.tfileHelper
			.getFile(target)
			.mapErr((e) => `File not found: ${e}`)
			.map((v) => v as ReturnT);
	}

	findByBasename(
		basename: string,
		opts?: { folder?: SplitPathToFolder },
	): SplitPathToMdFile[] {
		const folderPrefix = opts?.folder
			? `${pathfinder.systemPathFromSplitPath(opts.folder)}/`
			: undefined;

		return this.vault
			.getMarkdownFiles()
			.filter((f) => {
				if (f.basename !== basename) return false;
				if (folderPrefix && !f.path.startsWith(folderPrefix))
					return false;
				return true;
			})
			.map(
				(f) => pathfinder.splitPathFromAbstract(f) as SplitPathToMdFile,
			);
	}

	listAllFilesWithMdReaders(
		folder: SplitPathToFolder,
	): Result<SplitPathWithReader[], string> {
		const all: SplitPathWithReader[] = [];
		const stack: SplitPathToFolder[] = [folder];

		while (stack.length > 0) {
			const current = stack.pop();
			if (!current) continue;

			const childrenResult = this.list(current);
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
