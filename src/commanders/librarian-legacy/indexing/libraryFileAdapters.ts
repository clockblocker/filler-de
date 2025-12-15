import { extractMetaInfo } from "../../../services/dto-services/meta-info-manager/interface";
import type { MetaInfo } from "../../../services/dto-services/meta-info-manager/types";
import type { ReadablePrettyFile } from "../../../services/obsidian-services/file-services/background/background-file-service";
import { TextStatusLegacy } from "../../../types/common-interface/enums";
import type { LibraryFileLegacy, TreePathLegacyLegacy } from "../types";
import {
	CodexBaseameSchemaLegacy,
	PageBasenameLegacySchemaLegacy,
	ScrollBasenameSchemaLegacy,
	treePathToCodexBasename,
	treePathToPageBasenameLegacy,
	treePathToScrollBasename,
} from "./codecs";

export function getTreePathLegacyLegacyFromLibraryFileLegacy(
	libraryFile: LibraryFileLegacy,
): TreePathLegacyLegacy {
	const { metaInfo, fullPath } = libraryFile;
	const { basename } = fullPath;

	switch (metaInfo.fileType) {
		case "Scroll": {
			const parsedBasename = ScrollBasenameSchemaLegacy.parse(basename);
			return treePathToScrollBasename.decode(parsedBasename);
		}
		case "Page": {
			const parsedBasename =
				PageBasenameLegacySchemaLegacy.parse(basename);
			return treePathToPageBasenameLegacy.decode(parsedBasename);
		}
		case "Codex": {
			const parsedBasename = CodexBaseameSchemaLegacy.parse(basename);
			return treePathToCodexBasename.decode(parsedBasename);
		}
		case "Unknown": {
			return [
				...fullPath.pathParts,
				basename.replace(/\.md$/, ""),
			] as TreePathLegacyLegacy;
		}
	}
}

/**
 * Infers MetaInfo from filename and pathParts when meta section is missing.
 */
function inferMetaInfo({
	basename,
}: Pick<ReadablePrettyFile, "basename" | "pathParts">): MetaInfo | null {
	const codexResult = CodexBaseameSchemaLegacy.safeParse(basename);
	if (codexResult.success) {
		return {
			fileType: "Codex",
			status: TextStatusLegacy.NotStarted,
		};
	}

	const pageResult = PageBasenameLegacySchemaLegacy.safeParse(basename);

	if (pageResult.success) {
		try {
			const decoded = treePathToPageBasenameLegacy.decode(
				pageResult.data,
			);
			const pageNum = decoded[0];
			if (pageNum) {
				const index = Number(pageNum);
				if (index >= 0 && index <= 999) {
					return {
						fileType: "Page",
						index,
						status: TextStatusLegacy.NotStarted,
					};
				}
			}
		} catch {
			return null;
		}
	}

	const scrollResult = ScrollBasenameSchemaLegacy.safeParse(basename);
	if (scrollResult.success) {
		return {
			fileType: "Scroll",
			status: TextStatusLegacy.NotStarted,
		};
	}

	return null;
}

export async function prettyFileWithReaderToLibraryFileLegacy(
	fileReader: ReadablePrettyFile,
): Promise<LibraryFileLegacy | null> {
	const content = await fileReader.readContent();
	let metaInfo = extractMetaInfo(content);

	// Fallback: infer from filename if meta section is missing
	if (metaInfo === null) {
		metaInfo = inferMetaInfo(fileReader);
	}

	if (metaInfo === null || metaInfo.fileType === "Unknown") {
		return null;
	}

	if (metaInfo.fileType === "Page" && "index" in metaInfo) {
		return {
			fullPath: {
				basename: fileReader.basename,
				extension: "md",
				pathParts: fileReader.pathParts,
				type: "file",
			},
			metaInfo,
		};
	}

	if (metaInfo.fileType === "Scroll") {
		return {
			fullPath: {
				basename: fileReader.basename,
				extension: "md",
				pathParts: fileReader.pathParts,
				type: "file",
			},
			metaInfo,
		};
	}

	if (metaInfo.fileType === "Codex") {
		return {
			fullPath: {
				basename: fileReader.basename,
				extension: "md",
				pathParts: fileReader.pathParts,
				type: "file",
			},
			metaInfo,
		};
	}

	return null;
}

export async function prettyFilesWithReaderToLibraryFileLegacy(
	fileReaders: readonly ReadablePrettyFile[],
): Promise<LibraryFileLegacy[]> {
	const libraryFiles = await Promise.all(
		fileReaders.map(prettyFileWithReaderToLibraryFileLegacy),
	);

	return libraryFiles.filter(
		(libraryFile): libraryFile is LibraryFileLegacy => libraryFile !== null,
	);
}
