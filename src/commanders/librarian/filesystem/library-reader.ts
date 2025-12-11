import type { ObsidianVaultActionManager } from "../../../obsidian-vault-action-manager";
import type {
	CoreSplitPath,
	SplitPath,
	SplitPathToFolder,
} from "../../../obsidian-vault-action-manager/types/split-path";
import { isInUntracked, type RootName } from "../constants";
import { prettyFilesWithReaderToLibraryFiles } from "../indexing/libraryFileAdapters";
import { noteDtosFromLibraryFiles } from "../pure-functions/note-dtos-from-library-file-dtos";
import type { LibraryFile, NoteDto, TreePath } from "../types";

type ManagerMdReader = CoreSplitPath & { readContent: () => Promise<string> };

function isFolder(entry: SplitPath): entry is SplitPathToFolder {
	return entry.type === "Folder";
}

// ─── Exported Pure Functions ─────────────────────────────────────────────

/**
 * Read all library files in a folder.
 *
 * @param bgService - Background file service for filesystem access
 * @param folder - Folder to read
 * @returns Array of library files
 */
async function getAllMdFileReaders(
	manager: ObsidianVaultActionManager,
	folder: SplitPathToFolder,
): Promise<ManagerMdReader[]> {
	const fullPathParts = [...folder.pathParts, folder.basename];
	if (isInUntracked(fullPathParts)) {
		return [];
	}

	const fileReaders = await manager.getReadersToAllMdFilesInFolder(folder);
	const entries = await manager.list(folder);

	const nestedReaders: ManagerMdReader[] = [];
	for (const entry of entries.filter(isFolder)) {
		nestedReaders.push(...(await getAllMdFileReaders(manager, entry)));
	}

	return [...fileReaders, ...nestedReaders];
}

export async function readFilesInFolder(
	manager: ObsidianVaultActionManager,
	folder: SplitPathToFolder,
): Promise<LibraryFile[]> {
	const fileReaders = await getAllMdFileReaders(manager, folder);
	return await prettyFilesWithReaderToLibraryFiles(fileReaders);
}

/**
 * Read note DTOs from a library root or subtree.
 *
 * @param bgService - Background file service for filesystem access
 * @param rootName - Library root name
 * @param subtreePath - Optional subtree path to filter
 * @returns Array of note DTOs
 */
export async function readNoteDtos(
	manager: ObsidianVaultActionManager,
	rootName: RootName,
	subtreePath: TreePath = [],
): Promise<NoteDto[]> {
	const folderBasename =
		subtreePath.length > 0
			? (subtreePath[subtreePath.length - 1] ?? rootName)
			: rootName;

	const pathParts =
		subtreePath.length > 1
			? [rootName, ...subtreePath.slice(0, -1)]
			: subtreePath.length === 1
				? [rootName]
				: [];

	const libraryFiles = await readFilesInFolder(manager, {
		basename: folderBasename,
		pathParts,
		type: "Folder",
	});

	const trackedLibraryFiles = libraryFiles.filter(
		(file) => !isInUntracked(file.fullPath.pathParts),
	);

	return noteDtosFromLibraryFiles(trackedLibraryFiles, subtreePath);
}
