import type { SerializedText, TreePath } from "../../types";
import { NodeType } from "../../types";
import { LibraryTree } from "../library-tree";
import { dfs } from "./walks";

export const makeTreeFromTexts = (
	texts: SerializedText[],
	treeName = "Library",
): LibraryTree => {
	const tree = new LibraryTree([], treeName);
	texts.forEach((text) => {
		tree.addText(text);
	});
	return tree;
};

export const makeTextsFromTree = (tree: LibraryTree): SerializedText[] => {
	const texts: SerializedText[] = [];
	for (const { node, path } of dfs(tree.root)) {
		if (node.type === NodeType.Text) {
			texts.push({
				pageStatuses: node.children.map((child) => child.status),
				path: [tree.root.name, ...path],
			});
		}
	}
	return texts;
};
