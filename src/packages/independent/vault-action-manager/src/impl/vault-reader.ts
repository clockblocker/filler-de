import { Effect, Result } from "effect";
import type { TFile, TFolder } from "obsidian";
import { VamVaultIoError } from "../effect/errors";
import { VaultIo } from "../effect/ports";
import type { TFileHelper } from "../file-services/background/helpers/tfile-helper";
import type { TFolderHelper } from "../file-services/background/helpers/tfolder-helper";
import type { MarkdownFileAccess } from "../file-services/markdown-file-access";
import { pathfinder } from "../helpers/pathfinder";
import type { DiscriminatedTAbstractFile } from "../helpers/pathfinder/types";
import { getErrorMessage } from "../internal/get-error-message";
import type {
	AnySplitPath,
	SplitPathToFile,
	SplitPathToFileWithTRef,
	SplitPathToFolder,
	SplitPathToFolderWithTRef,
	SplitPathToMdFile,
	SplitPathToMdFileWithTRef,
	SplitPathWithTRef,
} from "../types/split-path";

type VaultReaderReadableMdPath = SplitPathToMdFile & {
	read: () => ReturnType<MarkdownFileAccess["readContent"]>;
};

export type VaultReaderReadablePath =
	| VaultReaderReadableMdPath
	| SplitPathToFile;

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

	listAll(folder: SplitPathToFolder) {
		return Effect.gen({ self: this }, function* () {
			const all: SplitPathWithTRef[] = [];
			const stack: SplitPathToFolder[] = [folder];

			while (stack.length > 0) {
				const current = stack.pop();
				if (!current) continue;
				const childrenResult = yield* Effect.result(this.list(current));
				if (Result.isFailure(childrenResult)) {
					yield* Effect.logWarning(
						"[VaultReader] Failed to list folder:",
						current,
						getErrorMessage(childrenResult.failure.cause),
					);
					continue;
				}

				for (const child of childrenResult.success) {
					const tRefResult = yield* Effect.result(
						this.getAbstractFile(child),
					);
					if (Result.isFailure(tRefResult)) {
						yield* Effect.logWarning(
							"[VaultReader] Skipping unresolvable path:",
							child,
							getErrorMessage(tRefResult.failure.cause),
						);
						continue;
					}
					if (child.kind === "Folder") {
						all.push({
							...child,
							tRef: tRefResult.success as TFolder,
						} as SplitPathToFolderWithTRef);
						stack.push(child);
					} else if (child.kind === "MdFile") {
						all.push({
							...child,
							tRef: tRefResult.success as TFile,
						} as SplitPathToMdFileWithTRef);
					} else {
						all.push({
							...child,
							tRef: tRefResult.success as TFile,
						} as SplitPathToFileWithTRef);
					}
				}
			}

			return all;
		});
	}

	getAbstractFile<SP extends AnySplitPath>(target: SP) {
		type ReturnT = DiscriminatedTAbstractFile<SP>;
		const path = pathfinder.systemPathFromSplitPath(target);
		if (target.kind === "Folder") {
			return this.tfolderHelper.getFolder(target).pipe(
				Effect.mapError((error) =>
					readerFailure(
						"getAbstractFile",
						path,
						`Folder not found: ${getErrorMessage(error.cause)}`,
						error,
					),
				),
				Effect.map((value) => value as ReturnT),
			);
		}
		return this.tfileHelper.getFile(target).pipe(
			Effect.mapError((error) =>
				readerFailure(
					"getAbstractFile",
					path,
					`File not found: ${getErrorMessage(error.cause)}`,
					error,
				),
			),
			Effect.map((value) => value as ReturnT),
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

	listAllFilesWithMdReaders(folder: SplitPathToFolder) {
		return Effect.gen({ self: this }, function* () {
			const all: VaultReaderReadablePath[] = [];
			const stack: SplitPathToFolder[] = [folder];

			while (stack.length > 0) {
				const current = stack.pop();
				if (!current) continue;
				const children = yield* this.list(current);
				for (const child of children) {
					if (child.kind === "Folder") {
						stack.push(child);
					} else if (child.kind === "MdFile") {
						all.push({
							...child,
							read: () => this.readContent(child),
						});
					} else {
						all.push(child);
					}
				}
			}

			return all;
		});
	}
}
