import { TextStatus } from "../../../types/common-interface/enums";
import { getTreePathFromLibraryFile } from "../indexing/libraryFileAdapters";
import type { LibraryFileDto, NoteDto, TreePath } from "../types";

/**
 * Convert LibraryFileDtos to NoteDtos (V2 flat format).
 * Each file becomes one NoteDto - no grouping by text.
 */
export function noteDtosFromLibraryFileDtos(
	libraryFileDtos: LibraryFileDto[],
	subtreePath: TreePath = [],
): NoteDto[] {
	const noteDtos: NoteDto[] = [];

	for (const libraryFileDto of libraryFileDtos) {
		// Skip Codex files - they're organizational nodes, not notes
		if (libraryFileDto.metaInfo.fileType === "Codex") {
			continue;
		}

		const treePath = getTreePathFromLibraryFile(libraryFileDto);

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
			libraryFileDto.metaInfo.fileType === "Page" &&
			"index" in libraryFileDto.metaInfo
		) {
			// Page: use parent path + padded index
			const parentPath = treePath.slice(0, -1);
			const pageIndex = String(libraryFileDto.metaInfo.index).padStart(
				3,
				"0",
			);
			notePath = [...parentPath, pageIndex];
		} else {
			// Scroll or other: use tree path directly
			notePath = treePath;
		}

		const status = libraryFileDto.metaInfo.status ?? TextStatus.NotStarted;

		noteDtos.push({
			path: notePath,
			status,
		});
	}

	return noteDtos;
}
