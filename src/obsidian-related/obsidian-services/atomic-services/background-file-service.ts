import { App, Vault, TFile, Editor, MarkdownView, TFolder } from 'obsidian';
import {
	Maybe,
	PathParts,
	PrettyPath,
	unwrapMaybe,
} from '../../../types/general';
import { SLASH } from 'types/beta/literals';
import { logError, logWarning } from '../helpers/issue-handlers';

export class BackgroundFileService {
	constructor(private vault: Vault) {}

	async getFile(prettyPath: PrettyPath): Promise<TFile> {
		const mbFile = await this.getMaybeFileByPrettyPath(prettyPath);
		return unwrapMaybe(mbFile);
	}

	async createFileInPrettyPath(
		prettyPath: PrettyPath,
		content: string = ''
	): Promise<Maybe<TFile>> {
		const systemPath = `${systemPathToFileFromPrettyPath(prettyPath)}`;
		return await this.createMaybeFileInSystemPath(systemPath, content);
	}

	async createFolderInPrettyPath(
		prettyPath: PrettyPath
	): Promise<Maybe<TFolder>> {
		const systemPath = `${systemPathToFolderFromPrettyPath(prettyPath)}`;

		return await this.createMaybeFolderBySystemPath(systemPath);
	}

	async createFileInFolder(
		folder: TFolder,
		title: PrettyPath['title']
	): Promise<Maybe<TFile>> {
		const path = `${folder.path}/${title}`;
		const maybeFile = await this.createMaybeFileInSystemPath(path);

		return maybeFile;
	}

