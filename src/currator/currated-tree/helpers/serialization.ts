import { CurratedTree } from '../currated-tree';
import type { SerializedText, TreePath } from '../../tree-types';
import { dfs } from './walks';
import { NodeType } from '../../tree-types';

export const makeTreeFromTexts = (texts: SerializedText[]): CurratedTree => {
	const tree = new CurratedTree([], 'Library');
	texts.forEach((text) => {
		tree.addText(text);
	});
	return tree;
};

export const makeTextsFromTree = (tree: CurratedTree): SerializedText[] => {
	const texts: SerializedText[] = [];
	for (const { node, path } of dfs(tree)) {
		if (node.type === NodeType.Text) {
			texts.push({
				path: path as TreePath,
				pageStatuses: node.children.map((child) => child.status),
			});
		}
	}
	return texts;
};
