import type { Maybe } from "../../../types/common-interface/maybe";
import {
	areShallowEqual,
	getNodeId,
	serializeTextNode,
} from "../pure-functions/node";
import {
	type BookNode,
	type LeafNode,
	NodeStatus,
	NodeType,
	type PageNode,
	type ScrollNode,
	type SectionNode,
	type SerializedText,
	type TextNode,
	type TreeNode,
	type TreePath,
} from "../types";
import { bfs } from "./helpers/walks";

export class LibraryTree {
	root: SectionNode;

	constructor(serializedTexts: SerializedText[], name: string) {
		this.root = {
			children: [],
			name,
			parent: null,
			status: NodeStatus.NotStarted,
			type: NodeType.Section,
		};

		// Build tree from serialized texts
		for (const serializedText of serializedTexts) {
			this.addText(serializedText);
		}

		// Compute initial statuses for all nodes
		this.recomputeTreeStatuses();
	}

	public getTexts(path: TreePath): SerializedText[] {
		const mbNode = this.getMaybeNode({ path });
		if (mbNode.error) {
			return [];
		}

		const textNodes = this.getTextNodesFromNode(mbNode.data);
		return textNodes.map((node) => serializeTextNode(node));
	}

	public getAllTextsInTree(): SerializedText[] {
		return this.getTexts([]);
	}

	public addText(serializedText: SerializedText): Maybe<TextNode> {
		const newText = this.getOrCreateTextNode(serializedText);
		this.recomputeTreeStatuses();
		return newText;
	}

	public deleteText({ path }: { path: TreePath }): void {
		const mbTextNode = this.getMaybeTextNode({ path });
		if (mbTextNode.error) {
			return;
		}

		this.deleteNode(mbTextNode.data);
		this.recomputeTreeStatuses();
	}

	public changeStatus({
		path,
		status,
	}: {
		path: TreePath;
		status: "Done" | "NotStarted";
	}): Maybe<TreeNode> {
		const mbNode = this.getMaybeNode({ path });
		if (mbNode.error) {
			return mbNode;
		}

		const node = mbNode.data;
		this.setStatusOnNodeAndItsDescendants(node, status);
		this.recomputeTreeStatuses();

		return { data: node, error: false };
	}

	private setStatusOnNodeAndItsDescendants(
		node: TreeNode,
		status: NodeStatus,
	): void {
		switch (node.type) {
			case NodeType.Page:
			case NodeType.Scroll:
				node.status = status;
				break;
			case NodeType.Book: {
				const bookNode = node;
				for (const page of bookNode.children) {
					page.status = status;
				}
				break;
			}
			case NodeType.Section: {
				const section = node;
				for (const child of section.children) {
					this.setStatusOnNodeAndItsDescendants(child, status);
				}
				break;
			}
		}
	}

