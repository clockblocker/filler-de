import type { MetaInfo } from "../../../services/dto-services/meta-info-manager/types";
import type { SplitPathToFile } from "../../../services/obsidian-services/file-services/types";
import { UNKNOWN } from "../../../types/literals";
import { getTreePathFromNode } from "../pure-functions/node";
import { type LibraryFile, NodeType, type TreeNode } from "../types";
import {
	codexNameFromTreePath,
	pageNameFromTreePath,
	scrollNameFromTreePath,
} from "./formatters";

export function getSplitPathToFileFromNode(node: TreeNode): LibraryFile {
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
