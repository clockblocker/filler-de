import { Effect, Result } from "effect";
import { TFolder } from "obsidian";
import type { VamActionOutcome } from "../../../effect/dispatch-report";
import { VamVaultIoError } from "../../../effect/errors";
import { VaultIo } from "../../../effect/ports";
import {
	errorBothSourceAndTargetNotFound,
	errorCreateFailed,
	errorCreationRaceCondition,
	errorGetByPath,
	errorRenameFailed,
	errorRetrieveRenamed,
	errorTypeMismatch,
} from "../../../errors";
import { pathfinder } from "../../../helpers/pathfinder";
import { getErrorMessage } from "../../../internal/get-error-message";
import type {
	SplitPathFromTo,
	SplitPathToFolder,
} from "../../../types/split-path";
import { type CollisionStrategy, getExistingBasenamesInFolder } from "./common";

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
	return error.operation === "getFolder";
}

const NO_OP: VamActionOutcome = { _tag: "NoOp" };

/** Effect-native helper for low-level folder operations. */
export class TFolderHelper {
	getFolder(splitPath: SplitPathToFolder) {
		return Effect.gen(function* () {
			const vault = yield* VaultIo;
			const systemPath = pathfinder.systemPathFromSplitPath(splitPath);
			const abstractFile = yield* vault.getAbstractFileByPath(systemPath);
			if (!abstractFile) {
				return yield* operationFailure(
					"getFolder",
					systemPath,
					errorGetByPath("folder", systemPath),
				);
			}
			if (abstractFile instanceof TFolder) return abstractFile;
			return yield* operationFailure(
				"getFolder",
				systemPath,
				errorTypeMismatch("folder", systemPath),
			);
		});
	}

	/** Creates the folder; `NoOp` when it is already there. */
	createFolder(splitPath: SplitPathToFolder) {
		return Effect.gen({ self: this }, function* () {
			const existing = yield* Effect.result(this.getFolder(splitPath));
			if (Result.isSuccess(existing)) return NO_OP;
			if (!isLookupMiss(existing.failure)) return yield* existing.failure;
			return yield* this.tryVaultCreateFolder(splitPath);
		});
	}

	private tryVaultCreateFolder(
		splitPath: SplitPathToFolder,
	): Effect.Effect<VamActionOutcome, VamVaultIoError, VaultIo> {
		return Effect.gen({ self: this }, function* () {
			const vault = yield* VaultIo;
			const systemPath = pathfinder.systemPathFromSplitPath(splitPath);
			const created = yield* Effect.result(
				vault.createFolder(systemPath),
			);
			if (Result.isSuccess(created)) return { _tag: "Created" } as const;
			const message = originalMessage(created.failure);
			if (message.includes("already exists")) {
				// Another writer created it first.
				return yield* this.getFolder(splitPath).pipe(
					Effect.as(NO_OP),
					Effect.mapError((error) =>
						operationFailure(
							"createFolder.race",
							systemPath,
							errorCreationRaceCondition(
								"folder",
								systemPath,
								getErrorMessage(error.cause),
							),
							error,
						),
					),
				);
			}
			return yield* operationFailure(
				"createFolder",
				systemPath,
				errorCreateFailed("folder", systemPath, message),
				created.failure,
			);
		});
	}

	/** Trashes the folder; `NoOp` when it is gone. */
	trashFolder(splitPath: SplitPathToFolder) {
		return Effect.gen({ self: this }, function* () {
			const existing = yield* Effect.result(this.getFolder(splitPath));
			if (Result.isFailure(existing)) {
				return isLookupMiss(existing.failure)
					? NO_OP
					: yield* existing.failure;
			}
			const vault = yield* VaultIo;
			yield* vault.trash(existing.success);
			return { _tag: "Trashed" } as const satisfies VamActionOutcome;
		});
	}

