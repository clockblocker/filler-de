import { type FileManager, TFile, TFolder, type Vault } from "obsidian";
import {
	type Maybe,
	unwrapMaybeByThrowing,
} from "../../../../types/common-interface/maybe";
import { systemPathFromSplitPath } from "../pathfinder";
import type {
	AbstractFile,
	FileFromTo,
	FileWithContent,
	SplitPath,
	SplitPathToFile,
	SplitPathToFolder,
} from "../types";
import { TFileHelper } from "./helpers/tfile-helper";
import { TFolderHelper } from "./helpers/tfolder-helper";

export class AbstractFileHelper {
	private vault: Vault;
	private tfileHelper: TFileHelper;
	private tfolderHelper: TFolderHelper;

	constructor({
		vault,
		fileManager,
	}: { vault: Vault; fileManager: FileManager }) {
		this.vault = vault;
		this.tfileHelper = new TFileHelper({ fileManager, vault });
		this.tfolderHelper = new TFolderHelper({ fileManager, vault });
	}

	async createFiles(files: readonly FileWithContent[]): Promise<void> {
		const splitPathToParentFolders = files.map(({ splitPath }) =>
			this.getSplitPathToParentFolder(splitPath),
		);

		await this.tfolderHelper.createFolderChains(splitPathToParentFolders);
		await this.tfileHelper.createFiles(files);
	}

	async moveFiles(fromTos: readonly FileFromTo[]): Promise<void> {
		const splitPathToParentTargetFolders = fromTos.map(({ from, to }) => ({
			from: this.getSplitPathToParentFolder(from),
			to: this.getSplitPathToParentFolder(to),
		}));

		await this.tfolderHelper.createFolderChains(
			splitPathToParentTargetFolders.map(({ to }) => to),
		);

		await this.tfileHelper.moveFiles(fromTos);

		await this.tfolderHelper.cleanUpFolderChains(
			splitPathToParentTargetFolders.map(({ to }) => to),
		);
	}

	private getSplitPathToParentFolder(
		splitPathToFile: SplitPathToFile,
	): SplitPathToFolder {
		return unwrapMaybeByThrowing(
			this.getMaybeSplitPathToParentFolder(splitPathToFile),
			"AbstractFileHelper.createFiles",
		);
	}

	private getMaybeSplitPathToParentFolder(
		splitPathToFile: SplitPathToFile,
	): Maybe<SplitPathToFolder> {
		const filePathParts = [...splitPathToFile.pathParts];

		if (filePathParts.length < 2) {
			return {
				description: "Expected at least 2 path parts for file",
				error: true,
			};
		}

		const basename = filePathParts.pop() ?? "";
		const pathParts = filePathParts;

		return {
			data: {
				basename,
				pathParts,
				type: "folder",
			},
			error: false,
		};
	}

	async getMdFile(splitPath: SplitPathToFile): Promise<TFile> {
		return unwrapMaybeByThrowing(
			await this.getMaybeAbstractFile(splitPath),
		);
	}

