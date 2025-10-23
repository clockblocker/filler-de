import { type TAbstractFile, TFile, TFolder, type Vault } from "obsidian";
import type {
	PathParts,
	PrettyPath,
} from "../../../types/common-interface/dtos";
import { type Maybe, unwrapMaybe } from "../../../types/common-interface/maybe";
import { SLASH } from "../../../types/literals";
import {
	pathToFolderFromPathParts,
	systemFilePathToPrettyPath,
	systemPathFromPrettyPath,
	systemPathToPrettyPath,
} from "../../dto-services/pathfinder/path-helpers";
import { logError, logWarning } from "../helpers/issue-handlers";

export class BackgroundFileService {
	constructor(private vault: Vault) {}

	async getFile(prettyPath: PrettyPath): Promise<TFile> {
		const mbFile = await this.getMaybeFileByPrettyPath(prettyPath);
		return unwrapMaybe(mbFile);
	}

	async createFileInPrettyPath(
		prettyPath: PrettyPath,
		content = "",
	): Promise<Maybe<TFile>> {
		if (prettyPath.type !== "file") {
			return {
				description: "Expected file type in prettyPath",
				error: true,
			};
		}
		const systemPath = systemPathFromPrettyPath(prettyPath);
		return await this.createMaybeFileInSystemPath(systemPath, content);
	}

	async x(prettyPath: PrettyPath): Promise<Maybe<TFolder>> {
		if (prettyPath.type !== "folder") {
			return {
				description: "Expected folder type in prettyPath",
				error: true,
			};
		}
		const systemPath = systemPathFromPrettyPath(prettyPath);

		return await this.createMaybeFolderBySystemPath(systemPath);
	}

	async createFileInFolder(
		folder: TFolder,
		title: PrettyPath["basename"],
	): Promise<Maybe<TFile>> {
		const path = `${folder.path}/${title}`;
		const maybeFile = await this.createMaybeFileInSystemPath(path);

		return maybeFile;
	}

	async renameFile(prettyPath: PrettyPath, newName: string): Promise<TFile> {
		if (prettyPath.type !== "file") {
			throw new Error("Expected file type in prettyPath");
		}
		const systemPath = systemPathFromPrettyPath(prettyPath);
		const maybeFile = await this.renameMaybeFileInSystemPath(
			systemPath,
			newName,
		);

		return unwrapMaybe(maybeFile);
	}

	async renameFolder(
		prettyPath: PrettyPath,
		newName: string,
	): Promise<TFolder> {
		if (prettyPath.type !== "folder") {
			throw new Error("Expected folder type in prettyPath");
		}
		const systemPath = systemPathFromPrettyPath(prettyPath);
		const maybeFolder = await this.renameMaybeFolderInSystemPath(
			systemPath,
			newName,
		);
		return unwrapMaybe(maybeFolder);
	}

	async createFolderInFolder(
		folder: TFolder,
		title: PrettyPath["basename"],
	): Promise<Maybe<TFolder>> {
		const path = `${folder.path}/${title}`;
		const maybeFolder = await this.createMaybeFolderBySystemPath(path);

		return maybeFolder;
	}

	async readFileContent(prettyPath: PrettyPath): Promise<string> {
		const maybeFile = await this.getFile(prettyPath);
		const content = await this.vault.read(maybeFile);

		return content;
	}

	async replaceFileContent(
		prettyPath: PrettyPath,
		content: string,
	): Promise<string> {
		const maybeFile = await this.getFile(prettyPath);
		await this.vault.modify(maybeFile, content);

		return content;
	}

	async getParentOfFileWithPath(prettyPath: PrettyPath): Promise<TFolder> {
		const maybeParent = await this.getMaybeParentOfFileWithPath(prettyPath);
		return unwrapMaybe(maybeParent);
	}

	async getSiblingsOfFileWithPath(
		prettyPath: PrettyPath,
	): Promise<Maybe<Array<TFile>>> {
		const maybeFile = await this.getMaybeFileByPrettyPath(prettyPath);
		const file = unwrapMaybe(maybeFile);

		return this.getSiblingsOfFile(file);
	}

