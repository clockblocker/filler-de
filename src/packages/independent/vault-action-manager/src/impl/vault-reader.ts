import { Clock, Effect, Option, Result } from "effect";
import { type TAbstractFile, TFile, TFolder } from "obsidian";
import { VamScanError, VamVaultIoError } from "../effect/errors";
import type { VamLiveServices, VaultTree } from "../effect/ports";
import { VaultIo } from "../effect/ports";
import type { VamProvide } from "../effect/services";
import type { TFileHelper } from "../file-services/background/helpers/tfile-helper";
import type { TFolderHelper } from "../file-services/background/helpers/tfolder-helper";
import type { MarkdownFileAccess } from "../file-services/markdown-file-access";
import { pathfinder } from "../helpers/pathfinder";
import {
	getAbstractFileByPath,
	toSystemPath,
} from "../internal/abstract-file-by-path";
import { getErrorMessage } from "../internal/get-error-message";
import { decodeFileStatOption } from "../types/file-stat";
import type {
	AnySplitPath,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../types/split-path";
import { VaultPath } from "../vault-path";
import type {
	VaultScanCounts,
	VaultScanPath,
	VaultScanPathWithStat,
	VaultScanResult,
} from "../vault-scan";

type ListedChild = {
	readonly file: TAbstractFile;
	readonly splitPath: AnySplitPath;
};

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
		private readonly provideRead: VamProvide,
		private readonly tree: VaultTree,
	) {}

	readContent(target: SplitPathToMdFile) {
		return this.markdownFiles.readContent(target);
	}

	readContentWithStat(target: SplitPathToMdFile) {
		return this.markdownFiles.readContentWithStat(target);
	}

	readStat(target: SplitPathToMdFile) {
		return this.markdownFiles.readStat(target);
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
		return this.listChildren(folder).pipe(
			Effect.map((children) =>
				children.map(({ splitPath }) => splitPath),
			),
		);
	}

	private listChildren(folder: SplitPathToFolder) {
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
					try: (): ListedChild[] =>
						tfolder.children.map((child) => ({
							file: child,
							splitPath: pathfinder.splitPathFromAbstract(
								child,
							) as AnySplitPath,
						})),
				}),
			),
		);
	}

	/**
	 * Every Markdown file with this basename, below `folder` if given. With
	 * `ignoreCase`, names that differ only in case match too, as Obsidian
	 * matches link names on every file system.
	 */
	findByBasename(
		basename: string,
		opts?: { folder?: SplitPathToFolder; ignoreCase?: boolean },
	) {
		return Effect.gen(function* () {
			const folderPrefix = opts?.folder
				? pathfinder.systemPathFromSplitPath(opts.folder)
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
								(opts?.ignoreCase
									? VaultPath.caseInsensitive.same(
											file.basename,
											basename,
										)
									: file.basename === basename) &&
								(folderPrefix === undefined ||
									VaultPath.caseSensitive.isUnder(
										file.path,
										folderPrefix,
										{ inclusive: false },
									)),
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

	scan(folder: SplitPathToFolder) {
		return this.traverse(folder, (entry) => Effect.succeed(entry));
	}

	/**
	 * Scans like `scan` and adds each file's stat. A file whose stat cannot be
	 * read is omitted and reported as a `scanFile` diagnostic.
	 */
	scanWithStat(folder: SplitPathToFolder) {
		return this.traverse(folder, (entry, file) =>
			Effect.gen(function* () {
				if (!(file instanceof TFile)) {
					return yield* readerFailure(
						"stat",
						pathfinder.systemPathFromSplitPath(entry),
						"Listed file is not a TFile",
					);
				}
				const vault = yield* VaultIo;
				const stat = yield* vault.stat(file);
				return { ...entry, stat } satisfies VaultScanPathWithStat;
			}),
		);
	}

	/**
	 * What `scanWithStat` answers, read from Obsidian's in-memory tree in
	 * one synchronous pass, so no vault callback can land inside it and a
	 * cursor read on the same tick describes it exactly. Markdown entries
	 * read their content when asked, as `scan`'s do.
	 */
	snapshot(
		folder: SplitPathToFolder,
	): Result.Result<VaultScanResult<VaultScanPathWithStat>, VamScanError> {
		const rootPath = pathfinder.systemPathFromSplitPath(folder);
		const root = getAbstractFileByPath(this.tree, toSystemPath(rootPath));
		if (!(root instanceof TFolder)) {
			return Result.fail(
				scanFailure(
					"scanRoot",
					rootPath,
					readerFailure(
						"listFolder",
						rootPath,
						`Folder not found: ${rootPath}`,
					),
				),
			);
		}
		const entries: VaultScanPathWithStat[] = [];
		const diagnostics: VamScanError[] = [];
		const counts = {
			folderCount: 1,
			markdownFileCount: 0,
			otherFileCount: 0,
		};
		const stack = sortTreeChildren(root).reverse();
		while (stack.length > 0) {
			const child = stack.pop();
			if (!child) continue;
			if (child instanceof TFolder) {
				counts.folderCount += 1;
				stack.push(...sortTreeChildren(child).reverse());
				continue;
			}
			let splitPath: AnySplitPath;
			try {
				splitPath = pathfinder.splitPathFromAbstract(child);
			} catch (cause) {
				diagnostics.push(scanFailure("scanFile", child.path, cause));
				continue;
			}
			if (splitPath.kind === "Folder") continue;
			if (splitPath.kind === "MdFile") counts.markdownFileCount += 1;
			else counts.otherFileCount += 1;
			// Obsidian mutates `file.stat` in place, so copy it now.
			const stat =
				child instanceof TFile
					? decodeFileStatOption(child.stat)
					: Option.none();
			if (Option.isNone(stat)) {
				diagnostics.push(
					scanFailure(
						"scanFile",
						child.path,
						readerFailure(
							"stat",
							child.path,
							"Listed file has no stat",
						),
					),
				);
				continue;
			}
			if (splitPath.kind === "MdFile") {
				const mdPath = splitPath;
				entries.push({
					...mdPath,
					read: () => this.provideRead(this.readContent(mdPath)),
					stat: stat.value,
				});
			} else {
				entries.push({ ...splitPath, stat: stat.value });
			}
		}
		return Result.succeed(scanResult(entries, diagnostics, counts));
	}

	private readonly traverse = Effect.fn("VaultReader.scan")(function* <
		Entry extends VaultScanPath,
	>(
		this: VaultReader,
		folder: SplitPathToFolder,
		toEntry: (
			entry: VaultScanPath,
			file: TAbstractFile,
		) => Effect.Effect<Entry, VamVaultIoError, VamLiveServices>,
	) {
		const rootPath = pathfinder.systemPathFromSplitPath(folder);
		const startedAt = yield* Clock.currentTimeMillis;
		const entries: Entry[] = [];
		const diagnostics: VamScanError[] = [];
		const mutableCounts = {
			folderCount: 1,
			markdownFileCount: 0,
			otherFileCount: 0,
		};

		const traversal = Effect.gen({ self: this }, function* () {
			const rootChildren = yield* this.listChildren(folder).pipe(
				Effect.mapError((cause) => {
					const failure = scanFailure("scanRoot", rootPath, cause);
					diagnostics.push(failure);
					return failure;
				}),
			);
			const stack = sortChildren(rootChildren).reverse();

			while (stack.length > 0) {
				const child = stack.pop();
				if (!child) continue;
				const current = child.splitPath;
				if (current.kind === "Folder") {
					mutableCounts.folderCount += 1;
					const childrenResult = yield* Effect.result(
						this.listChildren(current),
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
					stack.push(
						...sortChildren(childrenResult.success).reverse(),
					);
					continue;
				}

				let entry: VaultScanPath;
				if (current.kind === "MdFile") {
					mutableCounts.markdownFileCount += 1;
					entry = {
						...current,
						read: () => this.provideRead(this.readContent(current)),
					};
				} else {
					mutableCounts.otherFileCount += 1;
					entry = current;
				}
				const entryResult = yield* Effect.result(
					toEntry(entry, child.file),
				);
				if (Result.isFailure(entryResult)) {
					diagnostics.push(
						scanFailure(
							"scanFile",
							pathfinder.systemPathFromSplitPath(current),
							entryResult.failure,
						),
					);
					continue;
				}
				entries.push(entryResult.success);
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

function sortChildren(children: readonly ListedChild[]): ListedChild[] {
	return [...children].sort((left, right) => {
		const leftPath = pathfinder.systemPathFromSplitPath(left.splitPath);
		const rightPath = pathfinder.systemPathFromSplitPath(right.splitPath);
		return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0;
	});
}

function sortTreeChildren(folder: TFolder): TAbstractFile[] {
	return [...folder.children].sort((left, right) =>
		left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
	);
}

function scanFailure(
	operation: VamScanError["operation"],
	path: string,
	cause: unknown,
): VamScanError {
	return new VamScanError({ cause, operation, path });
}

function scanResult<Entry extends VaultScanPath>(
	entries: readonly Entry[],
	diagnostics: readonly VamScanError[],
	counts: VaultScanCounts,
): VaultScanResult<Entry> {
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
