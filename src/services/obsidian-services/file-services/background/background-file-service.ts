import type { FileManager, Vault } from "obsidian";
import { TFile, TFolder } from "obsidian";
import { LIBRARY_ROOTSLegacy } from "../../../../commanders/librarian/constants";
import type { PrettyPathLegacy } from "../../../../types/common-interface/dtos";
import { isReadonlyArray, type Prettify } from "../../../../types/helpers";
import type { LegacyFullPathToFolder } from "../../atomic-services/pathfinder";
import {
	legacyFullPathToFolderFromPrettyPathLegacy,
	legacyFullPathToMdFileFromPrettyPathLegacy,
	legacyGetFullPathForAbstractFile,
} from "../../atomic-services/pathfinder";
import { LegacyAbstractFileHelper } from "./abstract-file-helper";

/**
 * High-level file/folder service using PrettyPathLegacy.
 *
 * NOTE: Chain logic (create parent folders, cleanup empty folders)
 * is handled by mapDiffToActions + VaultActionQueue, NOT here.
 *
 * @see src/commanders/librarian/diffing/tree-diff-applier.ts
 */
export class LegacyBackgroundFileServiceLegacy {
	private abstractFileService: LegacyAbstractFileHelper;
	private vault: Vault;

	constructor({
		vault,
		fileManager,
	}: { vault: Vault; fileManager: FileManager }) {
		this.vault = vault;
		this.abstractFileService = new LegacyAbstractFileHelper({
			fileManager,
			vault,
		});
	}

	// ─── File Operations ─────────────────────────────────────────────

	async readContent(prettyPath: PrettyPathLegacy) {
		const file = await this.abstractFileService.getMdFile(
			legacyFullPathToMdFileFromPrettyPathLegacy(prettyPath),
		);
		return await this.vault.read(file);
	}

	async exists(prettyPath: PrettyPathLegacy): Promise<boolean> {
		const maybeFile =
			await this.abstractFileService.getMaybeLegacyAbstractFile(
				legacyFullPathToMdFileFromPrettyPathLegacy(prettyPath),
			);
		return !maybeFile.error;
	}

	async replaceContent(prettyPath: PrettyPathLegacy, content = "") {
		const file = await this.abstractFileService.getMdFile(
			legacyFullPathToMdFileFromPrettyPathLegacy(prettyPath),
		);
		await this.vault.modify(file, content);
		return content;
	}

	logDeepLs(): void {
		for (const rootName of LIBRARY_ROOTSLegacy) {
			const folder = this.vault.getAbstractFileByPath(rootName);
			if (!folder || !(folder instanceof TFolder)) {
				console.log(
					`[BackgroundFileServiceLegacy] Root not found: ${rootName}`,
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
				`[BackgroundFileServiceLegacy] Deep LS for ${rootName}:\n${lines.join(
					"\n",
				)}`,
			);
		}
	}

	/**
	 * Create file if it doesn't exist, or update content if it does.
	 * Useful for codex files that may or may not exist.
	 */
	async createOrUpdate(
		prettyPath: PrettyPathLegacy,
		content = "",
	): Promise<void> {
		const fullPath = legacyFullPathToMdFileFromPrettyPathLegacy(prettyPath);
		const maybeFile =
			await this.abstractFileService.getMaybeLegacyAbstractFile(fullPath);

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
					fullPath: legacyFullPathToMdFileFromPrettyPathLegacy(file),
				})),
			);
		}

		return await this.abstractFileService.createFiles([
			{
				content: arg.content,
				fullPath: legacyFullPathToMdFileFromPrettyPathLegacy(arg),
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
					from: legacyFullPathToMdFileFromPrettyPathLegacy(from),
					to: legacyFullPathToMdFileFromPrettyPathLegacy(to),
				})),
			);
		}

		const { from, to } = arg;
		return await this.abstractFileService.moveFiles([
			{
				from: legacyFullPathToMdFileFromPrettyPathLegacy(from),
				to: legacyFullPathToMdFileFromPrettyPathLegacy(to),
			},
		]);
	}

	trash(file: PrettyPathLegacy): Promise<void>;
	trash(files: readonly PrettyPathLegacy[]): Promise<void>;
	async trash(
		arg: PrettyPathLegacy | readonly PrettyPathLegacy[],
	): Promise<void> {
		if (isReadonlyArray(arg)) {
			return await this.abstractFileService.trashFiles(
				arg.map((file) =>
					legacyFullPathToMdFileFromPrettyPathLegacy(file),
				),
			);
		}

		return await this.abstractFileService.trashFiles([
			legacyFullPathToMdFileFromPrettyPathLegacy(arg),
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

	async createFolder(prettyPath: PrettyPathLegacy): Promise<TFolder> {
		return this.abstractFileService.createFolder(
			legacyFullPathToFolderFromPrettyPathLegacy(prettyPath),
		);
	}

	async trashFolder(prettyPath: PrettyPathLegacy): Promise<void> {
		return this.abstractFileService.trashFolder(
			legacyFullPathToFolderFromPrettyPathLegacy(prettyPath),
		);
	}

	async renameFolder(
		from: PrettyPathLegacy,
		to: PrettyPathLegacy,
	): Promise<void> {
		return this.abstractFileService.renameFolder(
			legacyFullPathToFolderFromPrettyPathLegacy(from),
			legacyFullPathToFolderFromPrettyPathLegacy(to),
		);
	}

	// ─── Read Operations ─────────────────────────────────────────────

	async getReadersToAllMdFilesInFolder(
		pathToFoulder: LegacyFullPathToFolder,
	): Promise<ReadablePrettyFile[]> {
		const tFiles = await this.lsTfiles(pathToFoulder);

		return tFiles.map((tfile) => ({
			...legacyGetFullPathForAbstractFile(tfile),
			readContent: async () => await this.vault.read(tfile),
		}));
	}

	private async lsTfiles(
		pathToFoulder: LegacyFullPathToFolder,
	): Promise<TFile[]> {
		const tFiles =
			await this.abstractFileService.deepListMdFiles(pathToFoulder);

		return tFiles;
	}
}

export type ReadablePrettyFile = Prettify<
	PrettyPathLegacy & {
		readContent: () => Promise<string>;
	}
>;

export type PrettyFileDto = Prettify<
	PrettyPathLegacy & {
		content?: string;
	}
>;
export type PrettyFileFromTo = { from: PrettyFileDto; to: PrettyFileDto };
