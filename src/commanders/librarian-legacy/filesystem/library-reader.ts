import type { TexfresserObsidianServices } from "../../../services/obsidian-services/interface";
import type { PrettyPathLegacy } from "../../../types/common-interface/dtos";
import { isInUntrackedLegacy, type RootNameLegacy } from "../constants";
import { prettyFilesWithReaderToLibraryFileLegacy } from "../indexing/libraryFileAdapters";
import { noteDtosFromLibraryFileLegacy } from "../pure-functions/note-dtos-from-library-file-dtos";
import type {
	LibraryFileLegacy,
	NoteDtoLegacy,
	TreePathLegacyLegacy,
} from "../types";

/**
 * Type for the background file service dependency.
 */
export type BackgroundFileServiceLegacy =
	TexfresserObsidianServices["backgroundFileService"];

// ─── Exported Pure Functions ─────────────────────────────────────────────

/**
 * Read all library files in a folder.
 *
 * @param bgService - Background file service for filesystem access
 * @param folder - Folder to read
 * @returns Array of library files
 */
export async function readFilesInFolderLegacy(
	bgService: BackgroundFileServiceLegacy,
	folder: PrettyPathLegacy,
): Promise<LibraryFileLegacy[]> {
	const fileReaders = await bgService.getReadersToAllMdFilesInFolder({
		basename: folder.basename,
		pathParts: folder.pathParts,
		type: "folder",
	});

	return await prettyFilesWithReaderToLibraryFileLegacy(fileReaders);
}

/**
 * Read note DTOs from a library root or subtree.
 *
 * @param bgService - Background file service for filesystem access
 * @param rootName - Library root name
 * @param subtreePath - Optional subtree path to filter
 * @returns Array of note DTOs
 */
export async function readNoteDtoLegacy(
	bgService: BackgroundFileServiceLegacy,
	rootName: RootNameLegacy,
	subtreePath: TreePathLegacyLegacy = [],
): Promise<NoteDtoLegacy[]> {
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

	const libraryFiles = await readFilesInFolderLegacy(bgService, {
		basename: folderBasename,
		pathParts,
	});

	const trackedLibraryFileLegacy = libraryFiles.filter(
		(file) => !isInUntrackedLegacy(file.fullPath.pathParts),
	);

	return noteDtosFromLibraryFileLegacy(trackedLibraryFileLegacy, subtreePath);
}
