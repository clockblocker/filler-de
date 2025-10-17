import type { Maybe } from '../types/general';
import {
	type TreePath,
	type TreeNode,
	NodeType,
	type TextNode,
	type PageNode,
} from './types';

export class CurratedTree {
	private children: TreeNode[];

	constructor(nodes: TreeNode[]) {
		this.children = nodes;
	}

	getMaybeNode({ path }: { path: TreePath }): Maybe<TreeNode> {
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

	getMaybePage({
		path,
		index,
	}: {
		path: TreePath;
		index: number;
	}): Maybe<PageNode> {
		const maybeNode = this.getMaybeNode({ path });
		if (maybeNode.error) {
			return maybeNode;
		}
		const node = maybeNode.data as TextNode;
		if (node.type !== NodeType.Text) {
			return {
				error: true,
				description: `Node ${path.join('-')} is not a text`,
			};
		}

		const page = node.children.find((child) => child.index === index);
		if (!page) {
			return { error: true, description: `Page ${index} not found` };
		}

		return {
			error: false,
			data: page,
		};
	}
}
