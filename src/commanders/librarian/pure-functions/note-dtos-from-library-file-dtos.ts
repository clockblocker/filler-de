import { TextStatus } from "../../../types/common-interface/enums";
import { pageNumberFromInt } from "../indexing/codecs";
import { getTreePathFromLibraryFile } from "../indexing/libraryFileAdapters";
import type { LibraryFile, NoteDto, TreePath } from "../types";

/**
 * Convert LibraryFiles to NoteDtos).
 * Each file becomes one NoteDto - no grouping by text.
 */
export function noteDtosFromLibraryFiles(
	libraryFiles: LibraryFile[],
	subtreePath: TreePath = [],
): NoteDto[] {
	const noteDtos: NoteDto[] = [];

	for (const libraryFile of libraryFiles) {
		// Skip Codex files - they're organizational nodes, not notes
		if (libraryFile.metaInfo.fileType === "Codex") {
			continue;
		}

		const treePath = getTreePathFromLibraryFile(libraryFile);

		// Filter: only include files under subtreePath
		if (subtreePath.length > 0) {
			const matchesSubtree = subtreePath.every(
				(segment, i) => treePath[i] === segment,
			);
			if (!matchesSubtree) {
				continue;
			}
		}

		// Build the note path
		// For Pages: path includes the page index (e.g., ["Section", "Book", "000"])
		// For Scrolls: path is just the tree path (e.g., ["Section", "Scroll"])
		let notePath: TreePath;

		if (
			libraryFile.metaInfo.fileType === "Page" &&
			"index" in libraryFile.metaInfo
		) {
			// Page: use parent path + padded index
			const parentPath = treePath.slice(0, -1);
			const pageIndex = pageNumberFromInt.encode(
				libraryFile.metaInfo.index,
			);
			notePath = [...parentPath, pageIndex];
		} else {
			// Scroll or other: use tree path directly
			notePath = treePath;
		}

		const status = libraryFile.metaInfo.status ?? TextStatus.NotStarted;

		noteDtos.push({
			path: notePath,
			status,
		});
	}

	return noteDtos;
}
