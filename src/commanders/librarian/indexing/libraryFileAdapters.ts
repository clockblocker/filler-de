import { extractMetaInfo } from "../../../services/dto-services/meta-info-manager/interface";
import type { MetaInfo } from "../../../services/dto-services/meta-info-manager/types";
import type { ReadablePrettyFile } from "../../../services/obsidian-services/file-services/background/background-file-service";
import type { SplitPathToFile } from "../../../services/obsidian-services/file-services/types";
import { TextStatus } from "../../../types/common-interface/enums";
import { PAGES, UNKNOWN } from "../../../types/literals";
import { getTreePathFromNode } from "../pure-functions/node";
import type { LibraryFileDto } from "../types";
import { NodeType, type TreeNode, type TreePath } from "../types";
import {
	codexNameFromTreePath,
	GuardedCodexNameSchema,
	GuardedPageNameSchema,
	GuardedScrollNameSchema,
	pageNameFromTreePath,
	scrollNameFromTreePath,
} from "./formatters";

export function getLibraryFileToFileFromNode(node: TreeNode): LibraryFileDto {
	const treePath = getTreePathFromNode(node);

	let metaInfo: MetaInfo = {
		fileType: "Unknown",
		status: node.status,
	};

	const splitPath: SplitPathToFile = {
		basename: UNKNOWN,
		extension: "md",
		pathParts: treePath.slice(0, -1),
		type: "file",
	};

	switch (node.type) {
		case NodeType.Page: {
			if (node.parent?.children.length === 1) {
				metaInfo = { fileType: "Scroll", status: node.status };
				// scrollNameFromTreePath requires min 2 elements, so use node name directly for single-element paths
				if (treePath.length < 2) {
					splitPath.basename = node.name;
				} else {
					splitPath.basename =
						scrollNameFromTreePath.encode(treePath);
				}
				break;
			}
			splitPath.basename = pageNameFromTreePath.encode(treePath);
			const pageName = treePath[treePath.length - 1];

			if (!pageName) {
				break;
			}

			const index = Number(pageName);
			if (index < 0 || index > 999) {
				break;
			}

			metaInfo = {
				fileType: "Page",
				index,
				status: node.status,
			};
			break;
		}
		case NodeType.Text: {
			if (node.children.length === 1) {
				metaInfo = { fileType: "Scroll", status: node.status };
				// scrollNameFromTreePath requires min 2 elements, so use node name directly for single-element paths
				if (treePath.length < 2) {
					splitPath.basename = node.name;
				} else {
					splitPath.basename =
						scrollNameFromTreePath.encode(treePath);
				}
				break;
			}
			splitPath.basename = codexNameFromTreePath.encode(treePath);
			metaInfo = { fileType: "Codex", status: node.status };

			break;
		}
		case NodeType.Section: {
			splitPath.basename = codexNameFromTreePath.encode(treePath);
			metaInfo = { fileType: "Codex", status: node.status };
		}
	}

	return {
		metaInfo,
		splitPath,
	};
}

export function getTreePathFromLibraryFile(
	libraryFile: LibraryFileDto,
): TreePath {
	const { metaInfo, splitPath } = libraryFile;
	const { basename } = splitPath;

	switch (metaInfo.fileType) {
		case "Scroll": {
			const parsedBasename = GuardedScrollNameSchema.parse(basename);
			try {
				const decoded = scrollNameFromTreePath.decode(parsedBasename);
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
			const parsedBasename = GuardedPageNameSchema.parse(basename);
			return pageNameFromTreePath.decode(parsedBasename);
		}
		case "Codex": {
			const parsedBasename = GuardedCodexNameSchema.parse(basename);
			return codexNameFromTreePath.decode(parsedBasename);
		}
		case "Unknown": {
			return [
				...splitPath.pathParts,
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
	pathParts,
}: Pick<ReadablePrettyFile, "basename" | "pathParts">): MetaInfo | null {
	const codexResult = GuardedCodexNameSchema.safeParse(basename);
	if (codexResult.success) {
		return {
			fileType: "Codex",
			status: TextStatus.NotStarted,
		};
	}

	const pageResult = GuardedPageNameSchema.safeParse(basename);
	console.log("[inferMetaInfo] basename, pageResult", basename, pageResult);

	if (pageResult.success && pathParts.includes(PAGES)) {
		try {
			const decoded = pageNameFromTreePath.decode(pageResult.data);
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
	const scrollResult = GuardedScrollNameSchema.safeParse(basename);
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
			metaInfo,
			splitPath: {
				basename: fileReader.basename,
				extension: "md",
				pathParts: fileReader.pathParts,
				type: "file",
			},
		};
	}
	// Handle Scroll files
	if (metaInfo.fileType === "Scroll") {
		return {
			metaInfo,
			splitPath: {
				basename: fileReader.basename,
				extension: "md",
				pathParts: fileReader.pathParts,
				type: "file",
			},
		};
	}
	// Handle Codex files
	if (metaInfo.fileType === "Codex") {
		return {
			metaInfo,
			splitPath: {
				basename: fileReader.basename,
				extension: "md",
				pathParts: fileReader.pathParts,
				type: "file",
			},
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