	renameFolder({
		from,
		to,
		collisionStrategy = "rename",
		updateLinks = true,
	}: SplitPathFromTo<SplitPathToFolder> & {
		collisionStrategy?: CollisionStrategy;
		updateLinks?: boolean;
	}): Effect.Effect<VamActionOutcome, VamVaultIoError, VaultIo> {
		return Effect.gen({ self: this }, function* () {
			const fromResult = yield* Effect.result(this.getFolder(from));
			const toResult = yield* Effect.result(this.getFolder(to));
			if (
				Result.isFailure(fromResult) &&
				!isLookupMiss(fromResult.failure)
			) {
				return yield* fromResult.failure;
			}
			if (Result.isFailure(toResult) && !isLookupMiss(toResult.failure)) {
				return yield* toResult.failure;
			}

			if (Result.isFailure(fromResult)) {
				// Moved already: the source is gone and the target there.
				if (Result.isSuccess(toResult)) return NO_OP;
				const fromPath = pathfinder.systemPathFromSplitPath(from);
				const toPath = pathfinder.systemPathFromSplitPath(to);
				return yield* operationFailure(
					"renameFolder.resolve",
					`${fromPath} -> ${toPath}`,
					errorBothSourceAndTargetNotFound(
						"folder",
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
				return NO_OP;
			}
			if (Result.isSuccess(toResult)) {
				if (collisionStrategy === "skip") return NO_OP;
				return yield* this.renameToIndexedPath(
					fromResult.success,
					from,
					to,
					updateLinks,
				);
			}
			return yield* this.performRename(
				fromResult.success,
				to,
				updateLinks,
			);
		});
	}

	private renameToIndexedPath(
		fromFolder: TFolder,
		from: SplitPathToFolder,
		to: SplitPathToFolder,
		updateLinks: boolean,
	) {
		return Effect.gen({ self: this }, function* () {
			const existingBasenames = yield* getExistingBasenamesInFolder(to);
			const indexedPath = yield* Effect.tryPromise({
				catch: (cause) =>
					operationFailure(
						"findIndexedFolderPath",
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
			yield* this.tryVaultRename(
				fromFolder,
				indexedPath,
				from,
				updateLinks,
			);
			return yield* this.getFolder(indexedPath).pipe(
				Effect.as({
					_tag: "RenamedToIndexed",
					to: indexedPath,
				} as const),
				Effect.mapError((error) =>
					operationFailure(
						"renameFolder.retrieve",
						pathfinder.systemPathFromSplitPath(indexedPath),
						errorRetrieveRenamed(
							"folder",
							pathfinder.systemPathFromSplitPath(indexedPath),
							getErrorMessage(error.cause),
						),
						error,
					),
				),
			);
		});
	}

	private performRename(
		fromFolder: TFolder,
		to: SplitPathToFolder,
		updateLinks: boolean,
	) {
		return Effect.gen({ self: this }, function* () {
			yield* this.tryVaultRename(fromFolder, to, to, updateLinks);
			return yield* this.getFolder(to).pipe(
				Effect.as({ _tag: "Renamed", to } as const),
				Effect.mapError((error) =>
					operationFailure(
						"renameFolder.retrieve",
						pathfinder.systemPathFromSplitPath(to),
						errorRetrieveRenamed(
							"folder",
							pathfinder.systemPathFromSplitPath(to),
							getErrorMessage(error.cause),
						),
						error,
					),
				),
			);
		});
	}

	private tryVaultRename(
		folder: TFolder,
		to: SplitPathToFolder,
		from: SplitPathToFolder,
		updateLinks: boolean,
	) {
		const toPath = pathfinder.systemPathFromSplitPath(to);
		const fromPath = pathfinder.systemPathFromSplitPath(from);
		return Effect.gen(function* () {
			const vault = yield* VaultIo;
			yield* vault.rename(folder, toPath, { updateLinks }).pipe(
				Effect.tapError((error) =>
					Effect.logError(
						"[TFolderHelper.renameFolder] vault.rename threw",
						JSON.stringify({
							error: originalMessage(error),
							to: toPath,
						}),
					),
				),
				Effect.mapError((error) =>
					operationFailure(
						"renameFolder",
						`${fromPath} -> ${toPath}`,
						errorRenameFailed(
							"folder",
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
}
