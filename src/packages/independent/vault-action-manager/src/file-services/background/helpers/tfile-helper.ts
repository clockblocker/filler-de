import { Effect, Exit, Result } from "effect";
import { TFile } from "obsidian";
import type { VamActionOutcome } from "../../../effect/dispatch-report";
import {
	VamContentConflictError,
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
	errorTrashDuplicateFile,
	errorTypeMismatch,
	errorWriteFailed,
} from "../../../errors";
import {
	type MdFileWithContentDto,
	pathfinder,
} from "../../../helpers/pathfinder";
import { vaultContentHash } from "../../../internal/content-hash";
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

const NO_OP: VamActionOutcome = { _tag: "NoOp" };

function wrote(before: string, after: string): VamActionOutcome {
	return before === after
		? NO_OP
		: {
				_tag: "Wrote",
				afterHash: vaultContentHash(after),
				beforeHash: vaultContentHash(before),
			};
}

/** A renamed file and what the rename did. */
export type RenameResult = {
	readonly file: TFile;
	readonly outcome: VamActionOutcome;
};

/** Attributes VAM's own background writes as modify Self Events. */
export type SelfModifyRecorder = {
	readonly expectModifyEffect: (path: string) => Effect.Effect<void>;
	readonly forgetModifyEffect: (path: string) => Effect.Effect<void>;
};

/** Effect-native helper for background file operations. */
export class TFileHelper {
	constructor(private readonly selfModifies?: SelfModifyRecorder) {}

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

	/** Creates the file unless it is there; `NoOp` when it is. */
	upsertMdFile(file: MdFileWithContentDto) {
		return Effect.gen({ self: this }, function* () {
			const existing = yield* Effect.result(this.getFile(file.splitPath));
			if (Result.isSuccess(existing)) return NO_OP;
			if (!isLookupMiss(existing.failure)) return yield* existing.failure;
			return yield* this.tryVaultCreate(
				file.splitPath,
				file.content ?? "",
			);
		});
	}

