import { Effect, Result } from "effect";
import { TFolder } from "obsidian";
import { recordTargetTaken } from "../../../effect/current-operation";
import type { VamActionOutcome } from "../../../effect/dispatch-report";
import {
	type VamTargetExistsError,
	VamVaultIoError,
} from "../../../effect/errors";
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
import type { RenameCollision } from "../../../types/vault-action";
import { VaultPath, type VaultPathIdentity } from "../../../vault-path";
import {
	firstFreeIndexedPath,
	occupantOf,
	type SelfRenameRecorder,
	targetExists,
} from "./common";

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
	constructor(
		private readonly selfEvents?: SelfRenameRecorder,
		private readonly paths: VaultPathIdentity = VaultPath.caseSensitive,
	) {}

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
			// For the dispatch report only; a failed lookup records nothing.
			const occupant = yield* Effect.result(
				occupantOf(splitPath, this.paths),
			);
			if (Result.isSuccess(occupant))
				yield* recordTargetTaken(occupant.success !== undefined);
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

	/**
	 * Renames the folder. A taken target is handled as `onCollision` asks
	 * (`fail` or `index`, the default); see `RenameCollision`.
	 */
	renameFolder({
		from,
		to,
		onCollision = "index",
		updateLinks = true,
	}: SplitPathFromTo<SplitPathToFolder> & {
		onCollision?: Exclude<RenameCollision, "dedupe">;
		updateLinks?: boolean;
	}): Effect.Effect<
		VamActionOutcome,
		VamVaultIoError | VamTargetExistsError,
		VaultIo
	> {
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
				const fromPath = pathfinder.systemPathFromSplitPath(from);
				const toPath = pathfinder.systemPathFromSplitPath(to);
				// Moved already: the source is gone and the target there,
				// unless the rename must not guess.
				if (Result.isSuccess(toResult) && onCollision !== "fail")
					return NO_OP;
				return yield* operationFailure(
					"renameFolder.resolve",
					`${fromPath} -> ${toPath}`,
					Result.isSuccess(toResult)
						? `Cannot rename ${fromPath}: it is not there, and ${toPath} is`
						: errorBothSourceAndTargetNotFound(
								"folder",
								fromPath,
								toPath,
								getErrorMessage(toResult.failure.cause),
							),
					fromResult.failure,
				);
			}

			const fromFolder = fromResult.success;
			if (Result.isSuccess(toResult) && fromFolder === toResult.success) {
				return NO_OP;
			}
			const occupant = Result.isSuccess(toResult)
				? toResult.success
				: yield* occupantOf(to, this.paths, fromFolder);
			yield* recordTargetTaken(occupant !== undefined);
			if (!occupant)
				return yield* this.performRename(fromFolder, to, updateLinks);
			if (onCollision === "fail")
				return yield* targetExists(
					"renameFolder.collision",
					to,
					occupant,
					`Cannot rename ${fromFolder.path}`,
				);
			return yield* this.renameToIndexedPath(
				fromFolder,
				from,
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
			const indexedPath = yield* firstFreeIndexedPath(to, this.paths);
			// Before the move: Obsidian reports its renames during it (#175).
			yield* this.selfEvents?.expectRenameDestinationEffect({
				actual: pathfinder.systemPathFromSplitPath(indexedPath),
				from: pathfinder.systemPathFromSplitPath(from),
				isFolder: true,
				planned: pathfinder.systemPathFromSplitPath(to),
			}) ?? Effect.void;
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
