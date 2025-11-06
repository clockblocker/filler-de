import type { MetaInfo } from "../../../services/dto-services/meta-info-manager/types";
import type { SplitPathToFile } from "../../../services/obsidian-services/file-services/types";
import { UNKNOWN } from "../../../types/literals";
import { getTreePathFromNode } from "../pure-functions/node";
import {
	type LibraryFileDto,
	NodeType,
	type TreeNode,
	type TreePath,
} from "../types";
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
				splitPath.basename = scrollNameFromTreePath.encode(treePath);
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
				splitPath.basename = scrollNameFromTreePath.encode(treePath);
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
			return scrollNameFromTreePath.decode(parsedBasename);
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
			// For Unknown fileType, we can't decode from basename
			// Return pathParts + basename (without extension) as best guess
			return [
				...splitPath.pathParts,
				basename.replace(/\.md$/, ""),
			] as TreePath;
		}
	}
}
