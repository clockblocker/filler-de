import type { PrettyPath } from "../../../types/common-interface/dtos";
import { isInUntracked, type RootName } from "../constants";
import { prettyFilesWithReaderToLibraryFiles } from "../indexing/libraryFileAdapters";
import { noteDtosFromLibraryFiles } from "../pure-functions/note-dtos-from-library-file-dtos";
import type { LibraryFile, NoteDto, TreePath } from "../types";
import type { ManagerFsAdapter } from "../utils/manager-fs-adapter";

/**
 * Type for the background file service dependency.
 */
export type BackgroundFileService = ManagerFsAdapter;

// ─── Exported Pure Functions ─────────────────────────────────────────────

/**
 * Read all library files in a folder.
 *
 * @param bgService - Background file service for filesystem access
 * @param folder - Folder to read
 * @returns Array of library files
 */
export async function readFilesInFolder(
	bgService: BackgroundFileService,
	folder: PrettyPath,
): Promise<LibraryFile[]> {
	const fileReaders = await bgService.getReadersToAllMdFilesInFolder({
		basename: folder.basename,
		pathParts: folder.pathParts,
		type: "folder",
	});

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
	bgService: BackgroundFileService,
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

	const libraryFiles = await readFilesInFolder(bgService, {
		basename: folderBasename,
		pathParts,
	});

	const trackedLibraryFiles = libraryFiles.filter(
		(file) => !isInUntracked(file.fullPath.pathParts),
	);

	return noteDtosFromLibraryFiles(trackedLibraryFiles, subtreePath);
}
