import type { Maybe } from '../types/general';
import {
	type TreePath,
	type TreeNode,
	NodeType,
	type TextNode,
	type PageNode,
	NodeStatus,
	type SectionNode,
} from './tree-types';

export class CurratedTree {
	children: TreeNode[];
	type: typeof NodeType.Section;
	name: string;
	status: NodeStatus;

	constructor(nodes: TreeNode[], name: string) {
		this.children = nodes;
		this.type = NodeType.Section;
		this.name = name;
		this.status = NodeStatus.InProgress;
	}

	public addText({
		path,
		pageStatuses,
		status = 'NotStarted',
	}: {
		path: TreePath;
		pageStatuses: NodeStatus[];
		status?: NodeStatus;
	}): Maybe<TextNode> {
		const textNode = this.getOrCreateTextNode({ path, status });
		if (textNode.error) {
			return textNode;
		}

		textNode.data.children = Array.from(
			{ length: pageStatuses.length },
			(_, index) =>
				({
					index,
					status: pageStatuses[index] ?? NodeStatus.NotStarted,
					type: NodeType.Page,
				}) satisfies PageNode
		);

		return { error: false, data: textNode.data };
	}

	getMaybeNode({ path }: { path: TreePath }): Maybe<TreeNode | CurratedTree> {
		// Empty path returns the tree itself (root)
		if (path.length === 0) {
			return { error: false, data: this };
		}

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

	getParentNode({ path }: { path: TreePath }): Maybe<TreeNode | CurratedTree> {
		// Verify the node exists first
		const nodeCheck = this.getMaybeNode({ path });
		if (nodeCheck.error) {
			return nodeCheck;
		}

		// For single-element paths, parent is the tree itself
		if (path.length === 1) {
			return { error: false, data: this };
		}

		// For longer paths, get the parent by slicing off the last element
		const parentPath = path.slice(0, -1) as TreePath;
		return this.getMaybeNode({ path: parentPath });
	}

	getOrCreateSectionNode({
		path,
		status = 'NotStarted',
	}: {
		path: TreePath;
		status?: NodeStatus;
	}): Maybe<SectionNode> {
		if (path.length === 0) {
			return {
				error: true,
				description: `Path is empty`,
			};
		}

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

		const sectionNode = {
			name,
			status: status ?? NodeStatus.NotStarted,
			type: NodeType.Section,
			children: [],
		} satisfies SectionNode;

		// Handle root-level section creation
		if (pathToParent.length === 0) {
			this.children.push(sectionNode);
			return { error: false, data: sectionNode };
		}

		// Handle nested section creation
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
		for (let i = 0; i < path.length - 1; i++) {
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
