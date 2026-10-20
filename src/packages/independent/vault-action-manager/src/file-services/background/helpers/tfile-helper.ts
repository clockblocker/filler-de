import { Effect, Exit, Result } from "effect";
import { TFile } from "obsidian";
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
		return Effect.gen({ self: this }, function* () {
			const vault = yield* VaultIo;
			yield* this.modifyAsSelf(file, vault.modify(file, content)).pipe(
				Effect.mapError((error) =>
					operationFailure(
						"replaceFileContent",
						path,
						errorWriteFailed("file", path, originalMessage(error)),
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
	) {
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
			const first = yield* Effect.result(
				this.processAsSelf(vault, file, (current) => {
					let result: string | Promise<string>;
					try {
						result = transform(current);
					} catch (cause) {
						throw new TransformThrew(cause);
					}
					if (typeof result === "string") return result;
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
			if (!pending) return file;

			const after = yield* Effect.tryPromise({
				catch: transformFailure,
				try: () => pending.after,
			});
			if (after === pending.before) return file;

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
			return file;
		});
	}

	/**
	 * Runs one `Vault.process` call and attributes its write, if any, as a
	 * modify Self Event. The expectation is recorded before the call, since
	 * Obsidian writes before `process` resolves, and withdrawn when the
	 * callback returned its input unchanged (no write) or the call failed.
	 */
	private processAsSelf(
		vault: VaultIo["Service"],
		file: TFile,
		fn: (current: string) => string,
	): Effect.Effect<void, VamVaultIoError> {
		const outcome = { wrote: false };
		const run = vault.process(file, (current) => {
			const next = fn(current);
			outcome.wrote = next !== current;
			return next;
		});
		const recorder = this.selfModifies;
		if (!recorder) return Effect.asVoid(run);
		return recorder.expectModifyEffect(file.path).pipe(
			Effect.andThen(Effect.exit(run)),
			Effect.flatMap((exit) =>
				Exit.isSuccess(exit) && outcome.wrote
					? Effect.void
					: recorder
							.forgetModifyEffect(file.path)
							.pipe(Effect.andThen(Effect.asVoid(exit))),
			),
		);
	}

	private modifyAsSelf<E>(
		file: TFile,
		write: Effect.Effect<void, E>,
	): Effect.Effect<void, E> {
		const recorder = this.selfModifies;
		if (!recorder) return write;
		return recorder.expectModifyEffect(file.path).pipe(
			Effect.andThen(write),
			Effect.tapError(() => recorder.forgetModifyEffect(file.path)),
		);
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
