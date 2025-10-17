import type { Maybe } from '../types/general';
import {
	type TreePath,
	type TreeNode,
	NodeType,
	type TextNode,
	type PageNode,
	NodeStatus,
	type SectionNode,
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

	getOrCreateSectionNode({
		path,
		status = 'NotStarted',
	}: {
		path: TreePath;
		status?: NodeStatus;
	}): Maybe<SectionNode> {
		const mbNode = this.getMaybeNode({ path });
		if (!mbNode.error && mbNode.data.type === NodeType.Section) {
			return { error: false, data: mbNode.data };
		}

		const name = path.pop();
		const pathToParent = path;

		if (!name) {
			return {
				error: true,
				description: `Path is empty`,
			};
		}

		const mbParent = this.getMaybeNode({ path: pathToParent });

		if (mbParent.error) {
			return mbParent;
		} else if (mbParent.data.type !== NodeType.Section) {
			return {
				error: true,
				description: `Parent is not a section`,
			};
		}

		const parent = mbParent.data;

		const sectionNode = {
			name,
			status: status ?? NodeStatus.NotStarted,
			type: NodeType.Section,
			children: [],
		} satisfies SectionNode;

		parent.children.push(sectionNode);

		return { error: false, data: sectionNode };
	}

	getOrCreateTextNode({
		path,
		status = 'NotStarted',
	}: {
		path: TreePath;
		status?: NodeStatus;
	}): Maybe<TextNode> {
		const mbNode = this.getMaybeNode({ path });
		if (!mbNode.error && mbNode.data.type === NodeType.Text) {
			return { error: false, data: mbNode.data };
		}

		let parent: SectionNode | undefined = undefined;
		for (let i = 0; i < path.length - 2; i++) {
			const mbSection = this.getOrCreateSectionNode({
				path: path.slice(0, i + 1) as TreePath,
			});
			if (mbSection.error) {
				return mbSection;
			}
			parent = mbSection.data;
		}

		const textName = path.pop();
		if (!parent) {
			return {
				error: true,
				description: 'No parent section found for TextNode. Path too short?',
			};
		} else if (!textName) {
			return {
				error: true,
				description: 'Text name is empty',
			};
		}

		// Check if TextNode with the same name already exists
		let existing = parent.children.find(
			(node) => node.type === NodeType.Text && node.name === textName
		) as TextNode;

		if (existing) {
			return { error: false, data: existing };
		}

		const textNode: TextNode = {
			name: textName,
			status: status,
			type: NodeType.Text,
			children: [],
		};

		parent.children.push(textNode);

		return { error: false, data: textNode };
	}
}
