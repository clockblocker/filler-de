import { Effect, Result } from "effect";
import { TFile } from "obsidian";
import { VamVaultIoError } from "../../../effect/errors";
import { VaultIo } from "../../../effect/ports";
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
import { getErrorMessage } from "../../../internal/get-error-message";
import {
	type SplitPathFromTo,
	SplitPathKind,
	type SplitPathToAnyFile,
	type SplitPathToMdFile,
} from "../../../types/split-path";
import type { Transform } from "../../../types/vault-action";
import { type CollisionStrategy, getExistingBasenamesInFolder } from "./common";

const GET_FILE_RETRY_COUNT = 10;
const GET_FILE_RETRY_DELAY_MS = 50;

function operationFailure(
	operation: string,
	path: string,
	message: string,
	cause?: unknown,
): VamVaultIoError {
	return new VamVaultIoError({
		cause:
			cause === undefined
				? new Error(message)
				: new Error(message, { cause }),
		operation,
		path,
	});
}

function originalMessage(error: VamVaultIoError): string {
	return getErrorMessage(error.cause);
}

function isLookupMiss(error: VamVaultIoError): boolean {
	return error.operation === "getFile";
}

/** Effect-native helper for background file operations. */
export class TFileHelper {
	getFile<SPF extends SplitPathToAnyFile>(splitPath: SPF) {
		return Effect.gen(function* () {
			const vault = yield* VaultIo;
			const systemPath = pathfinder.systemPathFromSplitPath(splitPath);
			const abstractFile = yield* vault.getAbstractFileByPath(systemPath);
			if (!abstractFile) {
				return yield* operationFailure(
					"getFile",
					systemPath,
					errorGetByPath("file", systemPath),
				);
			}
			if (abstractFile instanceof TFile) return abstractFile;
			return yield* operationFailure(
				"getFile",
				systemPath,
				errorTypeMismatch("file", systemPath),
			);
		});
	}

	getFileWithRetry<SPF extends SplitPathToAnyFile>(
		splitPath: SPF,
		maxRetries = GET_FILE_RETRY_COUNT,
	) {
		return Effect.gen({ self: this }, function* () {
			let last = yield* Effect.result(this.getFile(splitPath));
			if (Result.isSuccess(last)) return last.success;

			for (let retry = 0; retry < maxRetries; retry++) {
				yield* Effect.sleep(GET_FILE_RETRY_DELAY_MS);
				last = yield* Effect.result(this.getFile(splitPath));
				if (Result.isSuccess(last)) return last.success;
			}

			return yield* last.failure;
		});
	}

	upsertMdFile(file: MdFileWithContentDto) {
		return Effect.gen({ self: this }, function* () {
			const existing = yield* Effect.result(this.getFile(file.splitPath));
			if (Result.isSuccess(existing)) return existing.success;
			if (!isLookupMiss(existing.failure)) return yield* existing.failure;
			return yield* this.tryVaultCreate(
				file.splitPath,
				file.content ?? "",
			);
		});
	}

	private tryVaultCreate(splitPath: SplitPathToMdFile, content: string) {
		return Effect.gen({ self: this }, function* () {
			const vault = yield* VaultIo;
			const systemPath = pathfinder.systemPathFromSplitPath(splitPath);
			const created = yield* Effect.result(
				vault.create(systemPath, content),
			);
			if (Result.isSuccess(created)) return created.success;
			const message = originalMessage(created.failure);
			if (message.includes("already exists")) {
				return yield* this.getFile(splitPath).pipe(
					Effect.mapError((error) =>
						operationFailure(
							"createFile.race",
							systemPath,
							errorCreationRaceCondition(
								"file",
								systemPath,
								getErrorMessage(error.cause),
							),
							error,
						),
					),
				);
			}
			return yield* operationFailure(
				"createFile",
				systemPath,
				errorCreateFailed("file", systemPath, message),
				created.failure,
			);
		});
	}

	trashFile<SPF extends SplitPathToAnyFile>(splitPath: SPF) {
		return Effect.gen({ self: this }, function* () {
			const existing = yield* Effect.result(this.getFile(splitPath));
			if (Result.isFailure(existing)) {
				return isLookupMiss(existing.failure)
					? undefined
					: yield* existing.failure;
			}
			const vault = yield* VaultIo;
			yield* vault.trash(existing.success);
		});
	}