	async createManyFiles(
		files: Array<{
			prettyPath: Extract<PrettyPath, { type: "file" }>;
			content?: string;
		}>,
	): Promise<TFile[]> {
		// Verify existence of all the folders for each file's path, and create them if missing
		for (const { prettyPath } of files) {
			const path = systemPathFromPrettyPath(prettyPath);
			const folderPath = path.substring(0, path.lastIndexOf("/"));
			if (folderPath && !this.vault.getAbstractFileByPath(folderPath)) {
				// Recursively create missing folders
				const parts = folderPath.split("/");
				let currentPath = "";
				for (const part of parts) {
					currentPath = currentPath ? `${currentPath}/${part}` : part;
					if (!this.vault.getAbstractFileByPath(currentPath)) {
						await this.vault.createFolder(currentPath);
					}
				}
			}
		}

		const created = await this.createManyFilesInExistingFolders(files);
		return unwrapMaybe(created);
	}

	async createManyFolders(
		prettyPaths: Extract<PrettyPath, { type: "folder" }>[],
	): Promise<Maybe<TFolder[]>> {
		const created: TFolder[] = [];
		const errors: string[] = [];

		for (const prettyPath of prettyPaths) {
			const path = systemPathFromPrettyPath(prettyPath);

			const existing = this.vault.getAbstractFileByPath(path);
			if (existing instanceof TFolder) {
				continue; // skip if already exists
			}

			const maybeFolder = await this.createMaybeFolderBySystemPath(path);
			created.push(unwrapMaybe(maybeFolder));
		}

		if (errors.length > 0) {
			logWarning({
				description: `Failed to create many folders: ${errors.join(", ")}`,
				location: "BackgroundFileService",
			});
		}

		return { data: created, error: false };
	}

	async renameManyFolders(
		folders: Array<{
			prettyPath: Extract<PrettyPath, { type: "folder" }>;
			newName: string;
		}>,
	): Promise<TFolder[]> {
		const renamed: TFolder[] = [];
		const errors: string[] = [];

		for (const { prettyPath, newName } of folders) {
			const systemPath = systemPathFromPrettyPath(prettyPath);
			const maybeFolder = await this.renameMaybeFolderInSystemPath(
				systemPath,
				newName,
			);

			if (maybeFolder.error) {
				errors.push(`${prettyPath}: ${maybeFolder.description}`);
				continue;
			}

			renamed.push(unwrapMaybe(maybeFolder));
		}

		if (errors.length > 0) {
			logWarning({
				description: `Failed to rename many folders: ${errors.join(", ")}`,
				location: "BackgroundFileService",
			});
		}

		return renamed;
	}

	async deepListFiles(
		prettyPathToFolder: PrettyPath,
	): Promise<Array<PrettyPath>> {
		const files = await this.deepListMaybeFiles(prettyPathToFolder);
		return unwrapMaybe(files);
	}

	async listFilesInFolder(
		prettyPathToFolder: PrettyPath,
	): Promise<Array<PrettyPath>> {
		const maybeFiles =
			await this.listMaybeFilesInFolder(prettyPathToFolder);
		return unwrapMaybe(maybeFiles);
	}

	async renameManyFiles(
		files: Array<{
			prettyPath: Extract<PrettyPath, { type: "file" }>;
			newName: string;
		}>,
	): Promise<TFile[]> {
		const renamed: TFile[] = [];
		const errors: string[] = [];

		for (const { prettyPath, newName } of files) {
			const systemPath = systemPathFromPrettyPath(prettyPath);
			const maybeFile = await this.renameMaybeFileInSystemPath(
				systemPath,
				newName,
			);

			if (maybeFile.error) {
				errors.push(`${prettyPath}: ${maybeFile.description}`);
				continue;
			}

			renamed.push(unwrapMaybe(maybeFile));
		}

		if (errors.length > 0) {
			logWarning({
				description: `Failed to rename many files: ${errors.join(", ")}`,
				location: "BackgroundFileService",
			});
		}

		return renamed;
	}

