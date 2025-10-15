import type { Maybe } from '../types/general';
import { type TreePath, type TreeNode, NodeType } from './types';

export class CurratedTree {
	private children: TreeNode[];

	constructor(nodes: TreeNode[]) {
		this.children = nodes;
	}

	getMaybeNode(path: TreePath): Maybe<TreeNode> {
		let candidats = this.children;
		let lastMatchingNode: TreeNode | undefined = undefined;

		for (const part of path) {
			lastMatchingNode = candidats.find((node) => node.name === part);

			if (!lastMatchingNode) {
				return { error: true, description: `Node "${part}" not found` };
			} else if (lastMatchingNode.type === NodeType.Section) {
				candidats = lastMatchingNode.children;
			} else {
				candidats = [];
			}
		}

		return lastMatchingNode
			? { error: false, data: lastMatchingNode }
			: { error: true, description: `Node ${path.join('-')} not found` };
	}
}