	async getMaybeAbstractFile<T extends SplitPath>(
		splitPath: T,
	): Promise<Maybe<AbstractFile<T>>> {
		const systemPath = systemPathFromSplitPath(splitPath);
		const mbTabstractFile = this.vault.getAbstractFileByPath(systemPath);
		if (!mbTabstractFile) {
			return {
				description: `Failed to get file by path: ${systemPath}`,
				error: true,
			};
		}

		switch (splitPath.type) {
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

	// private async checkIfFileExists(prettyPath: PrettyPath) {
	// 	return !!(await this.getNullableFile(prettyPath));
	// }

	// private async getMaybeFolder(
	// 	prettyPath: SplitPath,
	// ): Promise<Maybe<TFolder>> {
	// 	if (prettyPath.type !== "folder") {
	// 		return {
	// 			description: "Expected folder type in prettyPath",
	// 			error: true,
	// 		};
	// 	}
	// 	const systemPath = systemPathFromSplitPath(prettyPath);

	// 	return await this.createMaybeFolderBySystemPath(systemPath);
	// }
}

// private async createFile({
// 	splitPath,
// 	content,
// }: FileWithContent): Promise<void> {
// 	const splitPathToParentFolder =
// 		this.getSplitPathToParentFolder(splitPath);

// 	await this.tfolderHelper.createFolderChain(splitPathToParentFolder);
// 	await this.tfileHelper.createFile({
// 		content,
// 		splitPath,
// 	});
// }

// private async moveFile({ from, to }: FileFromTo): Promise<void> {
// 	const splitPathToParentTargetFolder =
// 		this.getSplitPathToParentFolder(to);

// 	await this.tfolderHelper.createFolderChain(
// 		splitPathToParentTargetFolder,
// 	);

// 	await this.tfileHelper.moveFile({
// 		from,
// 		to,
// 	});

// 	await this.tfolderHelper.cleanUpFolderChain(
// 		splitPathToParentTargetFolder,
// 	);
// }

// Legacy implementation
// async createFileInFolder(
// 	folder: TFolder,
// 	title: SplitPath["basename"],
// ): Promise<Maybe<TFile>> {
// 	const path = `${folder.path}/${title}`;
// 	const maybeFile = await this.createMaybeFileInSystemPath(path);

// 	return maybeFile;
// }

// async renameFile(prettyPath: SplitPath, newName: string): Promise<TFile> {
// 	if (prettyPath.type !== "file") {
// 		throw new Error("Expected file type in prettyPath");
// 	}
// 	const systemPath = systemPathFromSplitPath(prettyPath);
// 	const maybeFile = await this.renameMaybeFileInSystemPath(
// 		systemPath,
// 		newName,
// 	);

// 	return unwrapMaybe(maybeFile);
// }

// async renameFolder(
// 	prettyPath: SplitPath,
// 	newName: string,
// ): Promise<TFolder> {
// 	if (prettyPath.type !== "folder") {
// 		throw new Error("Expected folder type in prettyPath");
// 	}
// 	const systemPath = systemPathFromSplitPath(prettyPath);
// 	const maybeFolder = await this.renameMaybeFolderInSystemPath(
// 		systemPath,
// 		newName,
// 	);
// 	return unwrapMaybe(maybeFolder);
// }

// async createFolderInFolder(
// 	folder: TFolder,
// 	title: SplitPath["basename"],
// ): Promise<Maybe<TFolder>> {
// 	const path = `${folder.path}/${title}`;
// 	const maybeFolder = await this.createMaybeFolderBySystemPath(path);

// 	return maybeFolder;
// }

// async getParentOfFileWithPath(prettyPath: SplitPath): Promise<TFolder> {
// 	const maybeParent = await this.getMaybeParentOfFileWithPath(prettyPath);
// 	return unwrapMaybe(maybeParent);
// }

// async getSiblingsOfFileWithPath(
// 	prettyPath: SplitPath,
// ): Promise<Maybe<Array<TFile>>> {
// 	const maybeFile = await this.getMaybeFileByPrettyPath(prettyPath);
// 	const file = unwrapMaybe(maybeFile);

// 	return this.getSiblingsOfFile(file);
// }

// async createManyFiles(
// 	files: Array<{
// 		prettyPath: Extract<SplitPath, { type: "file" }>;
// 		content?: string;
// 	}>,
// ): Promise<TFile[]> {
// 	// Verify existence of all the folders for each file's path, and create them if missing
// 	for (const { prettyPath } of files) {
// 		const path = systemPathFromSplitPath(prettyPath);
// 		const folderPath = path.substring(0, path.lastIndexOf("/"));
// 		if (folderPath && !this.vault.getAbstractFileByPath(folderPath)) {
// 			// Recursively create missing folders
// 			const parts = folderPath.split("/");
// 			let currentPath = "";
// 			for (const part of parts) {
// 				currentPath = currentPath ? `${currentPath}/${part}` : part;
// 				if (!this.vault.getAbstractFileByPath(currentPath)) {
// 					await this.vault.createFolder(currentPath);
// 				}
// 			}
// 		}
// 	}

// 	const created = await this.createManyFilesInExistingFolders(files);
// 	return unwrapMaybe(created);
// }

// async createManyFolders(
// 	prettyPaths: Extract<SplitPath, { type: "folder" }>[],
// ): Promise<Maybe<TFolder[]>> {
// 	const created: TFolder[] = [];
// 	const errors: string[] = [];

// 	for (const prettyPath of prettyPaths) {
// 		const path = systemPathFromSplitPath(prettyPath);

// 		const existing = this.vault.getAbstractFileByPath(path);
// 		if (existing instanceof TFolder) {
// 			continue; // skip if already exists
// 		}

// 		const maybeFolder = await this.createMaybeFolderBySystemPath(path);
// 		created.push(unwrapMaybe(maybeFolder));
// 	}

// 	if (errors.length > 0) {
// 		logWarning({
// 			description: `Failed to create many folders: ${errors.join(", ")}`,
// 			location: "BackgroundFileService",
// 		});
// 	}

// 	return { data: created, error: false };
// }

// async renameManyFolders(
// 	folders: Array<{
// 		prettyPath: Extract<SplitPath, { type: "folder" }>;
// 		newName: string;
// 	}>,
// ): Promise<TFolder[]> {
// 	const renamed: TFolder[] = [];
// 	const errors: string[] = [];

// 	for (const { prettyPath, newName } of folders) {
// 		const systemPath = systemPathFromSplitPath(prettyPath);
// 		const maybeFolder = await this.renameMaybeFolderInSystemPath(
// 			systemPath,
// 			newName,
// 		);

// 		if (maybeFolder.error) {
// 			errors.push(`${prettyPath}: ${maybeFolder.description}`);
// 			continue;
// 		}

// 		renamed.push(unwrapMaybe(maybeFolder));
// 	}

// 	if (errors.length > 0) {
// 		logWarning({
// 			description: `Failed to rename many folders: ${errors.join(", ")}`,
// 			location: "BackgroundFileService",
// 		});
// 	}

// 	return renamed;
// }

// async deepListFiles(
// 	prettyPathToFolder: SplitPath,
// ): Promise<Array<SplitPath>> {
// 	const files = await this.deepListMaybeFiles(prettyPathToFolder);
// 	return unwrapMaybe(files);
// }

// async listFilesInFolder(
// 	prettyPathToFolder: SplitPath,
// ): Promise<Array<SplitPath>> {
// 	const maybeFiles =
// 		await this.listMaybeFilesInFolder(prettyPathToFolder);
// 	return unwrapMaybe(maybeFiles);
// }

// async renameManyFiles(
// 	files: Array<{
// 		prettyPath: Extract<SplitPath, { type: "file" }>;
// 		newName: string;
// 	}>,
// ): Promise<TFile[]> {
// 	const renamed: TFile[] = [];
// 	const errors: string[] = [];

// 	for (const { prettyPath, newName } of files) {
// 		const systemPath = systemPathFromSplitPath(prettyPath);
// 		const maybeFile = await this.renameMaybeFileInSystemPath(
// 			systemPath,
// 			newName,
// 		);

// 		if (maybeFile.error) {
// 			errors.push(`${prettyPath}: ${maybeFile.description}`);
// 			continue;
// 		}

// 		renamed.push(unwrapMaybe(maybeFile));
// 	}

// 	if (errors.length > 0) {
// 		logWarning({
// 			description: `Failed to rename many files: ${errors.join(", ")}`,
// 			location: "BackgroundFileService",
// 		});
// 	}

// 	return renamed;
// }

// private async getMaybeParentOfFileWithPath(
// 	prettyPath: SplitPath,
// ): Promise<Maybe<TFolder>> {
// 	const maybeFile = await this.getMaybeFileByPrettyPath(prettyPath);
// 	if (maybeFile.error) return maybeFile;

// 	const parent = unwrapMaybe(maybeFile).parent;

// 	if (!parent) {
// 		return { description: "File does not have a parent", error: true };
// 	}

// 	return { data: parent, error: false };
// }

// private async getSiblingsOfFile(file: TFile): Promise<Maybe<Array<TFile>>> {
// 	const parent = file.parent;

// 	if (parent && parent instanceof TFolder) {
// 		const siblings = parent.children
// 			.filter((child): child is TFile => child instanceof TFile)
// 			.filter((f) => f.path !== file.path);
// 		return { data: siblings, error: false };
// 	}

// 	return { data: [], error: false };
// }

// private async getMaybeFileByPrettyPath(
// 	prettyPath: SplitPath,
// ): Promise<Maybe<TFile>> {
// 	if (prettyPath.type !== "file") {
// 		return {
// 			description: "Expected file type in prettyPath",
// 			error: true,
// 		};
// 	}
// 	const filePath = systemPathFromSplitPath(prettyPath);
// 	try {
// 		const file = this.vault.getAbstractFileByPath(filePath);
// 		if (!file || !(file instanceof TFile)) {
// 			return { error: true };
// 		}
// 		return { data: file, error: false };
// 	} catch (error) {
// 		logError({
// 			description: `Failed to get file by path: ${error}`,
// 			location: "BackgroundFileService",
// 		});
// 		return { error: true };
// 	}
// }

// private async getMaybeFolderByPrettyPath(
// 	prettyPath: SplitPath,
// ): Promise<Maybe<TFolder>> {
// 	if (prettyPath.type !== "folder") {
// 		return {
// 			description: "Expected folder type in prettyPath",
// 			error: true,
// 		};
// 	}
// 	const folderPath = systemPathFromSplitPath(prettyPath);
// 	const folder = this.vault.getAbstractFileByPath(folderPath);
// 	if (!folder || !(folder instanceof TFolder)) {
// 		return {
// 			description: `Folder not found: ${folderPath}`,
// 			error: true,
// 		};
// 	}
// 	return { data: folder, error: false };
// }

// private async renameMaybeFileInSystemPath(
// 	systemPath: string,
// 	newName: string,
// ): Promise<Maybe<TFile>> {
// 	try {
// 		const file = await this.vault.getFileByPath(systemPath);
// 		if (!(file instanceof TFile)) {
// 			return {
// 				description: "Renamed item is not a file",
// 				error: true,
// 			};
// 		}

// 		await this.vault.rename(file, newName);

// 		return { data: file, error: false };
// 	} catch (error) {
// 		return {
// 			description: `Failed to rename file: ${error}`,
// 			error: true,
// 		};
// 	}
// }

// private async renameMaybeFolderInSystemPath(
// 	systemPath: string,
// 	newName: string,
// ): Promise<Maybe<TFolder>> {
// 	try {
// 		const folder = await this.vault.getFolderByPath(systemPath);
// 		if (!(folder instanceof TFolder)) {
// 			return {
// 				description: "Renamed item is not a folder",
// 				error: true,
// 			};
// 		}

// 		await this.vault.rename(folder, newName);

// 		return { data: folder, error: false };
// 	} catch (error) {
// 		return {
// 			description: `Failed to rename folder: ${error}`,
// 			error: true,
// 		};
// 	}
// }

// private async createMaybeFileInSystemPath(
// 	systemPath: string,
// 	content = "",
// ): Promise<Maybe<TFile>> {
// 	try {
// 		const file = await this.vault.create(`${systemPath}`, content);
// 		if (!(file instanceof TFile)) {
// 			return {
// 				description: "Created item is not a file",
// 				error: true,
// 			};
// 		}

// 		return { data: file, error: false };
// 	} catch (error) {
// 		return {
// 			description: `Failed to create file: ${error}`,
// 			error: true,
// 		};
// 	}
// }

// private async createMaybeFolderBySystemPath(
// 	systemPath: string,
// ): Promise<Maybe<TFolder>> {
// 	try {
// 		const folder = await this.vault.createFolder(systemPath);

// 		return { data: folder, error: false };
// 	} catch (error) {
// 		return {
// 			description: `Failed to create folder: ${error}`,
// 			error: true,
// 		};
// 	}
// }

// private async createManyFilesInExistingFolders(
// 	files: Array<{
// 		prettyPath: Extract<SplitPath, { type: "file" }>;
// 		content?: string;
// 	}>,
// ): Promise<Maybe<TFile[]>> {
// 	const created: TFile[] = [];
// 	const errors: string[] = [];

// 	for (const { prettyPath, content = "" } of files) {
// 		const path = systemPathFromSplitPath(prettyPath);

// 		const existing = this.vault.getAbstractFileByPath(path);
// 		if (existing instanceof TFile) {
// 			continue; // skip existing file
// 		}

// 		const file = await this.createMaybeFileInSystemPath(path, content);
// 		if (file.error) {
// 			errors.push(`${path}: ${file.description}`);
// 			continue;
// 		}

// 		created.push(unwrapMaybe(file));
// 	}

// 	if (errors.length > 0) {
// 		logWarning({
// 			description: `Failed to create many files: ${errors.join(", ")}`,
// 			location: "BackgroundFileService",
// 		});
// 	}

// 	return { data: created, error: false };
// }

// private async listMaybeFilesInFolder(
// 	prettyPathToFolder: SplitPath,
// ): Promise<Maybe<Array<SplitPath>>> {
// 	const maybeFolder =
// 		await this.getMaybeFolderByPrettyPath(prettyPathToFolder);
// 	if (maybeFolder.error) return maybeFolder;

// 	const folder = unwrapMaybe(maybeFolder);
// 	const files = folder.children.filter(
// 		(child): child is TFile => child instanceof TFile,
// 	);

// 	return {
// 		data: files.map((file) => systemFilePathToPrettyPath(file.path)),
// 		error: false,
// 	};
// }

// private async deepListMaybeFiles(
// 	prettyPathToFolder: SplitPath,
// ): Promise<Maybe<Array<SplitPath>>> {
// 	const maybeFolder =
// 		await this.getMaybeFolderByPrettyPath(prettyPathToFolder);
// 	if (maybeFolder.error) return maybeFolder;

// 	const folder = unwrapMaybe(maybeFolder);
// 	const files = await Promise.all(
// 		folder.children.flatMap(async (child) => {
// 			if (child instanceof TFile) {
// 				return [systemFilePathToPrettyPath(child.path)];
// 			}
// 			return this.deepListMaybeFiles(
// 				systemPathToPrettyPath(child.path),
// 			).then(unwrapMaybe);
// 		}),
// 	);

// 	return { data: files.flat(), error: false };
// }