	private async getMaybeParentOfFileWithPath(
		prettyPath: PrettyPath,
	): Promise<Maybe<TFolder>> {
		const maybeFile = await this.getMaybeFileByPrettyPath(prettyPath);
		if (maybeFile.error) return maybeFile;

		const parent = unwrapMaybe(maybeFile).parent;

		if (!parent) {
			return { description: "File does not have a parent", error: true };
		}

		return { data: parent, error: false };
	}

	private async getSiblingsOfFile(file: TFile): Promise<Maybe<Array<TFile>>> {
		const parent = file.parent;

		if (parent && parent instanceof TFolder) {
			const siblings = parent.children
				.filter((child): child is TFile => child instanceof TFile)
				.filter((f) => f.path !== file.path);
			return { data: siblings, error: false };
		}

		return { data: [], error: false };
	}

	private async getMaybeFileByPrettyPath(
		prettyPath: PrettyPath,
	): Promise<Maybe<TFile>> {
		if (prettyPath.type !== "file") {
			return {
				description: "Expected file type in prettyPath",
				error: true,
			};
		}
		const filePath = systemPathFromPrettyPath(prettyPath);
		try {
			const file = this.vault.getAbstractFileByPath(filePath);
			if (!file || !(file instanceof TFile)) {
				return { error: true };
			}
			return { data: file, error: false };
		} catch (error) {
			logError({
				description: `Failed to get file by path: ${error}`,
				location: "BackgroundFileService",
			});
			return { error: true };
		}
	}

	private async getMaybeFolderByPrettyPath(
		prettyPath: PrettyPath,
	): Promise<Maybe<TFolder>> {
		if (prettyPath.type !== "folder") {
			return {
				description: "Expected folder type in prettyPath",
				error: true,
			};
		}
		const folderPath = systemPathFromPrettyPath(prettyPath);
		const folder = this.vault.getAbstractFileByPath(folderPath);
		if (!folder || !(folder instanceof TFolder)) {
			return {
				description: `Folder not found: ${folderPath}`,
				error: true,
			};
		}
		return { data: folder, error: false };
	}

	private async renameMaybeFileInSystemPath(
		systemPath: string,
		newName: string,
	): Promise<Maybe<TFile>> {
		try {
			const file = await this.vault.getFileByPath(systemPath);
			if (!(file instanceof TFile)) {
				return {
					description: "Renamed item is not a file",
					error: true,
				};
			}

			await this.vault.rename(file, newName);

			return { data: file, error: false };
		} catch (error) {
			return {
				description: `Failed to rename file: ${error}`,
				error: true,
			};
		}
	}

	private async renameMaybeFolderInSystemPath(
		systemPath: string,
		newName: string,
	): Promise<Maybe<TFolder>> {
		try {
			const folder = await this.vault.getFolderByPath(systemPath);
			if (!(folder instanceof TFolder)) {
				return {
					description: "Renamed item is not a folder",
					error: true,
				};
			}

			await this.vault.rename(folder, newName);

			return { data: folder, error: false };
		} catch (error) {
			return {
				description: `Failed to rename folder: ${error}`,
				error: true,
			};
		}
	}

	private async createMaybeFileInSystemPath(
		systemPath: string,
		content = "",
	): Promise<Maybe<TFile>> {
		try {
			const file = await this.vault.create(`${systemPath}`, content);
			if (!(file instanceof TFile)) {
				return {
					description: "Created item is not a file",
					error: true,
				};
			}

			return { data: file, error: false };
		} catch (error) {
			return {
				description: `Failed to create file: ${error}`,
				error: true,
			};
		}
	}

	private async createMaybeFolderBySystemPath(
		systemPath: string,
	): Promise<Maybe<TFolder>> {
		try {
			const folder = await this.vault.createFolder(systemPath);

			return { data: folder, error: false };
		} catch (error) {
			return {
				description: `Failed to create folder: ${error}`,
				error: true,
			};
		}
	}

