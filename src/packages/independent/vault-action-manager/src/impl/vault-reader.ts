import { Clock, Effect, Result } from "effect";
import { VamScanError, VamVaultIoError } from "../effect/errors";
import type { VamLiveServices } from "../effect/ports";
import { VaultIo } from "../effect/ports";
import type { VamRuntimeFailure } from "../effect/runtime";
import type { TFileHelper } from "../file-services/background/helpers/tfile-helper";
import type { TFolderHelper } from "../file-services/background/helpers/tfolder-helper";
import type { MarkdownFileAccess } from "../file-services/markdown-file-access";
import { pathfinder } from "../helpers/pathfinder";
import { getErrorMessage } from "../internal/get-error-message";
import type {
	AnySplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../types/split-path";
import type {
	VaultScanCounts,
	VaultScanPath,
	VaultScanResult,
} from "../vault-scan";

type ProvideRead = <A, E>(
	effect: Effect.Effect<A, E, VamLiveServices>,
) => Effect.Effect<A, VamRuntimeFailure<E>>;

function readerFailure(
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

export class VaultReader {
	constructor(
		private readonly markdownFiles: MarkdownFileAccess,
		private readonly tfileHelper: TFileHelper,
		private readonly tfolderHelper: TFolderHelper,
		private readonly provideRead: ProvideRead,
	) {}

	readContent(target: SplitPathToMdFile) {
		return this.markdownFiles.readContent(target);
	}

	exists(target: AnySplitPath) {
		if (target.kind === "Folder") {
			return Effect.result(this.tfolderHelper.getFolder(target)).pipe(
				Effect.map((result) => Result.isSuccess(result)),
			);
		}
		return Effect.result(this.tfileHelper.getFile(target)).pipe(
			Effect.map((result) => Result.isSuccess(result)),
		);
	}

	list(folder: SplitPathToFolder) {
		const folderPath = pathfinder.systemPathFromSplitPath(folder);
		return this.tfolderHelper.getFolder(folder).pipe(
			Effect.mapError((error) =>
				readerFailure(
					"listFolder",
					folderPath,
					`Folder not found: ${getErrorMessage(error.cause)}`,
					error,
				),
			),
			Effect.flatMap((tfolder) =>
				Effect.try({
					catch: (cause) =>
						readerFailure(
							"listFolder.decode",
							folderPath,
							getErrorMessage(cause),
							cause,
						),
					try: () =>
						tfolder.children.map(
							(child) =>
								pathfinder.splitPathFromAbstract(
									child,
								) as AnySplitPath,
						),
				}),
			),
		);
	}

	findByBasename(basename: string, opts?: { folder?: SplitPathToFolder }) {
		return Effect.gen(function* () {
			const folderPrefix = opts?.folder
				? `${pathfinder.systemPathFromSplitPath(opts.folder)}/`
				: undefined;
			const vault = yield* VaultIo;
			const files = yield* vault.getMarkdownFiles;
			return yield* Effect.try({
				catch: (cause) =>
					readerFailure(
						"findByBasename.decode",
						folderPrefix ?? "",
						getErrorMessage(cause),
						cause,
					),
				try: () =>
					files
						.filter(
							(file) =>
								file.basename === basename &&
								(!folderPrefix ||
									file.path.startsWith(folderPrefix)),
						)
						.map(
							(file) =>
								pathfinder.splitPathFromAbstract(
									file,
								) as SplitPathToMdFile,
						),
			});
		});
	}

	readonly scan = Effect.fn("VaultReader.scan")(function* (
		this: VaultReader,
		folder: SplitPathToFolder,
	) {
		const rootPath = pathfinder.systemPathFromSplitPath(folder);
		const startedAt = yield* Clock.currentTimeMillis;
		const entries: VaultScanPath[] = [];
		const diagnostics: VamScanError[] = [];
		const mutableCounts = {
			folderCount: 1,
			markdownFileCount: 0,
			otherFileCount: 0,
		};

		const traversal = Effect.gen({ self: this }, function* () {
			const rootChildren = yield* this.list(folder).pipe(
				Effect.mapError((cause) => {
					const failure = scanFailure("scanRoot", rootPath, cause);
					diagnostics.push(failure);
					return failure;
				}),
			);
			const stack: AnySplitPath[] = sortPaths(rootChildren).reverse();

			while (stack.length > 0) {
				const current = stack.pop();
				if (!current) continue;
				if (current.kind === "Folder") {
					mutableCounts.folderCount += 1;
					const childrenResult = yield* Effect.result(
						this.list(current),
					);
					if (Result.isFailure(childrenResult)) {
						diagnostics.push(
							scanFailure(
								"scanFolder",
								pathfinder.systemPathFromSplitPath(current),
								childrenResult.failure,
							),
						);
						continue;
					}
					stack.push(...sortPaths(childrenResult.success).reverse());
				} else if (current.kind === "MdFile") {
					mutableCounts.markdownFileCount += 1;
					entries.push({
						...current,
						read: () => this.provideRead(this.readContent(current)),
					});
				} else {
					mutableCounts.otherFileCount += 1;
					entries.push(current);
				}
			}

			return scanResult(entries, diagnostics, mutableCounts);
		});

		return yield* traversal.pipe(
			Effect.ensuring(
				Effect.gen(function* () {
					const finishedAt = yield* Clock.currentTimeMillis;
					yield* Effect.annotateCurrentSpan({
						"duration.ms": finishedAt - startedAt,
						"failure.count": diagnostics.length,
						"file.markdown.count": mutableCounts.markdownFileCount,
						"file.other.count": mutableCounts.otherFileCount,
						"folder.count": mutableCounts.folderCount,
					});
				}),
			),
			Effect.withSpan("vam.vault.scan", {
				attributes: { root: rootPath },
			}),
		);
	});
}

function sortPaths(paths: readonly AnySplitPath[]): AnySplitPath[] {
	return [...paths].sort((left, right) => {
		const leftPath = pathfinder.systemPathFromSplitPath(left);
		const rightPath = pathfinder.systemPathFromSplitPath(right);
		return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0;
	});
}

function scanFailure(
	operation: VamScanError["operation"],
	path: string,
	cause: unknown,
): VamScanError {
	return new VamScanError({ cause, operation, path });
}

function scanResult(
	entries: readonly VaultScanPath[],
	diagnostics: readonly VamScanError[],
	counts: VaultScanCounts,
): VaultScanResult {
	const frozenCounts = Object.freeze({ ...counts });
	const frozenEntries = Object.freeze([...entries]);
	const [firstDiagnostic, ...rest] = diagnostics;
	if (firstDiagnostic) {
		const nonEmptyDiagnostics: [VamScanError, ...VamScanError[]] = [
			firstDiagnostic,
			...rest,
		];
		return Object.freeze({
			counts: frozenCounts,
			diagnostics: Object.freeze(nonEmptyDiagnostics),
			entries: frozenEntries,
			kind: "Partial" as const,
		});
	}
	return Object.freeze({
		counts: frozenCounts,
		diagnostics: Object.freeze([]) as readonly [],
		entries: frozenEntries,
		kind: "Complete" as const,
	});
}
