import type { TexfresserObsidianServices } from "../../../services/obsidian-services/interface";
import type { PrettyPath } from "../../../types/common-interface/dtos";
import { isInUntracked, type RootName } from "../constants";
import { prettyFilesWithReaderToLibraryFiles } from "../indexing/libraryFileAdapters";
import { noteDtosFromLibraryFiles } from "../pure-functions/note-dtos-from-library-file-dtos";
import type { LibraryFile, NoteDto, TreePath } from "../types";

export class LibraryReader {
	private readonly backgroundFileService: TexfresserObsidianServices["backgroundFileService"];

	constructor(
		backgroundFileService: TexfresserObsidianServices["backgroundFileService"],
	) {
		this.backgroundFileService = backgroundFileService;
	}

	async readFilesInFolder(folder: PrettyPath): Promise<LibraryFile[]> {
		const fileReaders =
			await this.backgroundFileService.getReadersToAllMdFilesInFolder({
				basename: folder.basename,
				pathParts: folder.pathParts,
				type: "folder",
			});

		return await prettyFilesWithReaderToLibraryFiles(fileReaders);
	}

	async readNoteDtos(
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

		const libraryFiles = await this.readFilesInFolder({
			basename: folderBasename,
			pathParts,
		});

		const trackedLibraryFiles = libraryFiles.filter(
			(file) => !isInUntracked(file.fullPath.pathParts),
		);

		return noteDtosFromLibraryFiles(trackedLibraryFiles, subtreePath);
	}
}
