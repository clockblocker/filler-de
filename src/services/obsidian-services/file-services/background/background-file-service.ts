import type { FileManager, Vault } from "obsidian";
import { TFile, TFolder } from "obsidian";
import { LIBRARY_ROOTS } from "../../../../commanders/librarian/constants";
import type { PrettyPath } from "../../../../types/common-interface/dtos";
import { isReadonlyArray, type Prettify } from "../../../../types/helpers";
import type { FullPathToFolder } from "../../atomic-services/pathfinder";
import {
	fullPathToFolderFromPrettyPath,
	fullPathToMdFileFromPrettyPath,
	getFullPathForAbstractFile,
} from "../../atomic-services/pathfinder";
import { AbstractFileHelper } from "./abstract-file-helper";

/**
 * High-level file/folder service using PrettyPath.
 *
 * NOTE: Chain logic (create parent folders, cleanup empty folders)
 * is handled by mapDiffToActions + VaultActionQueue, NOT here.
 *
 * @see src/commanders/librarian/diffing/tree-diff-applier.ts
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
			fullPathToMdFileFromPrettyPath(prettyPath),
		);
		return await this.vault.read(file);
	}

	async exists(prettyPath: PrettyPath): Promise<boolean> {
		const maybeFile = await this.abstractFileService.getMaybeAbstractFile(
			fullPathToMdFileFromPrettyPath(prettyPath),
		);
		return !maybeFile.error;
	}

	async replaceContent(prettyPath: PrettyPath, content = "") {
		const file = await this.abstractFileService.getMdFile(
			fullPathToMdFileFromPrettyPath(prettyPath),
		);
		await this.vault.modify(file, content);
		return content;
	}

	logDeepLs(): void {
		for (const rootName of LIBRARY_ROOTS) {
			const folder = this.vault.getAbstractFileByPath(rootName);
			if (!folder || !(folder instanceof TFolder)) {
				console.log(
					`[BackgroundFileService] Root not found: ${rootName}`,
				);
				continue;
			}

			const lines: string[] = [];

			const walkFolder = (node: TFolder, indent: string): void => {
				lines.push(`${indent}📁 ${node.name}`);

				for (const child of node.children) {
					if (child instanceof TFile) {
						if (child.extension === "md") {
							if (child.basename.startsWith("__")) {
								lines.push(`${indent}  📜 __${node.name}`);
							} else {
								lines.push(`${indent}  📄 ${child.basename}`);
							}
						}
					} else if (child instanceof TFolder) {
						walkFolder(child, `${indent}  `);
					}
				}
			};

			walkFolder(folder, "");
			console.log(
				`[BackgroundFileService] Deep LS for ${rootName}:\n${lines.join(
					"\n",
				)}`,
			);
		}
	}

	/**
	 * Create file if it doesn't exist, or update content if it does.
	 * Useful for codex files that may or may not exist.
	 */
	async createOrUpdate(prettyPath: PrettyPath, content = ""): Promise<void> {
		const fullPath = fullPathToMdFileFromPrettyPath(prettyPath);
		const maybeFile =
			await this.abstractFileService.getMaybeAbstractFile(fullPath);

		if (maybeFile.error) {
			// File doesn't exist - create it
			await this.abstractFileService.createFiles([{ content, fullPath }]);
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
					fullPath: fullPathToMdFileFromPrettyPath(file),
				})),
			);
		}

		return await this.abstractFileService.createFiles([
			{
				content: arg.content,
				fullPath: fullPathToMdFileFromPrettyPath(arg),
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
					from: fullPathToMdFileFromPrettyPath(from),
					to: fullPathToMdFileFromPrettyPath(to),
				})),
			);
		}

		const { from, to } = arg;
		return await this.abstractFileService.moveFiles([
			{
				from: fullPathToMdFileFromPrettyPath(from),
				to: fullPathToMdFileFromPrettyPath(to),
			},
		]);
	}

	trash(file: PrettyPath): Promise<void>;
	trash(files: readonly PrettyPath[]): Promise<void>;
	async trash(arg: PrettyPath | readonly PrettyPath[]): Promise<void> {
		if (isReadonlyArray(arg)) {
			return await this.abstractFileService.trashFiles(
				arg.map((file) => fullPathToMdFileFromPrettyPath(file)),
			);
		}

		return await this.abstractFileService.trashFiles([
			fullPathToMdFileFromPrettyPath(arg),
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
			fullPathToFolderFromPrettyPath(prettyPath),
		);
	}

	async trashFolder(prettyPath: PrettyPath): Promise<void> {
		return this.abstractFileService.trashFolder(
			fullPathToFolderFromPrettyPath(prettyPath),
		);
	}

	async renameFolder(from: PrettyPath, to: PrettyPath): Promise<void> {
		return this.abstractFileService.renameFolder(
			fullPathToFolderFromPrettyPath(from),
			fullPathToFolderFromPrettyPath(to),
		);
	}

	// ─── Read Operations ─────────────────────────────────────────────

	async getReadersToAllMdFilesInFolder(
		pathToFoulder: FullPathToFolder,
	): Promise<ReadablePrettyFile[]> {
		const tFiles = await this.lsTfiles(pathToFoulder);

		return tFiles.map((tfile) => ({
			...getFullPathForAbstractFile(tfile),
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
