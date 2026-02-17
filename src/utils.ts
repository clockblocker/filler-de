import { Notice, TFile, TFolder, Vault, normalizePath } from 'obsidian';

export const longDash = '—';

export function omitIfLongDash(text: string): string {
	return text.replace('\n', '') === longDash ? '' : text;
}
export const extractBacklinks = (content: string): string[] => {
	const links = content
		.split('[[')
		.map((part) => part.replace(/\\/g, '').split('|')[0].split(']]')[0]);
	links.shift();
	return links;
};

export function formatSelectionWithBacklink(
	selection: string,
	currentFileName: string,
	nextNumber: number
): string {
	// Strip all newline characters and spaces from the end of the selection
	selection = selection.replace(/[\s\n]+$/, '');

	const formattedBacklink = `*[[${currentFileName}#^${nextNumber}|^]]*`;
	return `${formattedBacklink} ${selection} ^${nextNumber}\n`;
}

export async function appendToExistingFile(
	vault: Vault,
	file: TFile,
	text: string
): Promise<void> {
	try {
		await vault.process(file, (currentContent) => {
			return currentContent + text;
		});
	} catch (error) {
		console.error(`Failed to append to file ${file.path}: ${error}`);
		throw error;
	}
}

export async function doesExistingFileContainContent(
	vault: Vault,
	file: TFile,
	content: string
): Promise<boolean | null> {
	try {
		const fileContent = await vault.read(file);
		return fileContent.includes(content);
	} catch (error) {
		console.error(`Failed to check file content ${file.path}: ${error}`);
		return null;
	}
}

export async function getExisingOrCreatedFileInWorterDir(
	vault: Vault,
	item: { name: string; path: string | null }
): Promise<TFile | null> {
	try {
		let filePath: string;

		if (item.path) {
			filePath = item.path;
			const normalizedPath = normalizePath(filePath);
			const existing = vault.getAbstractFileByPath(normalizedPath);

			if (existing instanceof TFile) {
				return existing;
			}
			return null;
		} else {
			const originalName = item.name.trim();

			// used only for folder sharding
			const shardKey = originalName
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '')
				.replace(/[^a-zA-Z0-9]/g, '')
				.toLowerCase()
				.padEnd(4, '_'); // ensures at least 4 chars

			const first = shardKey[0];
			const prefix = shardKey.slice(0, 3);
			const shard = shardKey[3];

			const folderPath = normalizePath(
				`Worter/Ordered/${first}/${prefix}/${shard}`
			);

			console.log('folderPath before', folderPath);
			const folder = await ensureFolderExists(vault, folderPath);
			console.log('folderPath after', folder, folder?.path);

			const cleanFileName = originalName.replace(/[\\/:*?"<>|]/g, '');
			filePath = `${folder.path}/${cleanFileName}.md`;

			const normalizedPath = normalizePath(filePath);
			const file = await ensureFileExists(vault, normalizedPath);
			return file;
		}
	} catch (error) {
		new Notice(`Error creating file ${item.name}: ${error.message}`);
	}
	return null;
}

async function ensureFolderExists(
	vault: Vault,
	folderPath: string
): Promise<TFolder> {
	const segments = folderPath.split('/').filter(Boolean);
	let currentPath = '';
	let currentFolder: TFolder | null = vault.getRoot();

	for (const segment of segments) {
		currentPath = normalizePath(`${currentPath}/${segment}`);
		const existing = vault.getAbstractFileByPath(currentPath);

		if (existing instanceof TFolder) {
			currentFolder = existing;
		} else if (!existing) {
			try {
				currentFolder = await vault.createFolder(currentPath);
			} catch (err: any) {
				if (err.message.includes('already exists')) {
					// race condition: folder was created in parallel
					currentFolder = vault.getAbstractFileByPath(currentPath) as TFolder;
				} else {
					throw err;
				}
			}
		} else {
			throw new Error(`Cannot create folder: file exists at ${currentPath}`);
		}
	}

	if (!currentFolder) {
		throw new Error(`Failed to create or retrieve folder at ${folderPath}`);
	}

	return currentFolder;
}

export async function ensureFileExists(
	vault: Vault,
	filePath: string,
	defaultContent = ''
): Promise<TFile> {
	const normalizedPath = normalizePath(filePath);
	let file = vault.getAbstractFileByPath(normalizedPath);

	if (file instanceof TFile) return file;

	const folderPath = normalizedPath.split('/').slice(0, -1).join('/');
	await ensureFolderExists(vault, folderPath);

	try {
		await vault.create(normalizedPath, defaultContent);
	} catch (err: any) {
		if (!err.message.includes('already exists')) {
			throw err;
		}
		// race condition: another process created it first
	}

	file = vault.getAbstractFileByPath(normalizedPath);

	if (!(file instanceof TFile)) {
		throw new Error(`Failed to create or resolve file: ${normalizedPath}`);
	}

	return file;
}
