import type { FileManager, TFile, TFolder, Vault } from "obsidian";
import type { PrettyPath } from "../../../../types/common-interface/dtos";
import { isReadonlyArray, type Prettify } from "../../../../types/helpers";
import type { FullPathToFolder } from "../../atomic-services/pathfinder";
import {
	splitPathFromAbstractFile,
	splitPathToFolderFromPrettyPath,
	splitPathToMdFileFromPrettyPath,
} from "../../atomic-services/pathfinder";
import { AbstractFileHelper } from "./abstract-file-helper";

/**
 * High-level file/folder service using PrettyPath.
 *
 * NOTE: Chain logic (create parent folders, cleanup empty folders)
 * is handled by DiffToActionsMapper + VaultActionQueue, NOT here.
 *
 * @see src/commanders/librarian/diffing/diff-to-actions.ts
 */
export class BackgroundFileService {
	private abstractFileService: AbstractFileHelper;
	private vault: Vault;

	constructor({
		vault,
		fileManager,
	}: { vault: Vault; fileManager: FileManager }) {
		this.vault = vault;
		this.abstractFileService = new AbstractFileHelper({
			fileManager,
			vault,
		});
	}

	// ─── File Operations ─────────────────────────────────────────────

	async readContent(prettyPath: PrettyPath) {
		const file = await this.abstractFileService.getMdFile(
			splitPathToMdFileFromPrettyPath(prettyPath),
		);
		return await this.vault.read(file);
	}

	async replaceContent(prettyPath: PrettyPath, content = "") {
		const file = await this.abstractFileService.getMdFile(
			splitPathToMdFileFromPrettyPath(prettyPath),
		);
		await this.vault.modify(file, content);
		return content;
	}

	/**
	 * Create file if it doesn't exist, or update content if it does.
	 * Useful for codex files that may or may not exist.
	 */
	async createOrUpdate(prettyPath: PrettyPath, content = ""): Promise<void> {
		const splitPath = splitPathToMdFileFromPrettyPath(prettyPath);
		const maybeFile =
			await this.abstractFileService.getMaybeAbstractFile(splitPath);

		if (maybeFile.error) {
			// File doesn't exist - create it
			await this.abstractFileService.createFiles([
				{ content, splitPath },
			]);
		} else {
			// File exists - update content
			await this.vault.modify(maybeFile.data, content);
		}
	}

	create(file: PrettyFileDto): Promise<void>;
	create(files: readonly PrettyFileDto[]): Promise<void>;

	async create(arg: PrettyFileDto | readonly PrettyFileDto[]): Promise<void> {
		if (isReadonlyArray(arg)) {
			return await this.abstractFileService.createFiles(
				arg.map((file) => ({
					...file,
					splitPath: splitPathToMdFileFromPrettyPath(file),
				})),
			);
		}

		return await this.abstractFileService.createFiles([
			{
				content: arg.content,
				splitPath: splitPathToMdFileFromPrettyPath(arg),
			},
		]);
	}

	move(file: PrettyFileFromTo): Promise<void>;
	move(files: readonly PrettyFileFromTo[]): Promise<void>;

	async move(
		arg: PrettyFileFromTo | readonly PrettyFileFromTo[],
	): Promise<void> {
		if (isReadonlyArray(arg)) {
			return await this.abstractFileService.moveFiles(
				arg.map(({ from, to }) => ({
					from: splitPathToMdFileFromPrettyPath(from),
					to: splitPathToMdFileFromPrettyPath(to),
				})),
			);
		}

		const { from, to } = arg;
		return await this.abstractFileService.moveFiles([
			{
				from: splitPathToMdFileFromPrettyPath(from),
				to: splitPathToMdFileFromPrettyPath(to),
			},
		]);
	}

	trash(file: PrettyPath): Promise<void>;
	trash(files: readonly PrettyPath[]): Promise<void>;
	async trash(arg: PrettyPath | readonly PrettyPath[]): Promise<void> {
		if (isReadonlyArray(arg)) {
			return await this.abstractFileService.trashFiles(
				arg.map((file) => splitPathToMdFileFromPrettyPath(file)),
			);
		}

		return await this.abstractFileService.trashFiles([
			splitPathToMdFileFromPrettyPath(arg),
		]);
	}

	rename(file: PrettyFileFromTo): Promise<void>;
	rename(files: readonly PrettyFileFromTo[]): Promise<void>;

	async rename(
		arg: PrettyFileFromTo | readonly PrettyFileFromTo[],
	): Promise<void> {
		if (isReadonlyArray(arg)) {
			return await this.move(arg);
		}
		return await this.move(arg);
	}

	// ─── Folder Operations ───────────────────────────────────────────

	async createFolder(prettyPath: PrettyPath): Promise<TFolder> {
		return this.abstractFileService.createFolder(
			splitPathToFolderFromPrettyPath(prettyPath),
		);
	}

	async trashFolder(prettyPath: PrettyPath): Promise<void> {
		return this.abstractFileService.trashFolder(
			splitPathToFolderFromPrettyPath(prettyPath),
		);
	}

	async renameFolder(from: PrettyPath, to: PrettyPath): Promise<void> {
		return this.abstractFileService.renameFolder(
			splitPathToFolderFromPrettyPath(from),
			splitPathToFolderFromPrettyPath(to),
		);
	}

	// ─── Read Operations ─────────────────────────────────────────────

	async getReadersToAllMdFilesInFolder(
		pathToFoulder: FullPathToFolder,
	): Promise<ReadablePrettyFile[]> {
		const tFiles = await this.lsTfiles(pathToFoulder);

		return tFiles.map((tfile) => ({
			...splitPathFromAbstractFile(tfile),
			readContent: async () => await this.vault.read(tfile),
		}));
	}

	private async lsTfiles(pathToFoulder: FullPathToFolder): Promise<TFile[]> {
		const tFiles =
			await this.abstractFileService.deepListMdFiles(pathToFoulder);

		return tFiles;
	}
}

export type ReadablePrettyFile = Prettify<
	PrettyPath & {
		readContent: () => Promise<string>;
	}
>;

export type PrettyFileDto = Prettify<
	PrettyPath & {
		content?: string;
	}
>;
export type PrettyFileFromTo = { from: PrettyFileDto; to: PrettyFileDto };