	private async createManyFilesInExistingFolders(
		files: Array<{
			prettyPath: Extract<PrettyPath, { type: "file" }>;
			content?: string;
		}>,
	): Promise<Maybe<TFile[]>> {
		const created: TFile[] = [];
		const errors: string[] = [];

		for (const { prettyPath, content = "" } of files) {
			const path = systemPathFromPrettyPath(prettyPath);

			const existing = this.vault.getAbstractFileByPath(path);
			if (existing instanceof TFile) {
				continue; // skip existing file
			}

			const file = await this.createMaybeFileInSystemPath(path, content);
			if (file.error) {
				errors.push(`${path}: ${file.description}`);
				continue;
			}

			created.push(unwrapMaybe(file));
		}

		if (errors.length > 0) {
			logWarning({
				description: `Failed to create many files: ${errors.join(", ")}`,
				location: "BackgroundFileService",
			});
		}

		return { data: created, error: false };
	}

	private async listMaybeFilesInFolder(
		prettyPathToFolder: PrettyPath,
	): Promise<Maybe<Array<PrettyPath>>> {
		const maybeFolder =
			await this.getMaybeFolderByPrettyPath(prettyPathToFolder);
		if (maybeFolder.error) return maybeFolder;

		const folder = unwrapMaybe(maybeFolder);
		const files = folder.children.filter(
			(child): child is TFile => child instanceof TFile,
		);

		return {
			data: files.map((file) => systemFilePathToPrettyPath(file.path)),
			error: false,
		};
	}

	private async deepListMaybeFiles(
		prettyPathToFolder: PrettyPath,
	): Promise<Maybe<Array<PrettyPath>>> {
		const maybeFolder =
			await this.getMaybeFolderByPrettyPath(prettyPathToFolder);
		if (maybeFolder.error) return maybeFolder;

		const folder = unwrapMaybe(maybeFolder);
		const files = await Promise.all(
			folder.children.flatMap(async (child) => {
				if (child instanceof TFile) {
					return [systemFilePathToPrettyPath(child.path)];
				}
				return this.deepListMaybeFiles(
					systemPathToPrettyPath(child.path),
				).then(unwrapMaybe);
			}),
		);

		return { data: files.flat(), error: false };
	}
}

type AbstractFile<T extends PrettyPath> = T extends { type: "file" }
	? TFile
	: TFolder;

class AbstractFileService {
	constructor(private vault: Vault) {}

	async getAbstractFile<T extends PrettyPath>(
		prettyPath: T,
	): Promise<AbstractFile<T>> {
		const mbFile = await this.getMaybeAbstractFileByPrettyPath(prettyPath);
		return unwrapMaybe(mbFile);
	}

	getPrettyPath<T extends PrettyPath>(abstractFile: AbstractFile<T>): T {
		const path = abstractFile.path;
		const splitPath = path.split(SLASH).filter(Boolean);
		const title = splitPath.pop() ?? "";

		if (abstractFile instanceof TFolder) {
			return {
				basename: title,
				pathParts: splitPath,
				type: "folder",
			} as T;
		}

		return {
			basename: abstractFile.basename,
			extension: abstractFile.extension,
			pathParts: splitPath,
			type: "file",
		} as T;
	}

	private async getMaybeAbstractFileByPrettyPath<T extends PrettyPath>(
		prettyPath: T,
	): Promise<Maybe<AbstractFile<T>>> {
		const systemPath = systemPathFromPrettyPath(prettyPath);
		const mbTabstractFile = this.vault.getAbstractFileByPath(systemPath);
		if (!mbTabstractFile) {
			return {
				description: `Failed to get file by path: ${systemPath}`,
				error: true,
			};
		}

		switch (prettyPath.type) {
			case "file":
				if (mbTabstractFile instanceof TFile) {
					return {
						data: mbTabstractFile as AbstractFile<T>,
						error: false,
					};
				}
				break;
			case "folder":
				if (mbTabstractFile instanceof TFolder) {
					return {
						data: mbTabstractFile as AbstractFile<T>,
						error: false,
					};
				}
				break;

			default:
				break;
		}
		return {
			description: "Expected file type missmatched the found type",
			error: true,
		};
	}
}