	async createFolderInFolder(
		folder: TFolder,
		title: PrettyPath['title']
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

	private async getMaybeParentOfFileWithPath(
		prettyPath: PrettyPath
	): Promise<Maybe<TFolder>> {
		const maybeFile = await this.getMaybeFileByPrettyPath(prettyPath);
		if (maybeFile.error) return maybeFile;

		const parent = maybeFile.data.parent;

		if (!parent) {
			return { error: true, description: 'File does not have a parent' };
		}

		return { error: false, data: parent };
	}

	async getParentOfFileWithPath(prettyPath: PrettyPath): Promise<TFolder> {
		const maybeParent = await this.getMaybeParentOfFileWithPath(prettyPath);
		return unwrapMaybe(maybeParent);
	}

	async getSiblingsOfFileWithPath(
		prettyPath: PrettyPath
	): Promise<Maybe<Array<TFile>>> {
		const maybeFile = await this.getMaybeFileByPrettyPath(prettyPath);
		if (maybeFile.error) return maybeFile;

		return this.getSiblingsOfFile(maybeFile.data);
	}

	async createManyFilesInExistingFolders(
		files: Array<{ prettyPath: PrettyPath; content?: string }>
	): Promise<Maybe<TFile[]>> {
		const created: TFile[] = [];
		const errors: string[] = [];

		for (const { prettyPath, content = '' } of files) {
			const path = systemPathToFileFromPrettyPath(prettyPath);

			const existing = this.vault.getAbstractFileByPath(path);
			if (existing instanceof TFile) {
				continue; // skip existing file
			}

			const file = await this.createMaybeFileInSystemPath(path, content);
			if (file.error) {
				errors.push(`${path}: ${file.description}`);
				continue;
			}
			created.push(file.data);
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
		prettyPaths: PrettyPath[]
	): Promise<Maybe<TFolder[]>> {
		const created: TFolder[] = [];
		const errors: string[] = [];

		for (const prettyPath of prettyPaths) {
			const path = systemPathToFolderFromPrettyPath(prettyPath);

			const existing = this.vault.getAbstractFileByPath(path);
			if (existing instanceof TFolder) {
				continue; // skip if already exists
			}

			const folder = await this.createMaybeFolderBySystemPath(path);

			if (folder.error) {
				errors.push(`${path}: ${folder.description}`);
				continue;
			}
			created.push(folder.data);
		}

		if (errors.length > 0) {
			logWarning({
				description: `Failed to create many folders: ${errors.join(', ')}`,
				location: 'BackgroundFileService',
			});
		}

		return { error: false, data: created };
	}

	private async getSiblingsOfFile(file: TFile): Promise<Maybe<Array<TFile>>> {
		const parent = file.parent;

		if (parent && parent instanceof TFolder) {
			const siblings = parent.children
				.filter((child): child is TFile => child instanceof TFile)
				.filter((f) => f.path !== file.path);
			return { error: false, data: siblings };
		}

		return { error: false, data: [] };
	}

	private async getMaybeFileByPrettyPath(
		prettyPath: PrettyPath
	): Promise<Maybe<TFile>> {
		const filePath = systemPathToFileFromPrettyPath(prettyPath);
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

	private async createMaybeFileInSystemPath(
		systemPath: string,
		content: string = ''
	): Promise<Maybe<TFile>> {
		try {
			const file = await this.vault.create(`${systemPath}`, content);
			if (!(file instanceof TFile)) {
				return { error: true, description: 'Created item is not a file' };
			}

			return { error: false, data: file };
		} catch (error) {
			return { error: true, description: `Failed to create file: ${error}` };
		}
	}

	private async createMaybeFolderBySystemPath(
		systemPath: string
	): Promise<Maybe<TFolder>> {
		try {
			const folder = await this.vault.createFolder(systemPath);

			return { error: false, data: folder };
		} catch (error) {
			return { error: true, description: `Failed to create folder: ${error}` };
		}
	}

	public async treeToItems(folder: TFolder): Promise<Maybe<Array<PrettyPath>>> {
		const includeExt = ['md'].map((e) => e.toLowerCase());

		try {
			const out: Array<PrettyPath> = [];
			const stack: TFolder[] = [folder];

			while (stack.length) {
				const cur = stack.pop()!;
				const curPrettyParts = systemPathToPrettyPath(cur.path);

				for (const child of cur.children) {
					if (child instanceof TFolder) {
						stack.push(child);
					} else if (child instanceof TFile) {
						if (
							includeExt.length === 0 ||
							includeExt.includes(child.extension.toLowerCase())
						) {
							out.push(curPrettyParts);
						}
					}
				}
			}

			out.sort((a, b) => {
				const ap = a.pathParts.join(SLASH);
				const bp = b.pathParts.join(SLASH);
				const byPath = ap.localeCompare(bp, undefined, { sensitivity: 'base' });
				return byPath !== 0
					? byPath
					: a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
			});

			return { error: false, data: out };
		} catch (e) {
			return {
				error: true,
				description: `Failed to traverse tree: ${e instanceof Error ? e.message : String(e)}`,
			};
		}
	}

	/**
	 * Convenience: start traversal from a folder path (PathParts).
	 */
	public async treeToItemsByPathParts(
		pathParts: PathParts
	): Promise<Maybe<Array<PrettyPath>>> {
		const folderPath = pathToFolderFromPathParts(pathParts);
		try {
			const abs = this.vault.getAbstractFileByPath(folderPath);
			if (!(abs instanceof TFolder)) {
				return { error: true, description: `Not a folder: ${folderPath}` };
			}
			return this.treeToItems(abs);
		} catch (e) {
			return {
				error: true,
				description: `Failed to resolve folder: ${e instanceof Error ? e.message : String(e)}`,
			};
		}
	}
}

function systemPathToPrettyPath(path: string): PrettyPath {
	if (!path || path === '/') return { pathParts: [], title: '' };

	const splitPath = path.split(SLASH).filter(Boolean);

	return {
		title: splitPath.pop() ?? '',
		pathParts: splitPath,
	};
}

function systemPathToFileFromPrettyPath(prettyPath: PrettyPath) {
	return systemPathFromPrettyPath({ prettyPath, isFile: true });
}

function systemPathToFolderFromPrettyPath(prettyPath: PrettyPath) {
	return systemPathFromPrettyPath({ prettyPath, isFile: false });
}

function systemPathFromPrettyPath({
	prettyPath: { pathParts, title },
	isFile,
}: {
	prettyPath: PrettyPath;
	isFile: boolean;
}): string {
	return joinPosix(
		pathToFolderFromPathParts(pathParts),
		safeFileName(title) + (isFile ? '.md' : '')
	);
}

function safeFileName(s: string): string {
	return s.replace(/[\\/]/g, ' ').trim();
}

function pathToFolderFromPathParts(pathParts: string[]): string {
	return joinPosix(...pathParts);
}

function joinPosix(...parts: string[]): string {
	const cleaned = parts
		.filter(Boolean)
		.map((p) => p.replace(/(^[\\/]+)|([\\/]+$)/g, '')) // trim leading/trailing slashes/backslashes
		.filter((p) => p.length > 0);
	return cleaned.join('/');
}
