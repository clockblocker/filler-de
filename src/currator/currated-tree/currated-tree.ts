import type { Maybe } from '../../types/general';
import { areShallowEqual } from '../pure-functions/node';
import {
	type TreePath,
	type BranchNode,
	NodeType,
	type TextNode,
	type PageNode,
	NodeStatus,
	type SectionNode,
	type TreeNode,
	type SerializedText,
} from '../currator-types';
import { bfs } from './helpers/walks';

export class CurratedTree {
	children: BranchNode[];
	type: typeof NodeType.Section;
	name: string;
	status: NodeStatus;

	constructor(nodes: BranchNode[], name: string) {
		this.children = nodes;
		this.type = NodeType.Section;
		this.name = name;
		this.status = NodeStatus.InProgress;
	}

	public getTexts(path: TreePath): SerializedText[] {
		const mbNode = this.getMaybeNode({ path });
		if (mbNode.error) {
			return [];
		}

		const textNodes = this.getTextNodes(mbNode.data as BranchNode);
		return textNodes.map(
			(node) =>
				({
					path: path,
					pageStatuses: node.children.map((child) => child.status),
				}) satisfies SerializedText
		);
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

	public deleteText({ path }: { path: TreePath }): void {
		const node = this.getMaybeNode({ path });
		if (node.error) {
			return;
		}

		// Handle root-level text nodes
		if (path.length === 1) {
			const textName = path[0];
			const textIndex = this.children.findIndex(
				(child) => child.type === NodeType.Text && child.name === textName
			);

			if (textIndex !== -1) {
				this.children.splice(textIndex, 1);
			}
			return;
		}

		// Handle nested text nodes
		const parentChain = this.getParentChain({ path });
		if (parentChain.length === 0) {
			return;
		}

		const textName = path[path.length - 1];
		const parent = parentChain[0];

		if (!parent || !textName) {
			return;
		}

		// Delete the text node from its parent
		const textIndex = parent.children.findIndex(
			(child) => child.type === NodeType.Text && child.name === textName
		);

		if (textIndex !== -1) {
			parent.children.splice(textIndex, 1);
		}

		// Remove empty section nodes up the chain
		for (let i = 0; i < parentChain.length; i++) {
			const current = parentChain[i];
			const isLastNode = i === parentChain.length - 1;

			if (current && current.children.length === 0) {
				if (isLastNode) {
					// Last node in chain - remove from root if it's empty
					const rootIndex = this.children.findIndex(
						(child) =>
							child.name === current.name && child.type === current.type
					);
					if (rootIndex !== -1) {
						this.children.splice(rootIndex, 1);
					}
				} else {
					// Not the last node - remove from its parent
					const grandParent = parentChain[i + 1];
					if (grandParent) {
						const sectionIndex = grandParent.children.findIndex(
							(child) =>
								child.name === current.name && child.type === current.type
						);

						if (sectionIndex !== -1) {
							grandParent.children.splice(sectionIndex, 1);
						}
					}
				}
			} else {
				// Stop if we find a non-empty parent
				break;
			}
		}
	}

	public getDiff(other: CurratedTree): TreeNode[] {
		const otherSet = new Map<string, TreeNode>();
		for (const { node, path } of bfs(other)) {
			otherSet.set(path.join('-'), node);
		}

		const diff: TreeNode[] = [];

		for (const { node, path } of bfs(this)) {
			const key = path.join('-');
			const otherNode = otherSet.get(key);
			if (!otherNode) {
				diff.push(node);
				continue;
			}

			const found = areShallowEqual(node, otherNode);
			if (!found) {
				diff.push(node);
			}
		}

		return diff;
	}

	public isEqualTo(other: CurratedTree): boolean {
		return this.getDiff(other).length === 0;
	}

	getMaybeNode({ path }: { path: TreePath }): Maybe<BranchNode | CurratedTree> {
		// Empty path returns the tree itself (root)
		if (path.length === 0) {
			return { error: false, data: this };
		}

		let candidats = this.children;
		let lastMatchingNode: BranchNode | undefined = undefined;

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

	getParentNode({
		path,
	}: {
		path: TreePath;
	}): Maybe<BranchNode | CurratedTree> {
		const nodeCheck = this.getMaybeNode({ path });
		if (nodeCheck.error) {
			return nodeCheck;
		}

		if (path.length === 1) {
			return { error: false, data: this };
		}

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

		const pathCopy = [...path];
		const name = pathCopy.pop();
		const pathToParent = pathCopy;

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
		const mbParent = this.getMaybeNode({ path: pathToParent as TreePath });

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

		const pathCopy = [...path];
		const textName = pathCopy.pop();
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

	getParentChain({ path }: { path: TreePath }): BranchNode[] {
		// Base case: stop at root level (path length 1)
		if (path.length <= 1) {
			return [];
		}

		const parent = this.getParentNode({ path });
		if (parent.error) {
			return [];
		}

		// Only include BranchNodes in the chain, not the tree root
		if ('children' in parent.data && parent.data !== this) {
			return [
				parent.data as BranchNode,
				...this.getParentChain({ path: path.slice(0, -1) as TreePath }),
			];
		}

		return [];
	}

	private getTextNodes(node: BranchNode): TextNode[] {
		const textNodes: TextNode[] = [];

		function textFindingDfs(node: BranchNode) {
			if (node.type === NodeType.Text) {
				textNodes.push(node as TextNode);
			} else if (node.type === NodeType.Section) {
				for (const child of (node as SectionNode).children) {
					textFindingDfs(child);
				}
			}
		}

		textFindingDfs(node);
		return textNodes;
	}
}
