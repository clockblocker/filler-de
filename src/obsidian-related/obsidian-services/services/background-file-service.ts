import { App, Vault, TFile, Editor, MarkdownView, TFolder } from 'obsidian';
import { Maybe, PathParts } from '../../../types/general';
import { SLASH } from 'types/beta/literals';
import { formatError, logError, logWarning } from '../helpers/issue-handlers';

const pathToFolderFromPathParts = (pathParts: PathParts) =>
	pathParts.join(SLASH);

const pathToFileFromPathParts = (pathParts: PathParts) =>
	pathToFolderFromPathParts(pathParts) + '.md';

export class BackgroundFileService {
	constructor(private vault: Vault) {}

	async getMaybeFileByPathParts(pathParts: PathParts): Promise<Maybe<TFile>> {
		const filePath = pathToFileFromPathParts(pathParts);
		try {
			const file = this.vault.getAbstractFileByPath(filePath);
			if (!file || !(file instanceof TFile)) {
				return { error: true };
			}
			return { data: file, error: false };
		} catch (error) {
			logError({
				description: `Failed to get file by path: ${error}`,
				location: 'BackgroundFileService',
			});
			return { error: true };
		}
	}

	async getFileByPathParts(pathParts: PathParts): Promise<TFile> {
		const mbFile = await this.getMaybeFileByPathParts(pathParts);
		if (mbFile.error) {
			const err = {
				description: mbFile.description ?? 'File not found',
				location: 'BackgroundFileService',
			};

			logError(err);
			throw new Error(formatError(err));
		}

		return mbFile.data;
	}

	async getSiblingsOfFile(file: TFile): Promise<Maybe<Array<TFile>>> {
		const parent = file.parent;

		if (parent && parent instanceof TFolder) {
			const siblings = parent.children
				.filter((child): child is TFile => child instanceof TFile)
				.filter((f) => f.path !== file.path);
			return { error: false, data: siblings };
		}

		return { error: false, data: [] };
	}

	private async createFileInPath(
		path: string,
		content: string = ''
	): Promise<Maybe<TFile>> {
		try {
			const file = await this.vault.create(`${path}`, content);
			if (!(file instanceof TFile)) {
				return { error: true, description: 'Created item is not a file' };
			}
			return { error: false, data: file };
		} catch (error) {
			return { error: true, description: `Failed to create file: ${error}` };
		}
	}

	private async createFolderInPath(path: string): Promise<Maybe<TFolder>> {
		try {
			const fullPath = `${path}`;
			const folder = await this.vault.createFolder(fullPath);
			return { error: false, data: folder };
		} catch (error) {
			return { error: true, description: `Failed to create folder: ${error}` };
		}
	}

	async createFileInFolder(
		folder: TFolder,
		fileName: string,
		content: string = ''
	): Promise<Maybe<TFile>> {
		const path = `${folder.path}/${fileName}`;
		const maybeFile = await this.createFileInPath(path, content);

		return maybeFile;
	}

	async createFolderInFolder(
		folder: TFolder,
		folderName: string
	): Promise<Maybe<TFolder>> {
		const path = `${folder.path}/${folderName}`;
		const maybeFolder = await this.createFolderInPath(path);

		return maybeFolder;
	}

	async readFileContentByPathParts(
		pathParts: PathParts
	): Promise<Maybe<string>> {
		const maybeFile = await this.getMaybeFileByPathParts(pathParts);
		if (maybeFile.error) {
			return maybeFile;
		}

		const content = await this.vault.read(maybeFile.data);
		return { data: content, error: false };
	}

	async getParentOfFileWithPath(pathParts: PathParts): Promise<Maybe<TFolder>> {
		const maybeFile = await this.getMaybeFileByPathParts(pathParts);
		if (maybeFile.error) return maybeFile;

		const parent = maybeFile.data.parent;

		if (!parent) {
			return { error: true, description: 'File does not have a parent' };
		}

		return { error: false, data: parent };
	}

	public async getSiblingsOfFileWithPath(
		pathParts: PathParts
	): Promise<Maybe<Array<TFile>>> {
		const maybeFile = await this.getMaybeFileByPathParts(pathParts);
		if (maybeFile.error) return maybeFile;

		return this.getSiblingsOfFile(maybeFile.data);
	}

	public async createManyFilesInExistingFolders(
		files: Array<{ pathParts: PathParts; content?: string }>
	): Promise<Maybe<TFile[]>> {
		const created: TFile[] = [];
		const errors: string[] = [];

		for (const { pathParts, content = '' } of files) {
			const path = pathToFileFromPathParts(pathParts) + '.md';
			try {
				const existing = this.vault.getAbstractFileByPath(path);
				if (existing instanceof TFile) {
					continue; // skip existing file
				}

				const file = await this.vault.create(path, content);
				if (file instanceof TFile) {
					created.push(file);
				} else {
					errors.push(`${path}: created item is not a TFile`);
				}
			} catch (e) {
				errors.push(`${path}: ${e instanceof Error ? e.message : String(e)}`);
			}
		}

		if (errors.length > 0) {
			logWarning({
				description: `Failed to create many files: ${errors.join(', ')}`,
				location: 'BackgroundFileService',
			});
		}

		return { error: false, data: created };
	}

	public async createManyFolders(
		folderPathPartsArray: PathParts[]
	): Promise<Maybe<TFolder[]>> {
		const created: TFolder[] = [];
		const errors: string[] = [];

		for (const pathParts of folderPathPartsArray) {
			const path = pathToFolderFromPathParts(pathParts);
			try {
				const existing = this.vault.getAbstractFileByPath(path);
				if (existing instanceof TFolder) {
					continue; // skip if already exists
				}

				const folder = await this.vault.createFolder(path);
				created.push(folder);
			} catch (e) {
				errors.push(`${path}: ${e instanceof Error ? e.message : String(e)}`);
			}
		}

		if (errors.length > 0) {
			logWarning({
				description: `Failed to create many folders: ${errors.join(', ')}`,
				location: 'BackgroundFileService',
			});
		}

		return { error: false, data: created };
	}
}
