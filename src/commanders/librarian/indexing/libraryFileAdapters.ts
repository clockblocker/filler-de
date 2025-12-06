import { extractMetaInfo } from "../../../services/dto-services/meta-info-manager/interface";
import type { MetaInfo } from "../../../services/dto-services/meta-info-manager/types";
import type { ReadablePrettyFile } from "../../../services/obsidian-services/file-services/background/background-file-service";
import { TextStatus } from "../../../types/common-interface/enums";
import type { LibraryFileDto, TreePath } from "../types";
import {
	CodexBaseameSchema,
	PageBasenameSchema,
	ScrollBasenameSchema,
	treePathToCodexBasename,
	treePathToPageBasename,
	treePathToScrollBasename,
} from "./codecs";

export function getTreePathFromLibraryFile(
	libraryFile: LibraryFileDto,
): TreePath {
	const { metaInfo, fullPath } = libraryFile;
	const { basename } = fullPath;

	switch (metaInfo.fileType) {
		case "Scroll": {
			const parsedBasename = ScrollBasenameSchema.parse(basename);
			try {
				const decoded = treePathToScrollBasename.decode(parsedBasename);
				// scrollNameFromTreePath requires min 2 elements, so single-element paths will fail
				// For single-element paths, use the basename directly
				if (decoded.length < 2) {
					return [parsedBasename] as TreePath;
				}
				return decoded;
			} catch {
				return [parsedBasename] as TreePath;
			}
		}
		case "Page": {
			const parsedBasename = PageBasenameSchema.parse(basename);
			return treePathToPageBasename.decode(parsedBasename);
		}
		case "Codex": {
			const parsedBasename = CodexBaseameSchema.parse(basename);
			return treePathToCodexBasename.decode(parsedBasename);
		}
		case "Unknown": {
			return [
				...fullPath.pathParts,
				basename.replace(/\.md$/, ""),
			] as TreePath;
		}
	}
}

/**
 * Infers MetaInfo from filename and pathParts when meta section is missing.
 */
function inferMetaInfo({
	basename,
}: Pick<ReadablePrettyFile, "basename" | "pathParts">): MetaInfo | null {
	const codexResult = CodexBaseameSchema.safeParse(basename);
	if (codexResult.success) {
		return {
			fileType: "Codex",
			status: TextStatus.NotStarted,
		};
	}

	const pageResult = PageBasenameSchema.safeParse(basename);
	console.log("[inferMetaInfo] basename, pageResult", basename, pageResult);

	if (pageResult.success) {
		try {
			const decoded = treePathToPageBasename.decode(pageResult.data);
			const pageNum = decoded[0];
			if (pageNum) {
				const index = Number(pageNum);
				if (index >= 0 && index <= 999) {
					return {
						fileType: "Page",
						index,
						status: TextStatus.NotStarted,
					};
				}
			}
		} catch {
			return null;
		}
	}

	// Try Scroll: any other valid name
	const scrollResult = ScrollBasenameSchema.safeParse(basename);
	if (scrollResult.success) {
		return {
			fileType: "Scroll",
			status: TextStatus.NotStarted,
		};
	}

	return null;
}

export async function prettyFileWithReaderToLibraryFileDto(
	fileReader: ReadablePrettyFile,
): Promise<LibraryFileDto | null> {
	const content = await fileReader.readContent();
	let metaInfo = extractMetaInfo(content);

	// Fallback: infer from filename if meta section is missing
	if (metaInfo === null) {
		metaInfo = inferMetaInfo(fileReader);
	}

	if (metaInfo === null || metaInfo.fileType === "Unknown") {
		return null;
	}

	// Handle Page files
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
	// Handle Scroll files
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
	// Handle Codex files
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

export async function prettyFilesWithReaderToLibraryFileDtos(
	fileReaders: readonly ReadablePrettyFile[],
): Promise<LibraryFileDto[]> {
	const libraryFileDtos = await Promise.all(
		fileReaders.map(prettyFileWithReaderToLibraryFileDto),
	);

	return libraryFileDtos.filter(
		(libraryFileDto): libraryFileDto is LibraryFileDto =>
			libraryFileDto !== null,
	);
}
