import { TextStatus } from "../../../types/common-interface/enums";
import { getTreePathFromLibraryFile } from "../indexing/libraryFileAdapters";
import type { LibraryFileDto, TextDto, TreePath } from "../types";

/**
 * Convert LibraryFileDtos to TextDtos, filtering by subtree path.
 * Groups pages of the same text together.
 */
export function textDtosFromLibraryFileDtos(
	libraryFileDtos: LibraryFileDto[],
	subtreePath: TreePath = [],
): TextDto[] {
	// Group files by their text path (all pages of the same text go together)
	const buckets: Map<string, LibraryFileDto[]> = new Map();

	for (const libraryFileDto of libraryFileDtos) {
		// Skip Codex files - they're organizational nodes, not texts
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

		const isPage = libraryFileDto.metaInfo.fileType === "Page";
		const textPath = isPage ? treePath.slice(0, -1) : treePath;
		const joinedTextPath = textPath.join("-");

		const bucket = buckets.get(joinedTextPath);
		if (!bucket) {
			buckets.set(joinedTextPath, [libraryFileDto]);
		} else {
			bucket.push(libraryFileDto);
		}
	}

	const textDtos: TextDto[] = [];

	for (const [, fileDtos] of buckets.entries()) {
		const firstFile = fileDtos[0];
		if (!firstFile) {
			continue;
		}

		const firstTreePath = getTreePathFromLibraryFile(firstFile);
		const isFirstPage = firstFile.metaInfo.fileType === "Page";
		const path = isFirstPage ? firstTreePath.slice(0, -1) : firstTreePath;

		const textDto: TextDto = {
			pageStatuses: Object.fromEntries(
				fileDtos.map((libraryFileDto) => {
					const treePath = getTreePathFromLibraryFile(libraryFileDto);
					let name = treePath[treePath.length - 1];
					if (
						libraryFileDto.metaInfo.fileType === "Page" &&
						"index" in libraryFileDto.metaInfo
					) {
						name = String(libraryFileDto.metaInfo.index).padStart(
							3,
							"0",
						);
					}
					const status =
						libraryFileDto.metaInfo.status ?? TextStatus.NotStarted;
					return [name, status];
				}),
			),
			path,
		};

		textDtos.push(textDto);
	}

	return textDtos;
}
