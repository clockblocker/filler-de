import { serializeTextNode } from "../../pure-functions/node";
import type { TextDto } from "../../types";
import { NodeType } from "../../types";
import { LibraryTree } from "../library-tree";
import { dfs } from "./walks";

export const makeTreeFromTexts = (
	texts: TextDto[],
	treeName = "Library",
): LibraryTree => {
	const tree = new LibraryTree([], treeName);
	texts.forEach((text) => {
		tree.addText(text);
	});
	return tree;
};

export const makeTextsFromTree = (tree: LibraryTree): TextDto[] => {
	const texts: TextDto[] = [];
	for (const { node, path } of dfs(tree.root)) {
		if (node.type === NodeType.Book || node.type === NodeType.Scroll) {
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