	public getDiff(other: LibraryTree): TreeNode[] {
		const otherSet = new Map<string, TreeNode>();
		for (const { node, path } of bfs(other.root)) {
			otherSet.set(path.join("-"), node);
		}

		const diff: TreeNode[] = [];

		for (const { node, path } of bfs(this.root)) {
			const key = path.join("-");
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

	isEqualTo(other: LibraryTree): boolean {
		return this.getDiff(other).length === 0;
	}

	getMaybeNode({ path }: { path: TreePath }): Maybe<TreeNode> {
		let endOfTheChain: TreeNode = this.root;

		for (const name of path) {
			const mbNextInChain = this.getMaybeChildNode({
				endOfTheChain,
				name,
			});

			if (mbNextInChain.error) {
				return {
					description: `Node ${path.join("-")} not found: ${mbNextInChain.description}`,
					error: true,
				};
			}

			endOfTheChain = mbNextInChain.data;
		}

		return { data: endOfTheChain, error: false };
	}

	private getMaybeTextNode({ path }: { path: TreePath }): Maybe<TextNode> {
		const mbNode = this.getMaybeNode({ path });
		if (!mbNode.error) {
			if (
				mbNode.data.type === NodeType.Book ||
				mbNode.data.type === NodeType.Scroll
			) {
				return { data: mbNode.data, error: false };
			}
			return {
				description: `Node ${path.join("-")} is not a TextNode`,
				error: true,
			};
		}

		return { description: mbNode.description, error: true };
	}

	private getMaybeChildNode({
		name,
		endOfTheChain,
	}: {
		name: TreeNode["name"];
		endOfTheChain: TreeNode;
	}): Maybe<TreeNode> {
		if (
			endOfTheChain.type === NodeType.Page ||
			endOfTheChain.type === NodeType.Scroll
		) {
			return {
				description: `Node ${endOfTheChain.name} is a leaf. It's child ${name} was looked up.`,
				error: true,
			};
		}

		const candidats = endOfTheChain.children;
		const found = candidats.find((child) => child.name === name);

		return found
			? { data: found, error: false }
			: {
					description: `Child "${name}" of node "${endOfTheChain.name}" not found`,
					error: true,
				};
	}

	getOrCreateChildSectionNode({
		parent,
		name,
	}: {
		parent: SectionNode;
		name: string;
	}): Maybe<SectionNode> {
		const found = parent.children.find((child) => child.name === name);
		if (found) {
			if (found.type === NodeType.Section) {
				return { data: found, error: false };
			}
			return {
				description: `\t[getOrCreateChildSectionNode] failed: \nChild "${name}" of node "${parent.name}" is not a SectionNode`,
				error: true,
			};
		}

		const newSectionNode = {
			children: [],
			name,
			parent,
			status: NodeStatus.NotStarted,
			type: NodeType.Section,
		};
		parent.children.push(newSectionNode);
		return { data: newSectionNode, error: false };
	}

	getOrCreateTextNode({
		path,
		pageStatuses,
	}: SerializedText): Maybe<TextNode> {
		const newTextNodeName = path[path.length - 1];

		if (path.length === 0 || !newTextNodeName) {
			return {
				description: "Path is empty",
				error: true,
			};
		}

		const mbTextNode = this.getMaybeTextNode({ path });
		if (!mbTextNode.error) {
			return mbTextNode;
		}

		const parent = this.root;
		for (const name of path.slice(0, -1)) {
			const mbNewSection = this.getOrCreateChildSectionNode({
				name,
				parent,
			});

			if (mbNewSection.error) {
				return {
					description: `[getOrCreateTextNode] failed to create ${path.join("-")}: \n\t${mbNewSection.description}`,
					error: true,
				};
			}
		}

		const pageNodes: PageNode[] = Object.entries(pageStatuses).map(
			([name, status]) => ({
				name,
				parent: null,
				status,
				type: NodeType.Page,
			}),
		);

		const textNode: TextNode =
			pageNodes.length > 1
				? {
						children: pageNodes,
						name: newTextNodeName,
						parent: parent,
						status: NodeStatus.NotStarted,
						type: NodeType.Book,
					}
				: {
						name: newTextNodeName,
						parent: parent,
						status: pageNodes[0]?.status ?? NodeStatus.NotStarted,
						type: NodeType.Scroll,
					};

		if (textNode.type === NodeType.Book) {
			for (const page of pageNodes) {
				page.parent = textNode;
			}
		}

		this.recomputeTreeStatuses();

		return { data: textNode, error: false };
	}

	getTextNodesFromNode(node: TreeNode): TextNode[] {
		const textNodes: TextNode[] = [];

		function textFindingDfs(node: TreeNode) {
			switch (node.type) {
				case NodeType.Page:
					return;
				case NodeType.Book:
				case NodeType.Scroll:
					textNodes.push(node);
					break;
				case NodeType.Section:
					for (const child of node.children) {
						textFindingDfs(child);
					}
					break;
			}
		}

		textFindingDfs(node);
		return textNodes;
	}

	initializeParents(): void {
		this.root.parent = null;
		for (const child of this.root.children) {
			this.setNodeChildrensParentToNode(child);
		}
	}

	setNodeChildrensParentToNode(node: TreeNode): void {
		switch (node.type) {
			case NodeType.Page:
			case NodeType.Scroll:
				break;
			case NodeType.Book: {
				const bookNode = node;
				for (const page of bookNode.children) {
					page.parent = bookNode;
				}
				break;
			}
			case NodeType.Section: {
				const section = node as SectionNode;
				for (const child of section.children) {
					child.parent = node;
					this.setNodeChildrensParentToNode(child);
				}
				break;
			}
		}
	}

	public recomputeTreeStatuses(): LeafNode[] {
		const affectedLeaves: LeafNode[] = this.recomputeStatuses(this.root);
		return affectedLeaves;
	}

	recomputeStatuses(
		node: TreeNode,
		affectedLeaves: LeafNode[] = [],
		mbCache?: Record<string, NodeStatus>,
	): LeafNode[] {
		const cache = mbCache ?? this.computeNodeStatus(this.root).cache;
		const newStatus = cache[getNodeId(node)];
		const oldStatus = node.status;

		if (!newStatus) {
			return affectedLeaves;
		}

		node.status = newStatus;

		if (node.type === NodeType.Scroll || node.type === NodeType.Page) {
			if (newStatus !== oldStatus) {
				affectedLeaves.push(node);
			}
			return affectedLeaves;
		}

		node.children.forEach((child: TreeNode) => {
			this.recomputeStatuses(child, affectedLeaves, cache);
		});

		return affectedLeaves;
	}

	/**
	 * Computes the status of a single node based on its children's statuses.
	 * Rules:
	 * - Text node: all pages Done → Done, all pages NotStarted → NotStarted, otherwise → InProgress
	 * - Section node: all children Done → Done, all children NotStarted → NotStarted, otherwise → InProgress
	 */
	computeNodeStatus(
		node: TreeNode,
		initialCache: Record<string, NodeStatus> = {},
	): {
		cache: Record<string, NodeStatus>;
		status: NodeStatus;
	} {
		const cache: Record<string, NodeStatus> = initialCache;
		function inner(node: TreeNode): NodeStatus {
			switch (node.type) {
				case NodeType.Page:
				case NodeType.Scroll:
					return node.status;
				case NodeType.Book:
				case NodeType.Section: {
					const cached = cache[getNodeId(node)];
					if (cached) {
						return cached;
					}

					const statuses = node.children.map((c) =>
						this.computeNodeStatus(c),
					);

					const allDone = statuses.every((s) => s === "Done");
					const allNotStarted = statuses.every(
						(s) => s === "NotStarted",
					);

					const status = allDone
						? NodeStatus.Done
						: allNotStarted
							? NodeStatus.NotStarted
							: NodeStatus.InProgress;

					cache[getNodeId(node)] = status;
					return status;
				}
			}
		}

		return { cache, status: inner(node) };
	}

	deleteNode(node: TreeNode): void {
		const parent = node.parent;

		// Root node case
		if (!parent) {
			return;
		}

		if (parent.type === NodeType.Section || parent.type === NodeType.Book) {
			parent.children = parent.children.filter(
				(c) => c.name !== node.name,
			) as (SectionNode | BookNode | ScrollNode)[] | PageNode[];
		}

		if (node.type === NodeType.Section || node.type === NodeType.Book) {
			node.children = [];
		}

		node.parent = null;
	}
}

// Handle root-level text nodes
// if (path.length === 1) {
// 	const textName = path[0];
// 	const textIndex = this.root.children.findIndex(
// 		(child) =>
// 			child.type === NodeType.Text && child.name === textName,
// 	);

// 	if (textIndex !== -1) {
// 		this.root.children.splice(textIndex, 1);
// 	}
// 	this.recomputeTreeStatuses();
// 	return;
// }

// // Handle nested text nodes
// const parentChain = this.getParentChain({ path });
// if (parentChain.length === 0) {
// 	return;
// }

// const textName = path[path.length - 1];
// const parent = parentChain[0];

// if (!parent || !textName) {
// 	return;
// }

// // Delete the text node from its parent
// const textIndex = parent.children.findIndex(
// 	(child) => child.type === NodeType.Text && child.name === textName,
// );

// if (textIndex !== -1) {
// 	parent.children.splice(textIndex, 1);
// }

// // Remove empty section nodes up the chain
// for (let i = 0; i < parentChain.length; i++) {
// 	const current = parentChain[i];
// 	const isLastNode = i === parentChain.length - 1;

// 	if (current && current.children.length === 0) {
// 		if (isLastNode) {
// 			// Last node in chain - remove from root if it's empty
// 			const rootIndex = this.root.children.findIndex(
// 				(child) =>
// 					child.name === current.name &&
// 					child.type === current.type,
// 			);
// 			if (rootIndex !== -1) {
// 				this.root.children.splice(rootIndex, 1);
// 			}
// 		} else {
// 			// Not the last node - remove from its parent
// 			const grandParent = parentChain[i + 1];
// 			if (grandParent) {
// 				const sectionIndex = grandParent.children.findIndex(
// 					(child) =>
// 						child.name === current.name &&
// 						child.type === current.type,
// 				);

// 				if (sectionIndex !== -1) {
// 					grandParent.children.splice(sectionIndex, 1);
// 				}
// 			}
// 		}
// 	} else {
// 		// Stop if we find a non-empty parent
// 		break;
// 	}
// }

// // Recompute statuses after deletion
