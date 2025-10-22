import type { SerializedText, TreePath } from "../../types";
import { NodeType } from "../../types";
import { CurratedTree } from "../currated-tree";
import { dfs } from "./walks";

export const makeTreeFromTexts = (texts: SerializedText[]): CurratedTree => {
	const tree = new CurratedTree([], "Library");
	texts.forEach((text) => {
		tree.addText(text);
	});
	return tree;
};

export const makeTextsFromTree = (tree: CurratedTree): SerializedText[] => {
	const texts: SerializedText[] = [];
	for (const { node, path } of dfs(tree.root)) {
		if (node.type === NodeType.Text) {
			texts.push({
				pageStatuses: node.children.map((child) => child.status),
				path: path as TreePath,
			});
		}
	}
	return texts;
};
