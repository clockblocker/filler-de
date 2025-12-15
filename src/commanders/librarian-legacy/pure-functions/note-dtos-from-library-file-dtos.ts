import { TextStatusLegacy } from "../../../types/common-interface/enums";
import { pageNumberFromInt } from "../indexing/codecs";
import { getTreePathLegacyLegacyFromLibraryFileLegacy } from "../indexing/libraryFileAdapters";
import type {
	LibraryFileLegacy,
	NoteDtoLegacy,
	TreePathLegacyLegacy,
} from "../types";

/**
 * Convert LibraryFileLegacy to NoteDtoLegacy).
 * Each file becomes one NoteDtoLegacy - no grouping by text.
 */
export function noteDtosFromLibraryFileLegacy(
	libraryFiles: LibraryFileLegacy[],
	subtreePath: TreePathLegacyLegacy = [],
): NoteDtoLegacy[] {
	const noteDtos: NoteDtoLegacy[] = [];

	for (const libraryFile of libraryFiles) {
		// Skip Codex files - they're organizational nodes, not notes
		if (libraryFile.metaInfo.fileType === "Codex") {
			continue;
		}

		const treePath =
			getTreePathLegacyLegacyFromLibraryFileLegacy(libraryFile);

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
		let notePath: TreePathLegacyLegacy;

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

		const status =
			libraryFile.metaInfo.status ?? TextStatusLegacy.NotStarted;

		noteDtos.push({
			path: notePath,
			status,
		});
	}

	return noteDtos;
}
