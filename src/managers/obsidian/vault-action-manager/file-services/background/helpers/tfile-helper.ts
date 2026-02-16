import { err, ok, type Result, ResultAsync } from "neverthrow";
import { type FileManager, TFile, type Vault } from "obsidian";
import { logger } from "../../../../../../utils/logger";
import {
	errorBothSourceAndTargetNotFound,
	errorCreateFailed,
	errorCreationRaceCondition,
	errorGetByPath,
	errorRenameFailed,
	errorRetrieveRenamed,
	errorTrashDuplicateFile,
	errorTypeMismatch,
	errorWriteFailed,
} from "../../../errors";
import {
	type MdFileWithContentDto,
	pathfinder,
} from "../../../helpers/pathfinder";
import {
	type SplitPathFromTo,
	SplitPathKind,
	type SplitPathToAnyFile,
	type SplitPathToMdFile,
} from "../../../types/split-path";
import type { Transform } from "../../../types/vault-action";
import { type CollisionStrategy, getExistingBasenamesInFolder } from "./common";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Helper for TFile operations in the vault.
 *
 * INVARIANT: The create / move commands assume that the target folders already exist.
 */
export class TFileHelper {
	private fileManager: FileManager;
	private vault: Vault;

	constructor({
		vault,
		fileManager,
	}: { vault: Vault; fileManager: FileManager }) {
		this.vault = vault;
		this.fileManager = fileManager;
	}

	getFile<SPF extends SplitPathToAnyFile>(
		splitPath: SPF,
	): Result<TFile, string> {
		const systemPath = pathfinder.systemPathFromSplitPath(splitPath);
		const tAbstractFile = this.vault.getAbstractFileByPath(systemPath);
		if (!tAbstractFile) {
			return err(errorGetByPath("file", systemPath));
		}

		if (tAbstractFile instanceof TFile) {
			return ok(tAbstractFile);
		}

		return err(errorTypeMismatch("file", systemPath));
	}

	async upsertMdFile(
		file: MdFileWithContentDto,
	): Promise<Result<TFile, string>> {
		const { splitPath, content } = file;
		const existing = this.getFile(splitPath);
		if (existing.isOk()) {
			return existing;
		}
		return this.tryVaultCreate(splitPath, content ?? "");
	}

	private async tryVaultCreate(
		splitPath: SplitPathToMdFile,
		content: string,
	): Promise<Result<TFile, string>> {
		const systemPath = pathfinder.systemPathFromSplitPath(splitPath);
		try {
			const createdFile = await this.vault.create(systemPath, content);
			return ok(createdFile);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			if (msg.includes("already exists")) {
				// Race condition: file was created by another process
				return this.getFile(splitPath).mapErr((getErr) =>
					errorCreationRaceCondition("file", systemPath, getErr),
				);
			}
			return err(errorCreateFailed("file", systemPath, msg));
		}
	}

	async trashFile<SPF extends SplitPathToAnyFile>(
		splitPath: SPF,
	): Promise<Result<void, string>> {
		const fileResult = this.getFile(splitPath);
		if (fileResult.isErr()) {
			return ok(undefined); // File already gone
		}
		return ResultAsync.fromPromise(
			this.fileManager.trashFile(fileResult.value),
			() => "Failed to trash file",
		).map(() => undefined);
	}

	async renameFile<SPF extends SplitPathToAnyFile>({
		from,
		to,
		collisionStrategy = "rename",
	}: SplitPathFromTo<SPF> & {
		collisionStrategy?: CollisionStrategy;
	}): Promise<Result<TFile, string>> {
		const resolved = await this.resolveRenamePaths(from, to);
		if (resolved.isErr()) {
			return err(resolved.error);
		}
		const { fromFile, toFile } = resolved.value;
		return toFile
			? this.handleTargetCollision(
					fromFile,
					toFile,
					from,
					to,
					collisionStrategy,
				)
			: this.performRename(fromFile, to);
	}

	private async resolveRenamePaths<SPF extends SplitPathToAnyFile>(
		from: SPF,
		to: SPF,
	): Promise<Result<{ fromFile: TFile; toFile: TFile | null }, string>> {
		let fromResult = this.getFile(from);
		const toResult = this.getFile(to);

		// Both missing - poll for source (Obsidian index may lag after folder renames)
		if (fromResult.isErr() && toResult.isErr()) {
			fromResult = await this.pollForFile(from, 10);
		}

		if (fromResult.isErr()) {
			// FromFile not found, but ToFile found → already moved
			if (toResult.isOk()) {
				return ok({ fromFile: toResult.value, toFile: toResult.value });
			}
			const fromPath = pathfinder.systemPathFromSplitPath(from);
			const toPath = pathfinder.systemPathFromSplitPath(to);
			logger.error(
				"[TFileHelper.renameFile] Both from and to not found",
				JSON.stringify({ from: fromPath, to: toPath }),
			);
			return err(
				errorBothSourceAndTargetNotFound(
					"file",
					fromPath,
					toPath,
					toResult.error,
				),
			);
		}

		// Same file reference → no-op, signal by returning fromFile as both
		if (toResult.isOk() && fromResult.value === toResult.value) {
			return ok({ fromFile: fromResult.value, toFile: fromResult.value });
		}

		return ok({
			fromFile: fromResult.value,
			toFile: toResult.isOk() ? toResult.value : null,
		});
	}