	renameFile<SPF extends SplitPathToAnyFile>({
		from,
		to,
		collisionStrategy = "rename",
	}: SplitPathFromTo<SPF> & { collisionStrategy?: CollisionStrategy }) {
		return Effect.gen({ self: this }, function* () {
			const { fromFile, toFile } = yield* this.resolveRenamePaths(
				from,
				to,
			);
			return toFile
				? yield* this.handleTargetCollision(
						fromFile,
						toFile,
						from,
						to,
						collisionStrategy,
					)
				: yield* this.performRename(fromFile, to);
		});
	}

	private resolveRenamePaths<SPF extends SplitPathToAnyFile>(
		from: SPF,
		to: SPF,
	) {
		return Effect.gen({ self: this }, function* () {
			let fromResult = yield* Effect.result(this.getFile(from));
			const toResult = yield* Effect.result(this.getFile(to));
			if (
				Result.isFailure(fromResult) &&
				!isLookupMiss(fromResult.failure)
			) {
				return yield* fromResult.failure;
			}
			if (Result.isFailure(toResult) && !isLookupMiss(toResult.failure)) {
				return yield* toResult.failure;
			}
			if (Result.isFailure(fromResult) && Result.isFailure(toResult)) {
				fromResult = yield* Effect.result(
					this.getFileWithRetry(from, GET_FILE_RETRY_COUNT),
				);
			}
			if (Result.isFailure(fromResult)) {
				if (Result.isSuccess(toResult)) {
					return {
						fromFile: toResult.success,
						toFile: toResult.success,
					};
				}
				const fromPath = pathfinder.systemPathFromSplitPath(from);
				const toPath = pathfinder.systemPathFromSplitPath(to);
				yield* Effect.logError(
					"[TFileHelper.renameFile] Both from and to not found",
					JSON.stringify({ from: fromPath, to: toPath }),
				);
				return yield* operationFailure(
					"renameFile.resolve",
					`${fromPath} -> ${toPath}`,
					errorBothSourceAndTargetNotFound(
						"file",
						fromPath,
						toPath,
						getErrorMessage(toResult.failure.cause),
					),
					fromResult.failure,
				);
			}
			if (
				Result.isSuccess(toResult) &&
				fromResult.success === toResult.success
			) {
				return {
					fromFile: fromResult.success,
					toFile: fromResult.success,
				};
			}
			return {
				fromFile: fromResult.success,
				toFile: Result.isSuccess(toResult) ? toResult.success : null,
			};
		});
	}

	private handleTargetCollision<SPF extends SplitPathToAnyFile>(
		fromFile: TFile,
		toFile: TFile,
		from: SPF,
		to: SPF,
		collisionStrategy: CollisionStrategy,
	) {
		return Effect.gen({ self: this }, function* () {
			if (fromFile === toFile) return fromFile;
			if (to.kind === SplitPathKind.MdFile) {
				const vault = yield* VaultIo;
				const [targetContent, sourceContent] = yield* Effect.all(
					[vault.read(toFile), vault.read(fromFile)],
					{ concurrency: "unbounded" },
				);
				if (targetContent === sourceContent) {
					yield* this.trashDuplicate(fromFile, from);
					return toFile;
				}
			}
			if (collisionStrategy === "skip") return toFile;
			return yield* this.renameToIndexedPath(fromFile, from, to);
		});
	}

	private trashDuplicate<SPF extends SplitPathToAnyFile>(
		file: TFile,
		splitPath: SPF,
	) {
		const path = pathfinder.systemPathFromSplitPath(splitPath);
		return Effect.gen(function* () {
			const vault = yield* VaultIo;
			yield* vault
				.trash(file)
				.pipe(
					Effect.mapError((error) =>
						operationFailure(
							"trashDuplicateFile",
							path,
							errorTrashDuplicateFile(
								path,
								originalMessage(error),
							),
							error,
						),
					),
				);
		});
	}

	private renameToIndexedPath<SPF extends SplitPathToAnyFile>(
		fromFile: TFile,
		from: SPF,
		to: SPF,
	) {
		return Effect.gen({ self: this }, function* () {
			const existingBasenames = yield* getExistingBasenamesInFolder(to);
			const indexedPath = yield* Effect.tryPromise({
				catch: (cause) =>
					operationFailure(
						"findIndexedFilePath",
						pathfinder.systemPathFromSplitPath(to),
						getErrorMessage(cause),
						cause,
					),
				try: () =>
					pathfinder.findFirstAvailableIndexedPath(
						to,
						existingBasenames,
					),
			});
			yield* this.tryVaultRename(fromFile, indexedPath, from);
			return yield* this.getFile(indexedPath).pipe(
				Effect.mapError((error) =>
					operationFailure(
						"renameFile.retrieve",
						pathfinder.systemPathFromSplitPath(indexedPath),
						errorRetrieveRenamed(
							"file",
							pathfinder.systemPathFromSplitPath(indexedPath),
							getErrorMessage(error.cause),
						),
						error,
					),
				),
			);
		});
	}

