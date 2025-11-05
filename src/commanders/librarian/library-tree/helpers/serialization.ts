import { computeNodePath } from "../../pure-functions/node";
import type { TextDto, TextNode, TreePath } from "../../types";
import { NodeType } from "../../types";
import { LibraryTree } from "../library-tree";
import { dfs } from "./walks";

export const makeTreeFromTexts = (
	texts: TextDto[],
	treeName = "Library",
): LibraryTree => {
	const tree = new LibraryTree([], treeName);
	tree.addTexts(texts);
	return tree;
};

export const makeTextsFromTree = (tree: LibraryTree): TextDto[] => {
	const texts: TextDto[] = [];
	for (const { node, path } of dfs(tree.root)) {
		if (node.type === NodeType.Text) {
			// Use the path from DFS directly, prepending root name
			const fullPath: TreePath = [tree.root.name, ...path];
			const serialized = serializeTextNode(node, path);
			texts.push({
				...serialized,
				path: fullPath,
			});
		}
	}
	return texts;
};

export function serializeTextNode(
	node: TextNode,
	providedPath?: TreePath,
): TextDto {
	const path = providedPath ?? computeNodePath(node);
	const pageStatuses =
		node.type === NodeType.Text
			? Object.fromEntries(
					node.children.map(({ name, status }) => [name, status]),
				)
			: // For ScrollNodes, use the node name as the page name
				{ [node.name]: node.status };

	return {
		pageStatuses,
		path,
	};
}