	private tryVaultCreate(
		splitPath: SplitPathToMdFile,
		content: string,
	): Effect.Effect<VamActionOutcome, VamVaultIoError, VaultIo> {
		return Effect.gen({ self: this }, function* () {
			const vault = yield* VaultIo;
			const systemPath = pathfinder.systemPathFromSplitPath(splitPath);
			const created = yield* Effect.result(
				vault.create(systemPath, content),
			);
			if (Result.isSuccess(created))
				return {
					_tag: "Created",
					contentHash: vaultContentHash(content),
				} as const;
			const message = originalMessage(created.failure);
			if (message.includes("already exists")) {
				// Another writer created it first.
				return yield* this.getFile(splitPath).pipe(
					Effect.as(NO_OP),
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

	/** Trashes the file; `NoOp` when it is gone. */
	trashFile<SPF extends SplitPathToAnyFile>(splitPath: SPF) {
		return Effect.gen({ self: this }, function* () {
			const existing = yield* Effect.result(this.getFile(splitPath));
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

	renameFile<SPF extends SplitPathToAnyFile>({
		from,
		to,
		collisionStrategy = "rename",
		updateLinks = true,
	}: SplitPathFromTo<SPF> & {
		collisionStrategy?: CollisionStrategy;
		updateLinks?: boolean;
	}): Effect.Effect<RenameResult, VamVaultIoError, VaultIo> {
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
						updateLinks,
					)
				: yield* this.performRename(fromFile, to, updateLinks);
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
		updateLinks: boolean,
	): Effect.Effect<RenameResult, VamVaultIoError, VaultIo> {
		return Effect.gen({ self: this }, function* () {
			// The same file: the rename is done, or its source is gone.
			if (fromFile === toFile) return { file: fromFile, outcome: NO_OP };
			if (to.kind === SplitPathKind.MdFile) {
				const vault = yield* VaultIo;
				const [targetContent, sourceContent] = yield* Effect.all(
					[vault.read(toFile), vault.read(fromFile)],
					{ concurrency: "unbounded" },
				);
				if (targetContent === sourceContent) {
					yield* this.trashDuplicate(fromFile, from);
					return {
						file: toFile,
						outcome: { _tag: "TrashedDuplicate" },
					} as const;
				}
			}
			if (collisionStrategy === "skip")
				return { file: toFile, outcome: NO_OP };
			return yield* this.renameToIndexedPath(
				fromFile,
				from,
				to,
				updateLinks,
			);
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
		updateLinks: boolean,
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
			yield* this.tryVaultRename(
				fromFile,
				indexedPath,
				from,
				updateLinks,
			);
			return yield* this.getFile(indexedPath).pipe(
				Effect.map(
					(file): RenameResult => ({
						file,
						outcome: { _tag: "RenamedToIndexed", to: indexedPath },
					}),
				),
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
		updateLinks: boolean,
	) {
		return Effect.gen({ self: this }, function* () {
			yield* this.tryVaultRename(fromFile, to, to, updateLinks);
			return yield* this.getFile(to).pipe(
				Effect.map(
					(file): RenameResult => ({
						file,
						outcome: { _tag: "Renamed", to },
					}),
				),
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
		updateLinks: boolean,
	) {
		const toPath = pathfinder.systemPathFromSplitPath(to);
		const fromPath = pathfinder.systemPathFromSplitPath(from);
		return Effect.gen(function* () {
			const vault = yield* VaultIo;
			yield* vault.rename(file, toPath, { updateLinks }).pipe(
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
		return Effect.gen({ self: this }, function* () {
			const vault = yield* VaultIo;
			// One `Vault.process` call reads the pre-image the report hashes
			// and writes over it atomically, so the hash names exactly the
			// content replaced; Obsidian skips the write when it is unchanged.
			const replaced: { before?: string } = {};
			yield* this.processAsSelf(vault, file, (current) => {
				replaced.before = current;
				return content;
			}).pipe(
				Effect.mapError((error) =>
					operationFailure(
						"replaceFileContent",
						path,
						errorWriteFailed("file", path, originalMessage(error)),
						error,
					),
				),
			);
			return wrote(replaced.before ?? "", content);
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
			return yield* this.tryProcess(file, transform, splitPath);
		});
	}

	/**
	 * Applies a transform through `Vault.process`, so a synchronous transform
	 * reads, transforms, and writes the file as one atomic step.
	 *
	 * `Vault.process` callbacks must be synchronous. An asynchronous transform
	 * is therefore started inside a first `process` call against the current
	 * content, which returns that content unchanged so nothing is written.
	 * Once the transform settles, a second `process` call writes its result
	 * only if the file still holds the content the transform started from;
	 * otherwise it fails with a typed `VamContentConflictError` and leaves the
	 * newer content in place. The transform is never re-run, because it may
	 * not be idempotent.
	 *
	 * Every callback that must not write returns `current`: Obsidian skips the
	 * write when the callback returns the content it was given. Only a
	 * throwing transform aborts its `process` call with an error.
	 */
	private tryProcess(
		file: TFile,
		transform: Transform,
		splitPath: SplitPathToMdFile,
	): Effect.Effect<
		VamActionOutcome,
		VamVaultIoError | VamContentConflictError,
		VaultIo
	> {
		const path = pathfinder.systemPathFromSplitPath(splitPath);
		const transformFailure = (cause: unknown) =>
			operationFailure(
				"processFileContent.transform",
				path,
				errorWriteFailed("file", path, getErrorMessage(cause)),
				cause,
			);
		const ioFailure = (operation: string, error: VamVaultIoError) =>
			operationFailure(
				operation,
				path,
				errorWriteFailed("file", path, originalMessage(error)),
				error,
			);

		return Effect.gen({ self: this }, function* () {
			const vault = yield* VaultIo;
			const started: { pending?: PendingTransform } = {};
			const synchronous: { outcome?: VamActionOutcome } = {};
			const first = yield* Effect.result(
				this.processAsSelf(vault, file, (current) => {
					let result: string | Promise<string>;
					try {
						result = transform(current);
					} catch (cause) {
						throw new TransformThrew(cause);
					}
					if (typeof result === "string") {
						synchronous.outcome = wrote(current, result);
						return result;
					}
					const after = Promise.resolve(result);
					// Observed below; this only prevents an unhandled
					// rejection while the first process call settles.
					after.catch(() => {});
					started.pending = { after, before: current };
					return current;
				}),
			);
			if (Result.isFailure(first)) {
				const threw = first.failure.cause;
				return yield* threw instanceof TransformThrew
					? transformFailure(threw.cause)
					: ioFailure("processFileContent", first.failure);
			}
			const pending = started.pending;
			if (!pending) return synchronous.outcome ?? NO_OP;

			const after = yield* Effect.tryPromise({
				catch: transformFailure,
				try: () => pending.after,
			});
			if (after === pending.before) return NO_OP;

			const revalidated = { conflict: false };
			yield* this.processAsSelf(vault, file, (current) => {
				if (current === pending.before) return after;
				revalidated.conflict = true;
				return current;
			}).pipe(
				Effect.mapError((error) =>
					ioFailure("processFileContent.write", error),
				),
			);
			if (revalidated.conflict) {
				return yield* new VamContentConflictError({
					cause: new Error(
						`Content of ${path} changed while its transform was running; the transform result was not written`,
					),
					operation: "processFileContent.revalidate",
					path,
				});
			}
			return wrote(pending.before, after);
		});
	}

	/**
	 * Runs one `Vault.process` call and attributes its write, if any, as a
	 * modify Self Event. The expectation is recorded synchronously inside the
	 * callback, and only when the callback changes the content, because only
	 * then does Obsidian write. A modify callback that arrives before the
	 * callback runs, or during a call that writes nothing, is never hidden.
	 * The expectation is withdrawn if the call fails after recording it.
	 */
	private processAsSelf(
		vault: VaultIo["Service"],
		file: TFile,
		fn: (current: string) => string,
	): Effect.Effect<void, VamVaultIoError> {
		const recorder = this.selfModifies;
		if (!recorder) return Effect.asVoid(vault.process(file, fn));
		return Effect.gen(function* () {
			const runSync = Effect.runSyncWith(yield* Effect.context<never>());
			const outcome = { recorded: false };
			yield* vault
				.process(file, (current) => {
					const next = fn(current);
					if (next !== current) {
						runSync(recorder.expectModifyEffect(file.path));
						outcome.recorded = true;
					}
					return next;
				})
				.pipe(
					Effect.onExit((exit) =>
						Exit.isFailure(exit) && outcome.recorded
							? recorder.forgetModifyEffect(file.path)
							: Effect.void,
					),
				);
		});
	}
}

type PendingTransform = {
	readonly after: Promise<string>;
	readonly before: string;
};

/** Thrown from a `Vault.process` callback when the transform itself throws. */
class TransformThrew {
	constructor(readonly cause: unknown) {}
}