	private performRename<SPF extends SplitPathToAnyFile>(
		fromFile: TFile,
		to: SPF,
	) {
		return Effect.gen({ self: this }, function* () {
			yield* this.tryVaultRename(fromFile, to, to);
			return yield* this.getFile(to).pipe(
				Effect.mapError((error) =>
					operationFailure(
						"renameFile.retrieve",
						pathfinder.systemPathFromSplitPath(to),
						errorRetrieveRenamed(
							"file",
							pathfinder.systemPathFromSplitPath(to),
							getErrorMessage(error.cause),
						),
						error,
					),
				),
			);
		});
	}

	private tryVaultRename<SPF extends SplitPathToAnyFile>(
		file: TFile,
		to: SPF,
		from: SPF,
	) {
		const toPath = pathfinder.systemPathFromSplitPath(to);
		const fromPath = pathfinder.systemPathFromSplitPath(from);
		return Effect.gen(function* () {
			const vault = yield* VaultIo;
			yield* vault.rename(file, toPath).pipe(
				Effect.tapError((error) =>
					Effect.logError(
						"[TFileHelper.renameFile] vault.rename threw",
						JSON.stringify({
							error: originalMessage(error),
							to: toPath,
						}),
					),
				),
				Effect.mapError((error) =>
					operationFailure(
						"renameFile",
						`${fromPath} -> ${toPath}`,
						errorRenameFailed(
							"file",
							fromPath,
							toPath,
							originalMessage(error),
						),
						error,
					),
				),
			);
		});
	}

	replaceAllContent(splitPath: SplitPathToMdFile, content: string) {
		return Effect.gen({ self: this }, function* () {
			const immediate = yield* Effect.result(this.getFile(splitPath));
			const file = Result.isSuccess(immediate)
				? immediate.success
				: isLookupMiss(immediate.failure)
					? yield* this.getFileWithRetry(splitPath)
					: yield* immediate.failure;
			return yield* this.tryVaultModify(file, content, splitPath);
		});
	}

	private tryVaultModify(
		file: TFile,
		content: string,
		splitPath: SplitPathToMdFile,
	) {
		const path = pathfinder.systemPathFromSplitPath(splitPath);
		return Effect.gen(function* () {
			const vault = yield* VaultIo;
			yield* vault
				.modify(file, content)
				.pipe(
					Effect.mapError((error) =>
						operationFailure(
							"replaceFileContent",
							path,
							errorWriteFailed(
								"file",
								path,
								originalMessage(error),
							),
							error,
						),
					),
				);
			return file;
		});
	}

	processContent({
		splitPath,
		transform,
	}: {
		splitPath: SplitPathToMdFile;
		transform: Transform;
	}) {
		return Effect.gen({ self: this }, function* () {
			const immediate = yield* Effect.result(this.getFile(splitPath));
			const file = Result.isSuccess(immediate)
				? immediate.success
				: isLookupMiss(immediate.failure)
					? yield* this.getFileWithRetry(splitPath)
					: yield* immediate.failure;
			return yield* this.tryReadAndTransform(file, transform, splitPath);
		});
	}

	private tryReadAndTransform(
		file: TFile,
		transform: Transform,
		splitPath: SplitPathToMdFile,
	) {
		const path = pathfinder.systemPathFromSplitPath(splitPath);
		return Effect.gen(function* () {
			const vault = yield* VaultIo;
			const before = yield* vault
				.read(file)
				.pipe(
					Effect.mapError((error) =>
						operationFailure(
							"processFileContent.read",
							path,
							errorWriteFailed(
								"file",
								path,
								originalMessage(error),
							),
							error,
						),
					),
				);
			const after = yield* Effect.tryPromise({
				catch: (cause) =>
					operationFailure(
						"processFileContent.transform",
						path,
						errorWriteFailed("file", path, getErrorMessage(cause)),
						cause,
					),
				try: async () => transform(before),
			});
			if (after !== before) {
				yield* vault
					.modify(file, after)
					.pipe(
						Effect.mapError((error) =>
							operationFailure(
								"processFileContent.write",
								path,
								errorWriteFailed(
									"file",
									path,
									originalMessage(error),
								),
								error,
							),
						),
					);
			}
			return file;
		});
	}
}
