import type { SplitPathToMdFile } from "../../../obsidian-vault-action-manager/types/split-path";
import { extractMetaInfo } from "../../../services/dto-services/meta-info-manager/interface";
import type { MetaInfo } from "../../../services/dto-services/meta-info-manager/types";
import { TextStatus } from "../../../types/common-interface/enums";
import type { LibraryFile, TreePath } from "../types";
import {
	CodexBaseameSchema,
	PageBasenameSchema,
	ScrollBasenameSchema,
	treePathToCodexBasename,
	treePathToPageBasename,
	treePathToScrollBasename,
} from "./codecs";

export function getTreePathFromLibraryFile(libraryFile: LibraryFile): TreePath {
	const { metaInfo, fullPath } = libraryFile;
	const { basename } = fullPath;

	switch (metaInfo.fileType) {
		case "Scroll": {
			const parsedBasename = ScrollBasenameSchema.parse(basename);
			return treePathToScrollBasename.decode(parsedBasename);
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
}: Pick<SplitPathToMdFile, "basename" | "pathParts">): MetaInfo | null {
	const codexResult = CodexBaseameSchema.safeParse(basename);
	if (codexResult.success) {
		return {
			fileType: "Codex",
			status: TextStatus.NotStarted,
		};
	}

	const pageResult = PageBasenameSchema.safeParse(basename);

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

	const scrollResult = ScrollBasenameSchema.safeParse(basename);
	if (scrollResult.success) {
		return {
			fileType: "Scroll",
			status: TextStatus.NotStarted,
		};
	}

	return null;
}

export async function prettyFileWithReaderToLibraryFile(
	fileReader: SplitPathToMdFile & { readContent: () => Promise<string> },
): Promise<LibraryFile | null> {
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
				type: "MdFile" as const,
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
				type: "MdFile" as const,
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
				type: "MdFile" as const,
			},
			metaInfo,
		};
	}

	return null;
}

export async function prettyFilesWithReaderToLibraryFiles(
	fileReaders: readonly ManagerFsReader[],
): Promise<LibraryFile[]> {
	const libraryFiles = await Promise.all(
		fileReaders.map(prettyFileWithReaderToLibraryFile),
	);

	return libraryFiles.filter(
		(libraryFile): libraryFile is LibraryFile => libraryFile !== null,
	);
}
