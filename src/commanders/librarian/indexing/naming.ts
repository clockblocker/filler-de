import type { GuardedCodexName } from "../formatters";
import { computeNodePath } from "../pure-functions/node";
import { type LibraryFile, NodeType, type TreeNode } from "../types";

export function getSplitPathToFileFromNode(node: TreeNode): LibraryFile {
	switch (node.type) {
		case NodeType.Page:
			basename = node.parent?.name ?? node.name;
			break;
		case NodeType.Text: {
			basename = node.name;
			break;
		}
		case NodeType.Section: {
		}
	}

	// return {
	// 	metaInfo: {
	// 		fileType: IndexedFileType.Library,
	// 		status: node.status,
	// 	},
	// 	splitPath: getSplitPathToFileFromNode(node),
	// };
}