	private async pollForFile<SPF extends SplitPathToAnyFile>(
		splitPath: SPF,
		maxRetries: number,
	): Promise<Result<TFile, string>> {
		const retryDelayMs = 50;
		for (let retry = 0; retry < maxRetries; retry++) {
			await delay(retryDelayMs);
			const result = this.getFile(splitPath);
			if (result.isOk()) {
				return result;
			}
		}
		return this.getFile(splitPath);
	}

	private async handleTargetCollision<SPF extends SplitPathToAnyFile>(
		fromFile: TFile,
		toFile: TFile,
		from: SPF,
		to: SPF,
		collisionStrategy: CollisionStrategy,
	): Promise<Result<TFile, string>> {
		// Same file reference → no-op
		if (fromFile === toFile) {
			return ok(fromFile);
		}

		// Check for duplicate content in md files
		if (to.kind === SplitPathKind.MdFile) {
			const [targetContent, sourceContent] = await Promise.all([
				this.vault.read(toFile),
				this.vault.read(fromFile),
			]);

			if (targetContent === sourceContent) {
				return this.trashDuplicate(fromFile, from).map(() => toFile);
			}
		}

		// Target exists with different content
		if (collisionStrategy === "skip") {
			return ok(toFile);
		}

		// collisionStrategy === "rename"
		return this.renameToIndexedPath(fromFile, from, to);
	}

	private trashDuplicate<SPF extends SplitPathToAnyFile>(
		file: TFile,
		splitPath: SPF,
	): ResultAsync<void, string> {
		return ResultAsync.fromPromise(
			this.fileManager.trashFile(file),
			(error) =>
				errorTrashDuplicateFile(
					pathfinder.systemPathFromSplitPath(splitPath),
					error instanceof Error ? error.message : String(error),
				),
		);
	}

	private async renameToIndexedPath<SPF extends SplitPathToAnyFile>(
		fromFile: TFile,
		from: SPF,
		to: SPF,
	): Promise<Result<TFile, string>> {
		const existingBasenames = await getExistingBasenamesInFolder(
			to,
			this.vault,
		);
		const indexedPath = await pathfinder.findFirstAvailableIndexedPath(
			to,
			existingBasenames,
		);

		const renameResult = await this.tryVaultRename(
			fromFile,
			indexedPath,
			from,
		);
		if (renameResult.isErr()) {
			return err(renameResult.error);
		}

		return this.getFile(indexedPath).mapErr((getErr) =>
			errorRetrieveRenamed(
				"file",
				pathfinder.systemPathFromSplitPath(indexedPath),
				getErr,
			),
		);
	}

	private performRename<SPF extends SplitPathToAnyFile>(
		fromFile: TFile,
		to: SPF,
	): ResultAsync<TFile, string> {
		return this.tryVaultRename(fromFile, to, to).andThen(() =>
			this.getFile(to).mapErr((getErr) =>
				errorRetrieveRenamed(
					"file",
					pathfinder.systemPathFromSplitPath(to),
					getErr,
				),
			),
		);
	}

	private tryVaultRename<SPF extends SplitPathToAnyFile>(
		file: TFile,
		to: SPF,
		from: SPF,
	): ResultAsync<void, string> {
		const toPath = pathfinder.systemPathFromSplitPath(to);
		return ResultAsync.fromPromise(
			this.fileManager.renameFile(file, toPath),
			(error) => {
				const msg =
					error instanceof Error ? error.message : String(error);
				logger.error(
					"[TFileHelper.renameFile] vault.rename threw",
					JSON.stringify({ error: msg, to: toPath }),
				);
				return errorRenameFailed(
					"file",
					pathfinder.systemPathFromSplitPath(from),
					toPath,
					msg,
				);
			},
		);
	}

	async replaceAllContent(
		splitPath: SplitPathToMdFile,
		content: string,
	): Promise<Result<TFile, string>> {
		return this.getFile(splitPath).asyncAndThen((file) =>
			this.tryVaultModify(file, content, splitPath),
		);
	}

	private tryVaultModify(
		file: TFile,
		content: string,
		splitPath: SplitPathToMdFile,
	): ResultAsync<TFile, string> {
		return ResultAsync.fromPromise(
			this.vault.modify(file, content),
			(error) =>
				errorWriteFailed(
					"file",
					pathfinder.systemPathFromSplitPath(splitPath),
					error instanceof Error ? error.message : String(error),
				),
		).map(() => file);
	}

	async processContent({
		splitPath,
		transform,
	}: {
		splitPath: SplitPathToMdFile;
		transform: Transform;
	}): Promise<Result<TFile, string>> {
		return this.getFile(splitPath).asyncAndThen((file) =>
			this.tryReadAndTransform(file, transform, splitPath),
		);
	}

	private tryReadAndTransform(
		file: TFile,
		transform: Transform,
		splitPath: SplitPathToMdFile,
	): ResultAsync<TFile, string> {
		const makeError = (error: unknown) =>
			errorWriteFailed(
				"file",
				pathfinder.systemPathFromSplitPath(splitPath),
				error instanceof Error ? error.message : String(error),
			);

		return ResultAsync.fromPromise(this.vault.read(file), makeError)
			.andThen((before) =>
				ResultAsync.fromPromise(
					Promise.resolve(transform(before)),
					makeError,
				).map((after) => ({ after, before })),
			)
			.andThen(({ before, after }) =>
				after !== before
					? ResultAsync.fromPromise(
							this.vault.modify(file, after),
							makeError,
						).map(() => file)
					: ok(file),
			);
	}
}
